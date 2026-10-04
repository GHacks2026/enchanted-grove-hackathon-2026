// Seeds the demo grove with a few days of confirmed history so the Grove isn't empty in the demo.
// Usage: npm run reset && npm run seed
//
// Every seeded quote goes through the real findQuote from lib/grounding.ts, same as live items.
// The script refuses to run if any grove already exists.
//
// Resulting Grove before the demo journal:
//   Projects 3 leaves · Interview Prep 2 · Applications 1 · Networking 0 · Resume 0
//   No knots (the only seeded friction is 6 days old, past the 3-day window).
// After the demo journal: Applications 2 · Interview Prep 3 · Networking 1 (its first leaf) · knot on Resume.

import { createClient } from "@supabase/supabase-js";
import { findQuote, normalize } from "../lib/grounding";

process.loadEnvFile(".env.local");
const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

const GOAL = "Get a software engineer internship for the summer";

// Must match scripts/demo-check.mjs exactly, or the golden demo journal won't land correctly.
const PILLARS = [
  { name: "Applications", description: "Finding internship openings and submitting applications." },
  { name: "Interview Prep", description: "Practicing coding problems and behavioral interview answers." },
  { name: "Projects", description: "Building and improving projects that show what I can do." },
  { name: "Networking", description: "Reaching out to recruiters, alumni, and engineers." },
  { name: "Resume", description: "Keeping my resume and LinkedIn profile strong and up to date." },
] as const;

type PillarName = (typeof PILLARS)[number]["name"];
type SeedItem = { kind: "bloom" | "friction"; interpretation: string; quote: string; pillar: PillarName | null };
type SeedEntry = { daysAgo: number; body: string; items: SeedItem[]; lantern: string };

const HISTORY: SeedEntry[] = [
  {
    daysAgo: 6,
    body: "Spent two hours setting up the repo for my budgeting app and got the login page working. I wanted to message a recruiter I met at the career fair but I never sent it.",
    items: [
      { kind: "bloom", pillar: "Projects", interpretation: "Set up the budgeting app repo and got the login page working.",
        quote: "Spent two hours setting up the repo for my budgeting app and got the login page working." },
      { kind: "friction", pillar: "Networking", interpretation: "Didn't send the planned message to a recruiter from the career fair.",
        quote: "I wanted to message a recruiter I met at the career fair but I never sent it." },
    ],
    lantern: "Spend 10 minutes writing a two-sentence draft message to the recruiter from the career fair.",
  },
  {
    daysAgo: 4,
    body: "Added spending charts to the budgeting app dashboard. Also watched a mock interview video and wrote down three behavioral stories from my past projects.",
    items: [
      { kind: "bloom", pillar: "Projects", interpretation: "Added spending charts to the budgeting app dashboard.",
        quote: "Added spending charts to the budgeting app dashboard." },
      { kind: "bloom", pillar: "Interview Prep", interpretation: "Wrote down three behavioral stories from past projects.",
        quote: "wrote down three behavioral stories from my past projects." },
    ],
    lantern: "Spend 15 minutes practicing one of your behavioral stories out loud with a timer.",
  },
  {
    daysAgo: 2,
    body: "Deployed the budgeting app so I can link it on applications. Applied to one internship at a local healthcare company.",
    items: [
      { kind: "bloom", pillar: "Projects", interpretation: "Deployed the budgeting app so it can be linked on applications.",
        quote: "Deployed the budgeting app so I can link it on applications." },
      { kind: "bloom", pillar: "Applications", interpretation: "Applied to an internship at a local healthcare company.",
        quote: "Applied to one internship at a local healthcare company." },
    ],
    lantern: "Spend 15 minutes finding two more internship postings that fit your budgeting app experience.",
  },
  {
    daysAgo: 1,
    body: "Mostly a rest day, hung out with friends. Did one practice problem on hash maps before bed.",
    items: [
      { kind: "bloom", pillar: "Interview Prep", interpretation: "Did one practice problem on hash maps.",
        quote: "Did one practice problem on hash maps before bed." },
    ],
    lantern: "Spend 15 minutes on one more hash map practice problem, then note the pattern it used.",
  },
];

