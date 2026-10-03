# Sprout — Core Project Context

Source of truth for what Sprout is and how it behaves. Stack and env live in [DECISIONS.md](DECISIONS.md). Interfaces (types, prompts, schema, API) live in [CONTRACT.md](CONTRACT.md). Pitch, demo scripting, and judging strategy live elsewhere and must not change requirements here.

## 1. Product

Sprout is a journal-first app that helps users see evidence that they are making progress toward a long-term goal, especially when it doesn't feel like it.

The user writes about their day. Sprout finds concrete evidence of progress and friction in their words, the user confirms it, and confirmed progress grows into a visual Grove.

> "I can finally see that I'm making progress, even when it doesn't feel like it."

Sprout must help users recognize real progress without manufacturing progress that didn't happen.

## 2. Model and metaphor

The user's goal becomes a **Grove**. During onboarding, AI proposes about 4–6 **Pillars** (areas of progress), each shown as a tree. The user can rename, edit, add, or delete Pillars before confirming.

| Concept | Grove representation |
|---|---|
| Goal | Grove / seed |
| Pillar | Tree |
| Confirmed bloom | Leaf |
| Friction | Knot |
| Tomorrow's next step | Lantern |
| User correction | Pruning |

The metaphor makes progress tangible. It is not a game, and UI language stays plain (CTA: **Reflect on your day**, not "Whisper to the Grove").

## 3. Principles

- **Evidence over assumption.** Never invent progress, friction, emotions, motivations, or causes the user didn't state. Every interpretation must trace back to the user's words.
- **Acknowledge without judgment.** Setbacks and friction may be surfaced when grounded in the entry. Never shame, punish inactivity, or frame a no-progress day as failure. Trees never wilt.
- **Journal-first.** For the MVP, evidence comes only from journal entries, not habits, checkboxes, sliders, or manual logging. Future sources are fine if they stay evidence-based.
- **Experienced, not scored.** The Grove and Evidence Trail are the representation of progress. Avoid streaks, XP, arbitrary scores, levels, leaderboards, and completion percentages.

## 4. What counts

**Bloom** is concrete evidence the user did something related to their goal. One confirmed bloom creates one leaf.

> Journal: "I spent an hour rewriting the introduction to my portfolio case study."
> Bloom: *Reworked portfolio case study introduction* (Pillar: Portfolio)
> Evidence: the quote above.

**Friction** is something the user explicitly said made progress harder. It never creates a leaf.

> Journal: "I kept putting off working on my portfolio."
> Valid: *Getting started on the portfolio was difficult.*
> Invalid: *You avoided your portfolio because you were overwhelmed.* (The user never said overwhelmed.)

**Reflection, rest, and recovery** can be acknowledged but are not converted into progress. No concrete action = no leaf.

**Multiple blooms.** One entry can hold several distinct blooms (for example "finished my homepage, practiced two interview problems, emailed a recruiter" = three blooms across Pillars). Extract every clearly grounded, distinct bloom. Each has its own evidence, is reviewed on its own, and makes its own leaf. Don't merge unrelated actions, and don't split one action to inflate progress.

**Leaves are unweighted.** A small action and a large one each make one leaf. A leaf means "this happened", not how important it was.

**No-progress entries.** No bloom means no leaf. Sprout may still show grounded friction and the Lantern, and gently acknowledges the entry without framing the absence of a leaf as punishment.

## 5. Grounded AI pipeline

Grounding is the central technical principle:

> **AI proposes → code validates → human reviews → confirmed evidence enters the Grove**

Every bloom and friction item has a concise interpretation, a verbatim evidence quote, and a Pillar when applicable.

Validation (details in CONTRACT §6):

1. Code checks that the quote exists in the journal. The model's word is not trusted.
2. If any quote fails, retry the extraction once, telling the model which quotes failed.
3. Items that still fail are dropped and never shown. Never swap in "similar" journal text.

**Claim:** we target a **0% ungrounded quote rate**. Never say "0% hallucinations". Validation proves the quote exists, not that the AI interpreted it correctly, which is evaluated separately (§10). An LLM confidence score is not proof.

## 6. Human review and confirmation

AI extraction is a proposal. Both blooms and friction are reviewable. The user can:

- **Edit** the interpretation or the assigned Pillar.
- **Delete** the item. Deleted blooms make no leaf, and deleted friction makes no knot.

The evidence quote can't be edited. The user changes what Sprout thinks the evidence means, not the evidence itself.

Nothing enters the Grove until the user confirms. On confirmation, each accepted bloom becomes a leaf, friction may show as a knot, final interpretations are saved, and the Evidence Trail updates. Confirmed records are read-only in the MVP (no post-confirm editing, moving leaves, or reprocessing).

## 7. Lantern

