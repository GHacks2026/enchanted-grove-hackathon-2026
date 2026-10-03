import { apiError } from "@/lib/api";

// GET /api/grove — CONTRACT §8
export async function GET() {
  return apiError("not_implemented", "GET /api/grove", 501);
}

// POST /api/grove — CONTRACT §8
export async function POST() {
  return apiError("not_implemented", "POST /api/grove", 501);
}
