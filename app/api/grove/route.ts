import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { GroveCreateRequestSchema } from "@/lib/schemas";
import { supabaseServer } from "@/lib/supabase/server";
import type { Grove, Pillar } from "@/lib/types";

const KNOT_WINDOW_MS = 3 * 24 * 60 * 60 * 1000; // CONTRACT §7: knots fade 3 days after confirmation

// GET /api/grove — CONTRACT §8
export async function GET() {
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

  // Confirmed extractions for this grove, newest first.
  const { data: extractions, error: extErr } = await supabase
    .from("extractions").select("id, lantern, confirmed_at, journals!inner(grove_id)")
    .eq("journals.grove_id", grove.id).eq("status", "confirmed")
    .order("confirmed_at", { ascending: false })
    .returns<{ id: string; lantern: string; confirmed_at: string }[]>();
  if (extErr) return dbError("load extractions", extErr);

  const leafCount = new Map<string, number>();
  const knotted = new Set<string>();

  if (extractions.length > 0) {
    const { data: items, error: itemsErr } = await supabase
      .from("items").select("kind, final_pillar_id, extraction_id")
      .in("extraction_id", extractions.map((e) => e.id)).neq("status", "deleted")
      .returns<{ kind: string; final_pillar_id: string | null; extraction_id: string }[]>();
    if (itemsErr) return dbError("load items", itemsErr);

    const confirmedAt = new Map(extractions.map((e) => [e.id, Date.parse(e.confirmed_at)]));
    const knotCutoff = Date.now() - KNOT_WINDOW_MS;
    for (const item of items) {
      if (!item.final_pillar_id) continue; // friction with no pillar draws no knot
      if (item.kind === "bloom") {
        leafCount.set(item.final_pillar_id, (leafCount.get(item.final_pillar_id) ?? 0) + 1);
      } else if (confirmedAt.get(item.extraction_id)! >= knotCutoff) {
        knotted.add(item.final_pillar_id);
      }
    }
  }

  return NextResponse.json({
    grove,
    pillars: pillars.map((p) => ({ ...p, leaf_count: leafCount.get(p.id) ?? 0, has_knot: knotted.has(p.id) })),
    lantern: extractions[0]?.lantern ?? null,
  });
}

// POST /api/grove — CONTRACT §8
export async function POST(req: Request) {
  const parsed = GroveCreateRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError("invalid_request", z.prettifyError(parsed.error), 400);

  const supabase = supabaseServer();

  const { count, error: countErr } = await supabase
    .from("groves").select("id", { count: "exact", head: true });
  if (countErr) return dbError("check existing grove", countErr);
  if (count) return apiError("grove_exists", "A grove already exists.", 409);

  const { data: grove, error: groveErr } = await supabase
    .from("groves").insert({ goal: parsed.data.goal })
    .select("id, goal, created_at").single<Grove>();
  if (groveErr) return dbError("insert grove", groveErr);

  const { data: pillars, error: pillarsErr } = await supabase
    .from("pillars")
    .insert(parsed.data.pillars.map((p, i) => ({
      grove_id: grove.id, name: p.name, description: p.description, position: i,
    })))
    .select("id, grove_id, name, description, position")
    .order("position")
    .returns<Pillar[]>();
  if (pillarsErr) {
    await supabase.from("groves").delete().eq("id", grove.id); // don't leave a grove without pillars
    return dbError("insert pillars", pillarsErr);
  }

  return NextResponse.json({ grove, pillars });
}

function dbError(step: string, err: unknown) {
  console.error(`grove: ${step} failed`, err);
  return apiError("db_error", `Failed to ${step}.`, 500);
}