Tomorrow's Lantern is one small next step: specific, realistic, related to the goal, informed by the journal, and approachable. It never creates a leaf.

It is generated in the same LLM call as blooms and friction, and revealed after review and confirmation. Lantern quality isn't part of the formal evaluation.

## 8. Grove experience

The Grove is the home screen. It shows the goal, one tree per Pillar, a leaf per confirmed bloom, subtle knots for recent friction, the current Lantern, and a clear **Reflect on your day** CTA.

- **Knots** show recent friction on a Pillar and don't accumulate like leaves. A knot fades after a fixed window (3 days from confirmation, see CONTRACT §7). Sprout doesn't judge whether the problem was "resolved". Historical friction is still stored.
- **Leaves:** selecting a leaf shows its evidence.
- **Evidence Trail:** selecting a tree opens a simple, read-only, chronological list of date, interpretation, and exact quote. It answers "What evidence do I actually have that I'm moving toward this part of my goal?" No dashboards, graphs, filters, AI summaries, or analytics unless time permits.

## 9. User flow

**Onboarding:** enter a goal → AI suggests 4–6 Pillars → user edits and confirms → Grove created.

**Daily reflection:**

1. User selects **Reflect on your day** and writes a journal entry.
2. The server calls the model for structured extraction (blooms, friction, Lantern).
3. Quotes are validated, with one retry on failure and unsupported items dropped.
4. The journal, raw model output, and grounded items are saved. Nothing is saved if the first model call fails.
5. User reviews, edits or deletes items, and confirms.
6. Final interpretations are saved.
7. Confirmed blooms animate as leaves onto their trees, one at a time. Recent friction can appear as knots.
8. The Lantern is revealed, and the user returns to the updated Grove.

**Core visual moment:** journal → grounded evidence → confirmation → leaf grows into the Grove. For each bloom, the bloom turns into a leaf, travels to its tree, lands, the tree responds subtly, then the next bloom starts. This should be the most polished interaction in the MVP. No elaborate environmental animation is needed.

## 10. Data and evaluation

**Preserve** the original journal, the raw model output, each item's original and final interpretation and Pillar, and its status (accepted, edited, deleted). Deleted items stay stored for evaluation but never appear in the Grove or trail. Corrections are collected but not yet used for personalization. Don't claim Sprout "learns the user". Schema is in CONTRACT §7.

**Evaluate grounding and interpretation separately:**

- **Grounding** (deterministic): every displayed quote must pass validation. Target 0% ungrounded quote rate.
- **Interpretation:** build about 30–50 labeled journal entries with expected blooms, friction, evidence, and Pillar assignments. Measure extraction quality and Pillar assignment. Don't merge this with grounding into a vague "hallucination rate", and don't score the Lantern.

## 11. MVP scope

**Required:** onboarding (goal → Pillars → Grove), daily use (journal → extraction → grounding → review → confirm → leaves/knots → Lantern), read-only Evidence Trail per tree, verbatim quotes with deterministic validation and one retry, and persistence of journal, raw extraction, corrections, final interpretations, and Grove state.

**Not required** (stretch only if the core demo is done): voice or speech-to-text (if added, use simple browser speech-to-text), personalization from corrections, post-confirm editing, journal reprocessing, analytics, trail search or filters, long-term Grove scaling, elaborate weather or environmental animation, social features, streaks, gamification.

## 12. Working on Sprout

Priority order if time is short:

1. A complete end-to-end flow (goal → Grove → journal → grounded extraction → review → growth).
2. A polished journal-to-leaf moment.
3. Grounding that genuinely works.
4. A reliable demo path.
5. Deeper infrastructure and evaluation.

Don't spend hackathon time on infrastructure that doesn't improve the demo or support the grounding claim.

Claude may make normal implementation and small UX decisions independently. Claude must ask before replacing an established technology, making a major architectural change, adding a significant dependency, restructuring the data model, changing the grounding pipeline, changing core product behavior, or adding scope that materially threatens the timeline. Established decisions are in DECISIONS.md.

## 13. Failure modes to avoid

- Inventing progress so the Grove grows.
- Inferring emotions or causes the user didn't express.
- Turning reflection or recovery into progress automatically.
- Presenting paraphrased text as a verbatim quote, or letting unvalidated evidence into review.
- Auto-accepting AI interpretations, or creating leaves before confirmation.
- Treating a confidence score as proof, or describing substring validation as eliminating hallucinations.
- Wilting trees, unnecessary gamification, or metaphor that hurts usability.
- Over-engineering stretch features before the demo works.
- Claiming stored corrections mean the model has learned the user.

Every leaf should be defensible. If someone clicks one, Sprout can answer "Why does Sprout think this is progress?" with the user's actual words. Grounding is the core technical differentiator.