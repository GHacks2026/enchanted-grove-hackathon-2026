# Sprout — Team Contract

Interfaces between teammates. Product intent lives in [CONTEXT.md](CONTEXT.md). Stack and env live in [DECISIONS.md](DECISIONS.md). If this file contradicts either, stop and ask.

**Change rule:** edit this file only via PR, and ping the team when you merge. Code must match this file, not the other way around.

## 0. Ownership

| Area | Owner |
|---|---|
| Prompts + Zod schemas (§3–§5) | Liezeil |
| Grounding validator (§6) | Liezeil |
| DB + API routes (§7–§8) | Kelsey |
| Grove / review UI | Urvi |

## 1. Conventions

- IDs are `uuid`. Timestamps are ISO-8601 strings (`timestamptz` in DB).
- JSON keys are `snake_case` everywhere (DB, API, LLM output).
- Single demo user. No `user_id`, no auth. The server uses the Supabase service-role key. The client never talks to Supabase directly.
- Types live in `lib/types.ts`. Zod schemas live in `lib/schemas.ts`. Prompts live in `lib/prompts.ts`. Nobody redefines these elsewhere.

## 2. Shared types (`lib/types.ts`)

```ts
export type ItemKind = "bloom" | "friction";
export type ItemStatus = "proposed" | "accepted" | "edited" | "deleted";
export type ExtractionStatus = "pending_review" | "confirmed";
export type ReviewAction = "keep" | "delete"; // what the client sends on confirm

export interface Pillar {
  id: string;
  grove_id: string;
  name: string;
  description: string;
  position: number;
}

export interface Grove {
  id: string;
  goal: string;
  created_at: string;
}

export interface Journal {
  id: string;
  grove_id: string;
  body: string;
  created_at: string;
}

export interface Item {
  id: string;
  extraction_id: string;
  kind: ItemKind;
  original_interpretation: string;
  original_pillar_id: string | null; // null only when kind = "friction"
  final_interpretation: string;      // starts equal to original
  final_pillar_id: string | null;    // null only when kind = "friction" (or a deleted item)
  evidence_quote: string;            // immutable, verbatim from journal
  quote_start: number;               // offsets into normalize(journal.body), see §6
  quote_end: number;
  status: ItemStatus;                // "proposed" until confirm; set by the server, never the client
}

export interface Extraction {
  id: string;
  journal_id: string;
  lantern: string;
  status: ExtractionStatus;
  created_at: string;
  confirmed_at: string | null;
}
```

## 3. LLM extraction schema (`lib/schemas.ts`)

Zod is the single source. The JSON Schema is derived from it (the AI SDK does this). Do not hand-write JSON Schema.

`pillar_id` is restricted to the ids we send, so the schema is built per request.

```ts
import { z } from "zod";

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
```

Rules:
- Both arrays may be empty. An empty `blooms` array is a valid, expected answer.
- `lantern` is always present, even when both arrays are empty.
- No confidence scores, no mood/energy, no extra fields.

Model call settings are in DECISIONS.md (Azure deployment `gpt-5-mini`, reasoning effort `minimal`, no `temperature`).

## 4. Extraction prompt (`lib/prompts.ts`)

**System prompt**

```
You are Sprout's extraction engine. You read one journal entry and propose
evidence of progress, friction, and one small next step. A human will review
everything you return, and code will check every quote against the journal.

DEFINITIONS
- bloom: concrete evidence the user DID something related to their goal.
- friction: something the user explicitly said got in the way of their goal, or something they said they put off or didn't get to. Rest, sleep, doubts, and plans for later are NOT friction on their own.
- Reflection, rest, recovery, or feelings are NOT blooms. No concrete action = no bloom.

RULES
1. evidence_quote MUST be copied character-for-character from the journal.
   Do not paraphrase, fix typos, merge sentences, or add ellipses. Pick the
   shortest span that supports the item.
2. interpretation is one short plain sentence describing what the quote shows.
   Use only what the user wrote. Never infer emotions, motivations, or causes
   the user did not state.
   Use only what the user wrote. Never infer emotions, motivations, or causes
   the user did not state. Do not add consequences or contrasts the user did
   not write, such as "which made progress harder" or "instead of preparing".
3. Extract every clearly grounded, distinct bloom. Do not split one action into
   several blooms. Do not merge unrelated actions into one.
4. Assign each bloom to exactly one pillar_id from the provided list.
   A friction item gets a pillar_id only if one clearly applies, otherwise null.
5. If nothing qualifies, return empty arrays. Never invent progress.
6. Do not shame, judge, or frame a no-progress day as failure.
7. lantern: one specific, realistic, small next step (under ~20 minutes) related
   to the user's goal and informed by the journal. Not a bloom.
```

