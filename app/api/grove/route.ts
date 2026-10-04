import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, demoUserId, switchActiveGrove } from "@/lib/api";
import { GroveCreateRequestSchema } from "@/lib/schemas";
import { supabaseServer } from "@/lib/supabase/server";
import type { Grove, Pillar } from "@/lib/types";

const KNOT_WINDOW_MS = 3 * 24 * 60 * 60 * 1000; // CONTRACT §7: knots fade 3 days after confirmation

// GET /api/grove — CONTRACT §8. The demo user's active grove.
export async function GET() {
  const supabase = supabaseServer();

  const { data: grove, error: groveErr } = await supabase
    .from("groves").select("id, title, goal, is_active, created_at")
    .eq("user_id", demoUserId()).eq("is_active", true).maybeSingle<Grove>();
  if (groveErr) return dbError("load grove", groveErr);
  if (!grove) return apiError("not_found", "No grove exists yet.", 404);

  const { data: pillars, error: pillarsErr } = await supabase
    .from("pillars").select("id, grove_id, name, description, position")
    .eq("grove_id", grove.id).order("position")
    .returns<Pillar[]>();
  if (pillarsErr) return dbError("load trees", pillarsErr);

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

// POST /api/grove — CONTRACT §8. Plants another grove and makes it the active one.
export async function POST(req: Request) {
  const parsed = GroveCreateRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError("invalid_request", z.prettifyError(parsed.error), 400);

  const supabase = supabaseServer();
  const userId = demoUserId();

  // Inserted inactive and switched on only once its trees exist, so a failure keeps the current grove.
  const { data: grove, error: groveErr } = await supabase
    .from("groves").insert({ user_id: userId, title: parsed.data.title, goal: parsed.data.goal, is_active: false })
    .select("id, title, goal, is_active, created_at").single<Grove>();
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
    return dbError("insert trees", pillarsErr);
  }

  try {
    await switchActiveGrove(userId, grove.id);
  } catch (err) {
    return dbError("switch to the new grove", err);
  }

  return NextResponse.json({ grove: { ...grove, is_active: true }, pillars });
}

function dbError(step: string, err: unknown) {
  console.error(`grove: ${step} failed`, err);
  return apiError("db_error", `Failed to ${step}.`, 500);
}
