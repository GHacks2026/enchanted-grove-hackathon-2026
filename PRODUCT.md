# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Any adult working toward a long-term personal goal (career, fitness, a creative project, school). The demo uses "Get a software engineer internship for the summer", but nothing in the product is specific to that goal. They use Sprout in the evening on a laptop, taking a few unhurried minutes to write about their day. The job: see real evidence that they are moving forward, especially on days when it doesn't feel like it.

## Product Purpose

Sprout is a journal-first app. The user writes about their day; AI finds concrete evidence of progress (blooms) and friction in their own words; the user reviews and confirms it; confirmed progress grows into a visual Grove. Success is the user saying: "I can finally see that I'm making progress, even when it doesn't feel like it." Full product rules live in [docs/CONTEXT.md](docs/CONTEXT.md).

## Positioning

Every leaf is defensible. Each piece of progress carries a verbatim quote from the user's own journal, checked in code, and nothing enters the Grove until the user confirms it. Sprout shows progress that happened; it never manufactures progress that didn't.

## Operating Context

- Built for GirlHacks 2026 (NJIT, Oct 3–4), theme "Enchanted Grove". Target tracks: Whimsical Wonders, Best Use of Azure by Avanade, Diversity.
- Daily loop: Grove (home) → Reflect on your day → review what sprouted → confirm → leaves fly onto trees → Tomorrow's Lantern.
- Single demo user, no auth. One shared Supabase database for local and production.

## Capabilities and Constraints

- Metaphor: goal = Grove, Pillar = tree, confirmed bloom = leaf, friction = knot, next step = Lantern, user correction = pruning.
- UI language stays plain; the metaphor never replaces clear labels (CTA is "Reflect on your day").
- Evidence quotes cannot be edited; interpretations and Pillars can. Confirmed records are read-only.
- Typed journaling only for the MVP; voice is a stretch.
- Stack and environment are fixed in [docs/DECISIONS.md](docs/DECISIONS.md); interfaces in [docs/CONTRACT.md](docs/CONTRACT.md).

## Brand Commitments

- Name: Sprout.
- Voice: warm, plain, non-judgmental. Acknowledge without praise inflation or shame.
- Never claim "0% hallucinations"; the claim is a 0% ungrounded quote rate.

## Evidence on Hand

- Seed journal data (`seed/`) and API mocks (`mocks/`) with realistic entries for the demo.
- An evaluation set and harness in `eval/` for extraction quality.
- No testimonials, user counts, or outcome claims exist; do not fabricate them.

## Product Principles

1. **Evidence over assumption.** Never invent progress, emotions, motivations, or causes the user didn't state.
2. **Acknowledge without judgment.** No shaming, no punishing inactivity; trees never wilt.
3. **Experienced, not scored.** No streaks, XP, levels, scores, or completion percentages.
4. **The user decides.** AI proposes, code validates, the human confirms.
5. **Journal-first.** Evidence comes from what the user writes, not checklists or sliders.
