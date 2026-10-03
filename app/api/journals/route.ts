import { apiError } from "@/lib/api";

// Two sequential 30 s model calls in the worst case (CONTRACT §8).
export const maxDuration = 90;

// POST /api/journals — CONTRACT §6, §8
export async function POST() {
  return apiError("not_implemented", "POST /api/journals", 501);
}
