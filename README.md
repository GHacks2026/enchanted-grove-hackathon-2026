# Sprout

Built for GirlHacks 2026 (NJIT, Oct 3–4). Theme: Enchanted Grove.

Sprout is a journal-first goal tracker. Instead of habit checklists, you write about your day. Sprout finds concrete evidence of progress in your own words, you confirm it, and it grows into a visual Grove.

> "I can finally see that I'm making progress, even when it doesn't feel like it."

## How it works

1. **Set a goal.** AI suggests 4–6 Pillars (areas of progress). You rename, add, or delete them, then confirm. Each Pillar becomes a tree in your Grove.
2. **Reflect on your day.** Write a free-form journal entry.
3. **AI proposes.** It extracts blooms (things you did toward your goal), friction (things that made progress harder), and one small next step.
4. **Code verifies.** Every evidence quote is checked against your journal. Anything that isn't a verbatim match is dropped.
5. **You review.** Edit or delete any interpretation. Nothing counts until you confirm.
6. **The Grove grows.** Each confirmed bloom becomes a leaf on its tree. Recent friction shows as a subtle knot. Tomorrow's Lantern suggests one small next step.

## Features

- **Journal-first input.** Typed free-form entries. No habit setup, forms, or checkboxes.
- **Grounded extraction.** Every bloom and friction item carries a verbatim quote from your entry, validated in code. Our target is a 0% ungrounded quote rate. Validation proves the quote exists, not that the AI read it correctly, so interpretation accuracy is evaluated separately.
- **Human review.** You can edit the interpretation or Pillar, or delete an item. The evidence quote itself can't be changed.
- **Grove.** One tree per Pillar, one leaf per confirmed bloom. No streaks, scores, or wilting. A day without progress is just a day.
- **Evidence Trail.** Click a tree to see a dated, read-only history of your interpretations and exact quotes.
- **Tomorrow's Lantern.** One small, specific next step based on your entry.

Stretch: voice journaling, ElevenLabs reading the Lantern aloud.

## Tech stack

- **App:** Next.js (App Router), TypeScript, React, Tailwind CSS
- **Grove rendering:** custom SVG + Framer Motion
- **Database:** Supabase (Postgres)
- **AI:** Azure OpenAI (gpt-5-mini) via the Vercel AI SDK with Zod schemas
- **Deployment:** Vercel

## Getting started

```bash
git clone https://github.com/GHacks2026/enchanted-grove-hackathon-2026.git
cd enchanted-grove-hackathon-2026
npm install
cp .env.example .env.local   # fill in keys
```

`.env.local` needs five variables, all server-only: `AZURE_RESOURCE_NAME`, `AZURE_API_KEY`, `AZURE_DEPLOYMENT_NAME`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

Run [supabase/schema.sql](supabase/schema.sql) once in the Supabase SQL editor. Then reset and seed the demo grove, and start the app:

```bash
npm run demo:prep   # reset + seed
npm run dev
```

The reset wipes the shared database for everyone.

Tests and checks (the two scripts need `npm run dev` running):

```bash
npx vitest run                  # grounding tests
node scripts/rest-check.mjs     # does rest count as progress?
node scripts/demo-check.mjs     # is the demo journal stable?
```

## Project layout

```
.
├── app/
│   ├── layout.tsx                      # root layout
│   ├── page.tsx                        # Grove home screen
│   ├── globals.css
│   └── api/                            # routes from CONTRACT.md §8
│       ├── grove/route.ts              # GET, POST /api/grove
│       ├── journals/route.ts           # POST /api/journals
│       ├── extractions/[id]/confirm/route.ts
│       └── pillars/
│           ├── suggest/route.ts        # POST /api/pillars/suggest
│           └── [id]/trail/route.ts     # GET /api/pillars/:id/trail
├── components/                         # React UI (Grove, review, trail)
├── docs/
│   ├── CONTEXT.md                      # product rules, MVP scope
│   ├── DECISIONS.md                    # established stack and env
│   └── CONTRACT.md                     # types, prompts, DB schema, API routes
├── lib/
│   ├── types.ts                        # shared types (CONTRACT.md §2)
│   ├── api.ts                          # apiError() — the one error shape
│   └── supabase/
│       └── server.ts                   # service-role client, server only
├── .env.example
├── next.config.ts
├── postcss.config.mjs                  # Tailwind CSS v4
├── tsconfig.json
└── package.json
```

Still to add, per [CONTRACT.md](docs/CONTRACT.md): `eval/` (`entries.json` with 30–50 entries, plus the runner).