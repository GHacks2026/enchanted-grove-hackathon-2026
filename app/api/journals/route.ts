import { NextResponse } from "next/server";
import type { ModelMessage } from "ai";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { findQuote, normalize } from "@/lib/grounding";
import { generateStructured } from "@/lib/llm";
import { EXTRACTION_SYSTEM_PROMPT, buildExtractionUserMessage, buildRetryAddendum } from "@/lib/prompts";
import { JournalRequestSchema, buildExtractionSchema, type RawExtraction } from "@/lib/schemas";
import { supabaseServer } from "@/lib/supabase/server";
import type { Grove, Item, ItemKind, Pillar } from "@/lib/types";

// Two sequential 30 s model calls in the worst case (CONTRACT §8).
export const maxDuration = 90;

type RawItem = { kind: ItemKind; interpretation: string; evidence_quote: string; pillar_id: string | null };
type GroundedItem = RawItem & { quote_start: number; quote_end: number };

// Split one attempt's items into grounded (quote found) and failed. Never repairs a quote (CONTRACT §6.6).
function ground(body: string, attempt: RawExtraction) {
  const all: RawItem[] = [
    ...attempt.blooms.map((b) => ({ kind: "bloom" as const, ...b })),
    ...attempt.friction.map((f) => ({ kind: "friction" as const, ...f })),
  ];
  const grounded: GroundedItem[] = [];
  const failed: RawItem[] = [];
  for (const item of all) {
    const span = findQuote(body, item.evidence_quote);
    if (span) {
      // Store the normalized quote so it always substring-matches normalize(body).
      grounded.push({ ...item, evidence_quote: normalize(item.evidence_quote), quote_start: span.start, quote_end: span.end });
    } else {
      failed.push(item);
    }
  }
  return { grounded, failed };
}

// GET /api/journals — CONTRACT §8. Past entries, confirmed only, newest first.
export async function GET() {
  const supabase = supabaseServer();

  const { data: grove, error: groveErr } = await supabase
    .from("groves").select("id").order("created_at").limit(1).maybeSingle<{ id: string }>();
  if (groveErr) return dbError("load grove", groveErr);
  if (!grove) return apiError("not_found", "No grove exists yet.", 404);

  const { data: extractions, error: extErr } = await supabase
    .from("extractions").select("id, confirmed_at, lantern, journals!inner(id, body, grove_id)")
    .eq("journals.grove_id", grove.id).eq("status", "confirmed")
    .order("confirmed_at", { ascending: false })
    .returns<{ id: string; confirmed_at: string; lantern: string; journals: { id: string; body: string } }[]>();
  if (extErr) return dbError("load extractions", extErr);
  if (extractions.length === 0) return NextResponse.json({ entries: [] });

  const { data: items, error: itemsErr } = await supabase
    .from("items").select("extraction_id, kind, final_interpretation, evidence_quote, final_pillar_id")
    .in("extraction_id", extractions.map((e) => e.id)).neq("status", "deleted")
    .order("quote_start")
    .returns<{ extraction_id: string; kind: ItemKind; final_interpretation: string; evidence_quote: string; final_pillar_id: string | null }[]>();
  if (itemsErr) return dbError("load items", itemsErr);

  return NextResponse.json({
    entries: extractions.map((e) => ({
      journal_id: e.journals.id,
      date: e.confirmed_at,
      body: e.journals.body,
      lantern: e.lantern,
      items: items.filter((i) => i.extraction_id === e.id).map((i) => ({
        kind: i.kind, interpretation: i.final_interpretation, evidence_quote: i.evidence_quote, pillar_id: i.final_pillar_id,
      })),
    })),
  });
}

