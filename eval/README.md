# Sprout eval: what it is and how to build it

**Owner:** Kelsey. **Goal for tonight:** a labeled set of journal entries plus a script that scores the AI against them.

## Why this exists

Our pitch makes two separate claims:

1. **Grounding:** every evidence quote Sprout shows really comes from the user's journal. Target: **0% ungrounded quote rate**.
2. **Interpretation:** Sprout finds the right blooms and friction and puts blooms on the right pillar.

Claim 1 is checked by code (`findQuote`). Claim 2 needs a human answer key, which is what you're writing. We report the two **separately** and never merge them into one "hallucination rate" (CONTEXT §5, §10).

You are **not** changing the app, the prompt, or the database tonight. You're writing test data and a scoring script.

## Part 1: The answer key (`eval/entries.json`)

An array of entries. Each one is a journal plus what a careful human says Sprout *should* extract. Format (CONTRACT §10):

```json
[
  {
    "id": "e01",
    "pillars": [
      { "id": "apps",  "name": "Applications" },
      { "id": "prep",  "name": "Interview Prep" },
      { "id": "proj",  "name": "Projects" },
      { "id": "net",   "name": "Networking" },
      { "id": "res",   "name": "Resume" }
    ],
    "journal": "Applied to two internships on Handshake. Spent the evening on the couch. I wanted to fix my resume formatting but Word kept crashing.",
    "expected_blooms": [
      { "evidence_quote": "Applied to two internships on Handshake.", "pillar_id": "apps" }
    ],
    "expected_friction": [
      { "evidence_quote": "I wanted to fix my resume formatting but Word kept crashing.", "pillar_id": "res" }
    ]
  }
]
```

Pillar ids can be short words like `apps`. They only need to be unique within an entry.

### Labeling rules

Label what a careful human would say, not what you think the AI will say.

- **Bloom:** the user *did* something concrete toward the goal. One bloom per distinct action. Don't split one action, don't merge unrelated ones.
- **Friction:** the user *said* something got in the way, or that they put something off or didn't get to it.
- **Not a bloom:** rest, sleep, feelings, plans, intentions ("I'll do it tomorrow"), and thinking about something.
- **Not friction on its own:** rest, sleep, doubts, plans for later.
- **`evidence_quote`** must be copied exactly from the journal: the shortest span that supports the item. The runner checks this and will flag any typo.
- **`pillar_id`:** every bloom gets one. Friction gets one only if it clearly applies, otherwise `null`.

### What to include (aim for 30; 15 is acceptable if time runs short)

| Kind of entry | How many | Example |
|---|---|---|
| Several blooms on different pillars | ~8 | "Applied to X, did 2 practice problems, messaged an alum." |
| One bloom | ~6 | "Fixed the navbar bug on my portfolio." |
| Rest / feelings / plans only (0 blooms) | ~6 | "Took a rest day." / "I'll start LeetCode tomorrow." |
| Rest plus one real action | ~4 | "Napped most of the day but finished one practice problem." |
| Friction only | ~3 | "Kept getting distracted and never opened my resume." |
| Tricky pillar choice | ~3 | Practice problems → Interview Prep, not Projects. |

Use a mix of goals, not only the internship goal. For example: "Run a half marathon", "Learn Spanish", "Launch a small Etsy shop". Each needs its own 4–5 pillars. The 8 journals in `scripts/rest-check.mjs` can be reused as entries.

Write journals like real people do: casual, a few sentences, the occasional typo. Typos are fine, because quotes must copy them exactly.

## Part 2: The runner (`eval/run.ts`)

For each entry, the runner calls the **same extraction + grounding function the app uses** (named in DECISIONS.md, "Data and scripts") with that entry's goal, pillars, and journal. It must **not** go through the API or touch the database: the API only allows one grove, and the database is shared with the live demo.

Run it with: `npx tsx eval/run.ts`

### Matching

A predicted item matches an expected one when they are the same kind (bloom/friction) and their normalized quotes overlap: one contains the other (CONTRACT §10). Each expected item can be matched at most once.

### What it reports

**Grounding** (deterministic):
- **Ungrounded quote rate** = shown quotes that fail `findQuote` ÷ all shown quotes. Should be **0%**. If it isn't, that's a bug; tell Liezeil immediately.
- Also print how many items the pipeline **dropped** after the retry, and how many entries needed a **retry**. These show the validator doing its job.

**Interpretation** (against your answer key):
- **Bloom recall** = expected blooms that were found ÷ all expected blooms. ("Did it miss real progress?")
- **Bloom precision** = predicted blooms that match an expected one ÷ all predicted blooms. ("Did it invent progress?") **This is the most important number for our pitch.**
- **Pillar accuracy** = matched blooms on the right pillar ÷ matched blooms.
- **No-progress accuracy** = entries with 0 expected blooms that got 0 predicted blooms ÷ such entries.
- **Friction recall and precision**, same as for blooms.

Lantern is not scored.

At the end, print a short summary table, plus a list of every mismatch (entry id, expected vs. predicted, with quotes) so we can see *why* something failed. Save the full results to `eval/results.json`.

## Done means

- [x] `eval/entries.json` has 30 entries (15 minimum), and every expected quote passes `findQuote`. The runner checks this first and stops if one fails.
- [x] `npx tsx --env-file=.env.local eval/run.ts` runs end to end and prints the summary.
- [x] Results are committed and the summary numbers are posted in the team chat.

Don't tune the prompt to make the numbers look better. If something scores badly, tell Liezeil, and prompt changes go through a CONTRACT PR.

## Prompt you can give Claude Code

```
Read CLAUDE.md, the docs (CONTEXT, DECISIONS, CONTRACT), and eval/README.md.
Build eval/run.ts exactly as eval/README.md Part 2 describes. Use the extraction + grounding
function named in DECISIONS.md "Data and scripts", and findQuote/normalize from lib/grounding.ts.
Do not call the API or touch Supabase. Do not change any app code or prompts.
First, validate every expected quote in eval/entries.json with findQuote and stop with a clear
error if any fail. Then run each entry, match predictions to expectations per the README,
and print the summary and the mismatch list, saving everything to eval/results.json.
Check: run it on the first 3 entries (add a --limit flag) and show me the output.
```

Write the entries yourself (or with Claude helping you draft journals), but **check every label by hand**. The answer key has to be human judgment, or the eval doesn't mean anything.

## Running the Evaluation

To execute the benchmark suite against `eval/entries.json`:

```bash
# Run all entries
npx tsx --env-file=.env.local eval/run.ts

# Run a quick test on the first N entries
npx tsx --env-file=.env.local eval/run.ts --limit 3
