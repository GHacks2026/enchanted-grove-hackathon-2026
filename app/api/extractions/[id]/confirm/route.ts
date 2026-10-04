import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { ConfirmRequestSchema } from "@/lib/schemas";
import { supabaseServer } from "@/lib/supabase/server";
import type { Item } from "@/lib/types";

// Postgres error codes raised by confirm_extraction (CONTRACT §7) → HTTP status (§8).
const RPC_ERRORS: Record<string, { status: number; code: string; message: string }> = {
  SP400: { status: 400, code: "item_mismatch", message: "Send every item of this extraction exactly once." },
  SP404: { status: 404, code: "not_found", message: "Extraction not found." },
  SP409: { status: 409, code: "already_confirmed", message: "This extraction is already confirmed." },
  "23514": { status: 400, code: "invalid_item", message: "A kept bloom must have a tree." },
};

// POST /api/extractions/:id/confirm — CONTRACT §7 (confirm_extraction), §8
export async function POST(req: Request, ctx: RouteContext<"/api/extractions/[id]/confirm">) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return apiError("not_found", "Extraction not found.", 404);

  // Unknown keys (quote fields, status) are stripped by Zod and never reach the DB.
  const parsed = ConfirmRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError("invalid_request", z.prettifyError(parsed.error), 400);

  const supabase = supabaseServer();

  const { error: rpcErr } = await supabase.rpc("confirm_extraction", {
    p_extraction_id: id,
    p_items: parsed.data.items,
  });
  if (rpcErr) {
    const mapped = RPC_ERRORS[rpcErr.code];
    if (mapped) return apiError(mapped.code, mapped.message, mapped.status);
    return dbError("confirm extraction", rpcErr);
  }

  const { data: extraction, error: extErr } = await supabase
    .from("extractions").select("lantern")
    .eq("id", id).single<{ lantern: string }>();
  if (extErr) return dbError("load extraction", extErr);

  const { data: confirmed, error: itemsErr } = await supabase
    .from("items")
    .select("id, extraction_id, kind, original_interpretation, original_pillar_id, final_interpretation, final_pillar_id, evidence_quote, quote_start, quote_end, status")
    .eq("extraction_id", id).neq("status", "deleted")
    .order("quote_start")
    .returns<Item[]>();
  if (itemsErr) return dbError("load items", itemsErr);

  return NextResponse.json({ confirmed, lantern: extraction.lantern });
}

function dbError(step: string, err: unknown) {
  console.error(`confirm: ${step} failed`, err);
  return apiError("db_error", `Failed to ${step}.`, 500);
}