**User message template**

```
GOAL: {goal}

PILLARS:
- {pillar.id}: {pillar.name} — {pillar.description}
...

JOURNAL:
"""
{journal.body}
"""
```

**Retry addendum** (appended as an extra user message on the single retry):

```
These evidence_quote values were NOT found verbatim in the journal:
- "{failed_quote_1}"
- "{failed_quote_2}"
Return the full extraction again. Every evidence_quote must be an exact
character-for-character copy from the journal. If an item cannot be supported
by an exact quote, leave it out.
```

## 5. Pillar suggestion (onboarding)

```ts
export const PillarSuggestionSchema = z.object({
  pillars: z.array(z.object({
    name: z.string().min(1),        // short, 1–3 words
    description: z.string().min(1), // one line
  })).min(4).max(6),
});
```

**System prompt**

```
You help a person break a long-term goal into 4-6 pillars: distinct areas of
meaningful progress. Each pillar should be something a person could plausibly
write about in a daily journal. Names are short (1-3 words). Descriptions are
one plain sentence. Pillars must not overlap heavily. Use the user's own words
for the goal where possible.
```

User message: `GOAL: {goal}`. Same model settings as §3. The user can rename, edit, add, or delete before confirming (UI concern, no extra contract).

## 6. Grounding validation (`lib/grounding.ts`)

```ts
normalize(s: string): string
```
1. Replace curly quotes `“ ” ‘ ’` with `" "  ' '`.
2. Collapse every run of whitespace (including newlines) to one space.
3. Trim.

No lowercasing. No punctuation stripping. No stemming.

```ts
findQuote(journalBody: string, quote: string): { start: number; end: number } | null
```
- Returns the first index of `normalize(quote)` inside `normalize(journalBody)`, or `null`.
- Offsets refer to `normalize(journalBody)`. The UI must highlight against that same string.
- Stored `evidence_quote` is the **normalized** quote (so it always substring-matches the normalized body).

**Pipeline** (in the `POST /api/journals` handler)

Nothing is written to the database until the model has returned. A failed call leaves no rows behind, so a client retry never creates a duplicate journal.

1. Validate the request body. Load the grove and its pillars.
2. Call the model. Keep the exact result in memory (this becomes `extractions.raw_json`).
3. Run `findQuote` on every bloom and friction item.
4. If any failed, call the model **once** more with the retry addendum from §4.
5. Re-validate. Items that still fail are **dropped**. They go into `extractions.dropped_json` (items dropped from the final attempt only) and are never returned to the client. The `lantern` comes from the same attempt the items came from (the retry if it succeeded, otherwise the first call).
6. Do not repair a failed quote by finding "similar" text.
7. If the retry call itself errors, treat all failed items from step 3 as dropped, continue with the items that passed, and use the first call's lantern.
8. If the **first** call errors or times out, return 502. Nothing is saved.
9. Only now insert, in this order: `journals` → `extractions` → `items`.

The stored quote is the normalized form, so it can differ from the journal only in quote marks and whitespace. The UI shows it as stored.

Required unit tests: exact match, curly vs straight quote, extra whitespace/newline, paraphrase (must fail), quote not in journal (must fail), empty quote (must fail), quote appearing twice (first index).

We claim a **0% ungrounded quote rate**. We do not claim 0% hallucination (CONTEXT §5).

## 7. Database schema (Supabase / Postgres)

```sql
create table groves (
  id uuid primary key default gen_random_uuid(),
  goal text not null,
  created_at timestamptz not null default now()
);

create table pillars (
  id uuid primary key default gen_random_uuid(),
  grove_id uuid not null references groves(id) on delete cascade,
  name text not null,
  description text not null default '',
  position int not null
);

create table journals (
  id uuid primary key default gen_random_uuid(),
  grove_id uuid not null references groves(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table extractions (
  id uuid primary key default gen_random_uuid(),
  journal_id uuid not null references journals(id) on delete cascade,
  raw_json jsonb not null,          -- model output exactly as returned (first attempt)
  dropped_json jsonb,               -- items that failed grounding after retry
  lantern text not null,
  status text not null default 'pending_review'
    check (status in ('pending_review','confirmed')),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create table items (
  id uuid primary key default gen_random_uuid(),
  extraction_id uuid not null references extractions(id) on delete cascade,
  kind text not null check (kind in ('bloom','friction')),
  original_interpretation text not null,
  original_pillar_id uuid references pillars(id),
  final_interpretation text not null,
  final_pillar_id uuid references pillars(id),
  evidence_quote text not null,     -- immutable after insert
  quote_start int not null,
  quote_end int not null,
  status text not null default 'proposed'
    check (status in ('proposed','accepted','edited','deleted')),
  -- a bloom must have a pillar unless it is deleted
  check (
    kind = 'friction'
    or status = 'deleted'
    or (original_pillar_id is not null and final_pillar_id is not null)
  )
);

create index on items (extraction_id);
create index on items (final_pillar_id);
create index on extractions (confirmed_at);
```