// POST /api/journals — CONTRACT §6, §8
export async function POST(req: Request) {
  // 1. Validate the body. Load the grove and its pillars.
  const parsed = JournalRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError("invalid_request", z.prettifyError(parsed.error), 400);
  const body = parsed.data.body;

  const supabase = supabaseServer();

  const { data: grove, error: groveErr } = await supabase
    .from("groves").select("id, goal, created_at")
    .order("created_at").limit(1).maybeSingle<Grove>();
  if (groveErr) return dbError("load grove", groveErr);
  if (!grove) return apiError("not_found", "No grove exists yet.", 404);

  const { data: pillars, error: pillarsErr } = await supabase
    .from("pillars").select("id, grove_id, name, description, position")
    .eq("grove_id", grove.id).order("position")
    .returns<Pillar[]>();
  if (pillarsErr) return dbError("load trees", pillarsErr);
  if (pillars.length === 0) return apiError("no_pillars", "The grove has no trees.", 500);

  // The current Lantern (latest confirmed extraction), so the model can say if this entry followed it.
  const { data: latest, error: latestErr } = await supabase
    .from("extractions").select("lantern, journals!inner(grove_id)")
    .eq("journals.grove_id", grove.id).eq("status", "confirmed")
    .order("confirmed_at", { ascending: false }).limit(1)
    .returns<{ lantern: string }[]>();
  if (latestErr) return dbError("load previous lantern", latestErr);
  const previousLantern = latest[0]?.lantern ?? null;

  const schema = buildExtractionSchema(pillars.map((p) => p.id) as [string, ...string[]]);
  const messages: ModelMessage[] = [
    { role: "user", content: buildExtractionUserMessage(grove.goal, pillars, body, previousLantern) },
  ];

  // 2. First call. If it fails, nothing is saved (CONTRACT §6.8).
  let first: RawExtraction;
  try {
    first = await generateStructured({ schema, system: EXTRACTION_SYSTEM_PROMPT, messages });
  } catch (err) {
    console.error("journals: extraction failed", err);
    return apiError("llm_failed", "Extraction failed. Your entry was not saved; please try again.", 502);
  }

  // 3. Validate every quote.
  const firstResult = ground(body, first);
  let items = firstResult.grounded;
  let dropped = firstResult.failed;
  let lantern = first.lantern;
  let followed = first.lantern_followed;

  // 4–5. Exactly one retry if anything failed. Items and lantern come from the same attempt.
  if (firstResult.failed.length > 0) {
    try {
      const retry = await generateStructured({
        schema,
        system: EXTRACTION_SYSTEM_PROMPT,
        messages: [
          ...messages,
          { role: "assistant", content: JSON.stringify(first) },
          { role: "user", content: buildRetryAddendum(firstResult.failed.map((i) => i.evidence_quote)) },
        ],
      });
      const retryResult = ground(body, retry);
      items = retryResult.grounded;
      dropped = retryResult.failed;
      lantern = retry.lantern;
      followed = retry.lantern_followed;
    } catch (err) {
      // 7. Retry errored: keep the first call's grounded items and lantern; its failures are dropped.
      console.error("journals: retry failed, using first attempt", err);
    }
  }

  // A followed Lantern is grounded like an item: no exact quote, no claim (CONTRACT §3).
  const followedQuote = previousLantern && followed && findQuote(body, followed.evidence_quote) ? normalize(followed.evidence_quote) : null;

  // 9. Only now insert: journals → extractions → items.
  const { data: journal, error: journalErr } = await supabase
    .from("journals").insert({ grove_id: grove.id, body })
    .select("id").single<{ id: string }>();
  if (journalErr) return dbError("insert journal", journalErr);

  // Any failure after this point deletes the journal (cascades) so a client retry can't duplicate it.
  const rollback = async (step: string, err: unknown) => {
    await supabase.from("journals").delete().eq("id", journal.id);
    return dbError(step, err);
  };

  const { data: extraction, error: extErr } = await supabase
    .from("extractions")
    .insert({
      journal_id: journal.id,
      raw_json: first, // first attempt exactly as returned
      dropped_json: dropped.length > 0 ? dropped : null,
      lantern,
    })
    .select("id").single<{ id: string }>();
  if (extErr) return rollback("insert extraction", extErr);

  let saved: Item[] = [];
  if (items.length > 0) {
    const { data, error: itemsErr } = await supabase
      .from("items")
      .insert(items.map((i) => ({
        extraction_id: extraction.id,
        kind: i.kind,
        original_interpretation: i.interpretation,
        original_pillar_id: i.pillar_id,
        final_interpretation: i.interpretation,
        final_pillar_id: i.pillar_id,
        evidence_quote: i.evidence_quote,
        quote_start: i.quote_start,
        quote_end: i.quote_end,
      })))
      .select("id, extraction_id, kind, original_interpretation, original_pillar_id, final_interpretation, final_pillar_id, evidence_quote, quote_start, quote_end, status")
      .returns<Item[]>();
    if (itemsErr) return rollback("insert items", itemsErr);
    saved = data;
  }

  return NextResponse.json({
    extraction_id: extraction.id, items: saved, lantern,
    lantern_followed: followedQuote ? { lantern: previousLantern, evidence_quote: followedQuote } : null,
  });
}

function dbError(step: string, err: unknown) {
  console.error(`journals: ${step} failed`, err);
  return apiError("db_error", `Failed to ${step}.`, 500);
}
