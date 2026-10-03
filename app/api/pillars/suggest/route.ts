import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { generateStructured } from "@/lib/llm";
import { PILLAR_SYSTEM_PROMPT, buildPillarUserMessage } from "@/lib/prompts";
import { PillarSuggestRequestSchema, PillarSuggestionSchema } from "@/lib/schemas";

// POST /api/pillars/suggest — CONTRACT §5, §8
export async function POST(req: Request) {
  const parsed = PillarSuggestRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError("invalid_request", z.prettifyError(parsed.error), 400);

  try {
    const { pillars } = await generateStructured({
      schema: PillarSuggestionSchema,
      system: PILLAR_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildPillarUserMessage(parsed.data.goal) }],
    });
    return NextResponse.json({ pillars });
  } catch (err) {
    console.error("pillar suggestion failed", err);
    return apiError("llm_failed", "Pillar suggestion failed. Please try again.", 502);
  }
}