### Confirm function

Confirm runs as one database function so it either fully saves or not at all. It is the only code path that flips an extraction to `confirmed`. The API calls it with `supabase.rpc('confirm_extraction', ...)`.

```sql
create or replace function confirm_extraction(p_extraction_id uuid, p_items jsonb)
returns void
language plpgsql
as $$
declare
  v_expected int;
  v_matched  int;
begin
  -- 1. Flip the extraction. The row lock makes a double-click wait, then find
  --    status already 'confirmed', so it updates nothing.
  update extractions
     set status = 'confirmed', confirmed_at = now()
   where id = p_extraction_id and status = 'pending_review';

  if not found then
    if exists (select 1 from extractions where id = p_extraction_id) then
      raise exception 'already_confirmed' using errcode = 'SP409';
    else
      raise exception 'not_found' using errcode = 'SP404';
    end if;
  end if;

  -- 2. The client must send every item of this extraction, each exactly once.
  select count(*) into v_expected from items where extraction_id = p_extraction_id;

  select count(distinct i.id) into v_matched
    from jsonb_to_recordset(p_items) as e(id uuid)
    join items i on i.id = e.id and i.extraction_id = p_extraction_id;

  if v_matched <> v_expected or jsonb_array_length(p_items) <> v_expected then
    raise exception 'item_mismatch' using errcode = 'SP400';
  end if;

  -- 3. Apply decisions. The server decides accepted vs edited by comparing to
  --    the original. Deleted items keep their previous final_* values.
  update items i
     set status = case
           when e.action = 'delete' then 'deleted'
           when e.final_interpretation is distinct from i.original_interpretation
             or e.final_pillar_id is distinct from i.original_pillar_id then 'edited'
           else 'accepted'
         end,
         final_interpretation = case when e.action = 'delete'
           then i.final_interpretation else e.final_interpretation end,
         final_pillar_id = case when e.action = 'delete'
           then i.final_pillar_id else e.final_pillar_id end
    from jsonb_to_recordset(p_items)
         as e(id uuid, action text, final_interpretation text, final_pillar_id uuid)
   where i.id = e.id and i.extraction_id = p_extraction_id;
end;
$$;
```

Any exception inside the function rolls back everything it did, including the status flip in step 1.

Notes:
- `items` rows are inserted when `POST /api/journals` returns (status `proposed`). They are not visible to the Grove or trail until their extraction is `confirmed`.
- Deleted items stay in the table for evaluation. Every read query for Grove/trail filters `status <> 'deleted'` and `extractions.status = 'confirmed'`.
- If a retry happened, `raw_json` holds the **first** attempt. The retried output is what populates `items`.
- Single demo user: seed one grove for the demo. RLS is off. Never expose the service-role key to the client.

**Derived, not stored**
- Leaf count per pillar = confirmed, non-deleted `bloom` items with that `final_pillar_id`.
- Knot on a pillar = at least one confirmed, non-deleted `friction` item with that `final_pillar_id` and `extractions.confirmed_at` within the last **3 days**. Friction with a null pillar draws no knot.
- Current lantern = `lantern` of the most recent `confirmed` extraction.

## 8. API routes (Next.js App Router, `app/api/...`)

All routes: JSON in, JSON out. Errors use one shape:

```ts
type ApiError = { error: { code: string; message: string } };
```

| Status | When |
|---|---|
| 400 | Invalid body (Zod parse failure), or `SP400` / check-constraint error from `confirm_extraction` |
| 404 | Unknown id (including `SP404` from `confirm_extraction`) |
| 409 | Extraction already confirmed (`SP409` from `confirm_extraction`), or a grove already exists on `POST /api/grove` |
| 502 | LLM call failed after our handling |
| 500 | Anything else |

### `POST /api/pillars/suggest`
- Req: `{ goal: string }`
- Res: `{ pillars: { name: string; description: string }[] }`

