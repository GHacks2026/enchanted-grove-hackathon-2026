// Azure model helper. Settings: DECISIONS.md "Model settings", CONTRACT.md §10 (30 s timeout).
// Uses generateText + Output.object (generateObject is deprecated in ai v7).
import { createAzure, type OpenAILanguageModelResponsesOptions } from "@ai-sdk/azure";
import { generateText, Output, type ModelMessage } from "ai";
import type { z } from "zod";

const azure = createAzure({
  resourceName: process.env.AZURE_RESOURCE_NAME,
  apiKey: process.env.AZURE_API_KEY,
});

// Throws on API error, timeout, or schema-invalid output. Callers map that to 502.
export async function generateStructured<T>(opts: {
  schema: z.ZodType<T>;
  system: string;
  messages: ModelMessage[];
}): Promise<T> {
  const { output } = await generateText({
    model: azure(process.env.AZURE_DEPLOYMENT_NAME!),
    system: opts.system,
    messages: opts.messages,
    output: Output.object({ schema: opts.schema }),
    // No temperature: reasoning models don't support it.
    providerOptions: {
      azure: { reasoningEffort: "minimal" } satisfies OpenAILanguageModelResponsesOptions,
    },
    timeout: 30_000, // total, including the SDK's internal retries
  });
  return output;
}
