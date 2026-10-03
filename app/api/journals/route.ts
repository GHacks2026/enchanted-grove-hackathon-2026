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
  if (pillarsErr) return dbError("load pillars", pillarsErr);
  if (pillars.length === 0) return apiError("no_pillars", "The grove has no pillars.", 500);

  const schema = buildExtractionSchema(pillars.map((p) => p.id) as [string, ...string[]]);
  const messages: ModelMessage[] = [
    { role: "user", content: buildExtractionUserMessage(grove.goal, pillars, body) },
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
    } catch (err) {
      // 7. Retry errored: keep the first call's grounded items and lantern; its failures are dropped.
      console.error("journals: retry failed, using first attempt", err);
    }
  }

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

  return NextResponse.json({ extraction_id: extraction.id, items: saved, lantern });
}

function dbError(step: string, err: unknown) {
  console.error(`journals: ${step} failed`, err);
  return apiError("db_error", `Failed to ${step}.`, 500);
}
