import { apiError } from "@/lib/api";

// GET /api/pillars/:id/trail — CONTRACT §8
export async function GET() {
  return apiError("not_implemented", "GET /api/pillars/:id/trail", 501);
}
