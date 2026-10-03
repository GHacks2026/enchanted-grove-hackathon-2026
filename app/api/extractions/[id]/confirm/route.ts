import { apiError } from "@/lib/api";

// POST /api/extractions/:id/confirm — CONTRACT §7 (confirm_extraction), §8
export async function POST() {
  return apiError("not_implemented", "POST /api/extractions/:id/confirm", 501);
}
