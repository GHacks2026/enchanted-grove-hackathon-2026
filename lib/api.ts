import { NextResponse } from "next/server";
import type { ApiError } from "@/lib/types";

// The one error shape every route returns (CONTRACT §8).
export function apiError(code: string, message: string, status: number) {
  return NextResponse.json<ApiError>({ error: { code, message } }, { status });
}