### `POST /api/grove`
Creates the grove after the user confirms pillars. Returns 409 if a grove already exists. To redo onboarding in the demo, run the reset script in `seed/` (clears the database).
- Req: `{ goal: string; pillars: { name: string; description: string }[] }`
- Res: `{ grove: Grove; pillars: Pillar[] }`

### `GET /api/grove`
Home screen data (the single demo grove).
- Res:
```ts
{
  grove: Grove;
  pillars: (Pillar & { leaf_count: number; has_knot: boolean })[];
  lantern: string | null;
}
```
- 404 if no grove exists yet (client routes to onboarding).

### `POST /api/journals`
Runs extraction + grounding (§6), then saves the journal, extraction, and items.
- Req: `{ body: string }`
- Res:
```ts
{
  extraction_id: string;
  items: Item[];        // grounded only; may be empty
  lantern: string;      // client holds this until after confirm
}
```
- Takes a few seconds. Set `export const maxDuration = 90` on this route (two sequential 30 s model calls in the worst case). The client shows a loading state. Empty `items` is a valid success (no-progress entry).
- On 502 nothing is saved. The client keeps the typed text and can resend it.

### `POST /api/extractions/:id/confirm`
Sends the reviewed list once. This is the only route that makes anything count.
- Req:
```ts
{
  items: {
    id: string;
    action: ReviewAction;            // "keep" | "delete"
    final_interpretation: string;    // required (non-empty) when action = "keep"
    final_pillar_id: string | null;  // required for a kept bloom
  }[];
}
```
- The client never sends `status`. The server derives it: `delete` → `deleted`; `keep` with a changed interpretation or pillar → `edited`; otherwise `accepted`.
- Server rules: validate with Zod first; ignore/reject any quote fields; require every item of the extraction to be present exactly once; call `confirm_extraction` (§7).
- Res: `{ confirmed: Item[]; lantern: string }` (`confirmed` excludes deleted items; the UI animates one leaf per bloom in it).
- 409 if called twice.

### `GET /api/pillars/:id/trail`
Evidence Trail, read-only.
- Res:
```ts
{
  pillar: Pillar;
  entries: {
    item_id: string;
    kind: ItemKind;
    date: string;                 // extraction.confirmed_at
    interpretation: string;       // final_interpretation
    evidence_quote: string;
  }[];                            // newest first, confirmed + non-deleted only
}
```
- Clicking a leaf uses this endpoint: the UI shows the matching bloom entry (there is no separate leaf route). One bloom entry = one leaf.
- MVP shows blooms in the trail. Friction entries are returned with `kind: "friction"` so the UI may choose to hide or style them.

## 9. Invariants (do not break)

1. No leaf, knot, or trail entry exists before the extraction is confirmed.
2. `evidence_quote`, `quote_start`, `quote_end` are never writable by the client.
3. Nothing ungrounded reaches the client. The review UI only ever sees validated items.
4. AI output is never auto-accepted. Only `confirm_extraction` flips status.
5. Deleted items are stored but never returned by Grove or trail.
6. Confirmed records are read-only in the MVP (no edit route exists).
7. No streaks, scores, or wilting (CONTEXT §3, §13).
8. Item `status` is decided by the server, never sent by the client.

## 10. Other agreements

**Error and empty states**
- Extraction fails (502) → UI shows a retry button and keeps the typed journal. Nothing is saved on the server, so retrying does not create duplicates.
- Zero grounded items → UI acknowledges the entry gently, still reveals the lantern after the user continues. No leaf.
- LLM call timeout: 30 seconds.

**Mocks**
- Each route has a fixture in `mocks/{route-name}.json` matching §8 exactly, so frontend can build before backend exists. The first mock to write is `POST /api/journals` with 3 blooms, 1 friction, and 1 lantern.

**Demo data**
- One seeded grove and a golden demo journal live in `seed/`. The demo journal must produce a clean multi-bloom extraction. Test it before each demo run.

**Eval set** (`eval/entries.json`, 30–50 entries)
```ts
{
  id: string;
  pillars: { id: string; name: string }[];
  journal: string;
  expected_blooms: { evidence_quote: string; pillar_id: string }[];
  expected_friction: { evidence_quote: string; pillar_id: string | null }[];
}[]
```
Grounding is measured deterministically with `findQuote`. A predicted item matches an expected one when their normalized quotes overlap (one contains the other); pillar assignment is correct when the matched `pillar_id`s are equal. Lantern is not scored.

**Env and secrets**
- Variables are listed in DECISIONS.md. `.env.local` is gitignored. All keys are server-only.

**Out of contract (MVP)**
- Mood/energy extraction, Google Calendar export, voice input, post-confirm editing, reprocessing, personalization from corrections.
