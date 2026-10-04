import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, demoUserId, switchActiveGrove } from "@/lib/api";

// POST /api/groves/:id/activate — CONTRACT §8. Makes this grove the one the home screen shows.
export async function POST(_req: Request, ctx: RouteContext<"/api/groves/[id]/activate">) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return apiError("not_found", "Grove not found.", 404);

  try {
    await switchActiveGrove(demoUserId(), id);
  } catch (err) {
    // set_active_grove raises SP404 when the grove isn't this user's.
    if ((err as { code?: string }).code === "SP404") return apiError("not_found", "Grove not found.", 404);
    console.error("groves: switch grove failed", err);
    return apiError("db_error", "Failed to switch groves.", 500);
  }
  return NextResponse.json({ ok: true });
}
