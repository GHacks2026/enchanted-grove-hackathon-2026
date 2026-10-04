import { NextResponse } from "next/server";
import { apiError, demoUserId, getUserGroves } from "@/lib/api";

// GET /api/groves — CONTRACT §8. Every grove the demo user has planted, newest first.
export async function GET() {
  try {
    return NextResponse.json({ groves: await getUserGroves(demoUserId()) });
  } catch (err) {
    console.error("groves: load groves failed", err);
    return apiError("db_error", "Failed to load groves.", 500);
  }
}
