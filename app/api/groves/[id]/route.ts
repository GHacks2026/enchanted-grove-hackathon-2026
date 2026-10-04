import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, demoUserId, switchActiveGrove } from "@/lib/api";
import { supabaseServer } from "@/lib/supabase/server";

// DELETE /api/groves/:id — CONTRACT §8. Removes the grove with its trees and journal entries.
// If it was the active grove, the newest remaining one becomes active.
export async function DELETE(_req: Request, ctx: RouteContext<"/api/groves/[id]">) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return apiError("not_found", "Grove not found.", 404);

  const supabase = supabaseServer();
  const userId = demoUserId();

  const { data: grove, error: groveErr } = await supabase
    .from("groves").select("id, is_active").eq("id", id).eq("user_id", userId)
    .maybeSingle<{ id: string; is_active: boolean }>();
  if (groveErr) return dbError("load grove", groveErr);
  if (!grove) return apiError("not_found", "Grove not found.", 404);

  // Journals first: items reference pillars with no ON DELETE rule, so deleting the grove
  // alone fails once any item exists. Journals cascade to extractions and items; the grove to pillars.
  const { error: journalsErr } = await supabase.from("journals").delete().eq("grove_id", id);
  if (journalsErr) return dbError("delete journal entries", journalsErr);
  const { error: deleteErr } = await supabase.from("groves").delete().eq("id", id);
  if (deleteErr) return dbError("delete grove", deleteErr);

  if (grove.is_active) {
    const { data: next, error: nextErr } = await supabase
      .from("groves").select("id").eq("user_id", userId)
      .order("created_at", { ascending: false }).limit(1).maybeSingle<{ id: string }>();
    if (nextErr) return dbError("find the next grove", nextErr);
    if (next) {
      try {
        await switchActiveGrove(userId, next.id);
      } catch (err) {
        return dbError("switch to the next grove", err);
      }
    }
  }

  return NextResponse.json({ ok: true });
}

function dbError(step: string, err: unknown) {
  console.error(`groves: ${step} failed`, err);
  return apiError("db_error", `Failed to ${step}.`, 500);
}
