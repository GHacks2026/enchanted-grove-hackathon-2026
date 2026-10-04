import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { supabaseServer } from "@/lib/supabase/server";
import type { ItemKind, Pillar } from "@/lib/types";

// GET /api/pillars/:id/trail — CONTRACT §8
export async function GET(_req: Request, ctx: RouteContext<"/api/pillars/[id]/trail">) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return apiError("not_found", "Pillar not found.", 404);

  const supabase = supabaseServer();

  const { data: pillar, error: pillarErr } = await supabase
    .from("pillars").select("id, grove_id, name, description, position")
    .eq("id", id).maybeSingle<Pillar>();
  if (pillarErr) return dbError("load pillar", pillarErr);
  if (!pillar) return apiError("not_found", "Pillar not found.", 404);

  // Confirmed extractions only, non-deleted items only (CONTRACT §7, §9).
  const { data: items, error: itemsErr } = await supabase
    .from("items")
    .select("id, kind, final_interpretation, evidence_quote, quote_start, extractions!inner(confirmed_at, journals!inner(id, body))")
    .eq("final_pillar_id", id).neq("status", "deleted")
    .eq("extractions.status", "confirmed")
    .returns<{
      id: string; kind: ItemKind; final_interpretation: string; evidence_quote: string;
      quote_start: number; extractions: { confirmed_at: string; journals: { id: string; body: string } };
    }[]>();
  if (itemsErr) return dbError("load items", itemsErr);

  // Newest first; items from the same entry keep their order in the journal.
  items.sort((a, b) =>
    b.extractions.confirmed_at.localeCompare(a.extractions.confirmed_at) || a.quote_start - b.quote_start);

  return NextResponse.json({
    pillar,
    entries: items.map((i) => ({
      item_id: i.id,
      kind: i.kind,
      date: i.extractions.confirmed_at,
      interpretation: i.final_interpretation,
      evidence_quote: i.evidence_quote,
      journal_id: i.extractions.journals.id,
      journal_body: i.extractions.journals.body,
    })),
  });
}

function dbError(step: string, err: unknown) {
  console.error(`trail: ${step} failed`, err);
  return apiError("db_error", `Failed to ${step}.`, 500);
}
