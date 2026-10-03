# Sprout — Established Decisions

These decisions are final for the hackathon. Treat them as established. Ask before changing any of them.

## Stack

| Layer | Decision |
|---|---|
| Framework | Next.js (App Router) + TypeScript |
| UI | React, Tailwind CSS |
| Database | Supabase (Postgres) |
| LLM provider | Azure OpenAI (Microsoft Foundry) |
| Model | gpt-5-mini, deployment name `gpt-5-mini` |
| LLM client | Vercel AI SDK (`ai`, `@ai-sdk/azure`) with Zod schemas (`generateObject`) |
| Grove rendering | Custom SVG + Framer Motion |
| Deployment | Vercel |
| Auth | None. Single demo user. |
| Journaling input | Typed text only (voice is a stretch feature) |

## Why

- **Azure OpenAI:** the event has an Avanade "Best Use of Azure" sponsor track. The grounded extraction pipeline runs on Azure.
- **AI SDK + Zod:** typed, schema-validated output with no hand-written JSON parsing. Swapping providers is a one-line change if needed.
- **Vercel instead of Azure hosting:** simpler and more reliable for Next.js. Azure powers the AI pipeline, which is what matters for the sponsor track.
- **No auth:** saves hours and isn't part of the product story.

## Model settings

- Reasoning effort: `minimal` (fall back to `low` if extraction quality suffers). Keeps demo latency low.
- Do **not** pass `temperature`. Reasoning models don't support it.
- Control behavior through the system prompt and the Zod schema.

## Environment variables

```
AZURE_RESOURCE_NAME=
AZURE_API_KEY=
AZURE_DEPLOYMENT_NAME=gpt-5-mini
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

`.env.local` must be in `.gitignore` before the first commit. All variables are server-only (the client never talks to Supabase or Azure directly, see CONTRACT §1). Never use a `NEXT_PUBLIC_` prefix.

## Event context

- GirlHacks 2026, NJIT, Oct 3–4. 24-hour in-person hackathon. Theme: Enchanted Grove.
- Target tracks: Whimsical Wonders (on-theme), Best Use of Azure by Avanade, Diversity.
- Stretch only: ElevenLabs reading the Lantern aloud.