// An evening timestamp `daysAgo` days back, with journal → confirm a few minutes apart.
function at(daysAgo: number, minutesAfter = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(21, minutesAfter, 0, 0);
  return d.toISOString();
}

function fail(msg: string): never {
  console.error(`Seed failed: ${msg}`);
  process.exit(1);
}

async function main() {
  // Validate every quote before writing anything, so a bad quote leaves the DB untouched.
  const located = HISTORY.map((entry) =>
    entry.items.map((item) => {
      const pos = findQuote(entry.body, item.quote);
      if (!pos) fail(`quote not found in its journal: "${item.quote}"`);
      return { ...item, evidence_quote: normalize(item.quote), quote_start: pos.start, quote_end: pos.end };
    }),
  );

  const { count, error: countErr } = await db.from("groves").select("id", { count: "exact", head: true });
  if (countErr) fail(countErr.message);
  if (count) fail("a grove already exists. Run npm run reset first.");

  const { data: grove, error: groveErr } = await db
    .from("groves").insert({ user_id: process.env.DEMO_USER_ID!, title: "Internship", goal: GOAL, is_active: true, created_at: at(7) }).select().single();
  if (groveErr) fail(groveErr.message);

  const { data: pillars, error: pillarErr } = await db
    .from("pillars")
    .insert(PILLARS.map((p, i) => ({ grove_id: grove.id, name: p.name, description: p.description, position: i })))
    .select();
  if (pillarErr) fail(pillarErr.message);
  const pillarId = new Map(pillars.map((p) => [p.name as PillarName, p.id as string]));
  const idFor = (name: PillarName | null) => (name ? pillarId.get(name)! : null);

  let leaves = 0;
  for (const [i, entry] of HISTORY.entries()) {
    const items = located[i];

    const { data: journal, error: jErr } = await db
      .from("journals").insert({ grove_id: grove.id, body: entry.body, created_at: at(entry.daysAgo) })
      .select().single();
    if (jErr) fail(jErr.message);

    // Same shape the model returns, marked so evals can skip seeded rows.
    const raw_json = {
      seeded: true,
      blooms: items.filter((x) => x.kind === "bloom")
        .map((x) => ({ interpretation: x.interpretation, evidence_quote: x.quote, pillar_id: idFor(x.pillar) })),
      friction: items.filter((x) => x.kind === "friction")
        .map((x) => ({ interpretation: x.interpretation, evidence_quote: x.quote, pillar_id: idFor(x.pillar) })),
      lantern: entry.lantern,
    };

    const { data: extraction, error: eErr } = await db
      .from("extractions")
      .insert({
        journal_id: journal.id,
        raw_json,
        lantern: entry.lantern,
        status: "confirmed",
        created_at: at(entry.daysAgo, 1),
        confirmed_at: at(entry.daysAgo, 3),
      })
      .select().single();
    if (eErr) fail(eErr.message);

    const { error: iErr } = await db.from("items").insert(
      items.map((x) => ({
        extraction_id: extraction.id,
        kind: x.kind,
        original_interpretation: x.interpretation,
        original_pillar_id: idFor(x.pillar),
        final_interpretation: x.interpretation,
        final_pillar_id: idFor(x.pillar),
        evidence_quote: x.evidence_quote,
        quote_start: x.quote_start,
        quote_end: x.quote_end,
        status: "accepted",
      })),
    );
    if (iErr) fail(iErr.message);
    leaves += items.filter((x) => x.kind === "bloom").length;
  }

  console.log(`Seeded "${GOAL}" with ${PILLARS.length} pillars, ${HISTORY.length} journals, ${leaves} leaves.`);
}

main();
