// Zod schemas. Source of truth: CONTRACT.md §3, §5, §8.
// JSON Schema for the model is derived from these by the AI SDK. Do not hand-write it.
import { z } from "zod";

// ---- LLM output (§3) ----

// pillar_id is restricted to the ids we send, so the schema is built per request.
export const buildExtractionSchema = (pillarIds: [string, ...string[]]) => {
  const pillarId = z.enum(pillarIds);
  return z.object({
    blooms: z.array(z.object({
      interpretation: z.string().min(1),
      evidence_quote: z.string().min(1),
      pillar_id: pillarId,
    })),
    friction: z.array(z.object({
      interpretation: z.string().min(1),
      evidence_quote: z.string().min(1),
      pillar_id: pillarId.nullable(),
    })),
    lantern: z.string().min(1),
  });
};

export type RawExtraction = z.infer<ReturnType<typeof buildExtractionSchema>>;

// ---- Pillar suggestion (§5) ----

export const PillarSuggestionSchema = z.object({
  pillars: z.array(z.object({
    name: z.string().min(1),        // short, 1–3 words
    description: z.string().min(1), // one line
  })).min(4).max(6),
});

// ---- API request bodies (§8) ----

export const PillarSuggestRequestSchema = z.object({
  goal: z.string().trim().min(1),
});

export const GroveCreateRequestSchema = z.object({
  goal: z.string().trim().min(1),
  pillars: z.array(z.object({
    name: z.string().trim().min(1),
    description: z.string(),
  })).min(1),
});

export const JournalRequestSchema = z.object({
  body: z.string().trim().min(1),
});

// Quote fields and status are deliberately absent: the client can never send them.
// "A kept bloom must have a pillar" is enforced by the DB check constraint (-> 400).
export const ConfirmRequestSchema = z.object({
  items: z.array(z.object({
    id: z.string().uuid(),
    action: z.enum(["keep", "delete"]),
    final_interpretation: z.string(),
    final_pillar_id: z.string().uuid().nullable(),
  }).refine(
    (i) => i.action === "delete" || i.final_interpretation.trim().length > 0,
    { message: "final_interpretation is required when action = keep", path: ["final_interpretation"] },
  )),
});
