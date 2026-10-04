import { NextResponse } from "next/server";
import { apiError, demoUserId } from "@/lib/api";
import { findQuote, normalize } from "@/lib/grounding";
import { supabaseServer } from "@/lib/supabase/server";

// POST /api/demo/fast-forward — demo only (CONTRACT §10 Demo data).
// Jumps the grove two weeks ahead: moves every existing timestamp back 14 days, then fills
// the gap with confirmed history, the same way seed/seed.ts does. Pillars are matched by the
// demo grove's names; items whose pillar doesn't exist are skipped.

const DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

type SeedItem = { kind: "bloom" | "friction"; interpretation: string; quote: string; pillar: string | null };
type SeedEntry = { daysAgo: number; body: string; items: SeedItem[]; lantern: string };

// Picks up after the golden demo journal (resume put off, NJIT alum messaged).
const HISTORY: SeedEntry[] = [
  {
    daysAgo: 13,
    body: "Finally updated my resume with the budgeting app and my TA job. It took longer than I thought but it looks a lot better.",
    items: [
      { kind: "bloom", pillar: "Resume", interpretation: "Updated the resume with the budgeting app and TA job.",
        quote: "Finally updated my resume with the budgeting app and my TA job." },
    ],
    lantern: "Spend 10 minutes sending your updated resume to the career center for a quick review.",
  },
  {
    daysAgo: 12,
    body: "The NJIT alum replied and I set up a 20 minute call with her for Friday. Did two LeetCode problems on sliding window.",
    items: [
      { kind: "bloom", pillar: "Networking", interpretation: "Set up a call with the NJIT alum.",
        quote: "The NJIT alum replied and I set up a 20 minute call with her for Friday." },
      { kind: "bloom", pillar: "Interview Prep", interpretation: "Did two sliding window LeetCode problems.",
        quote: "Did two LeetCode problems on sliding window." },
    ],
    lantern: "Spend 15 minutes writing three questions to ask the alum on Friday's call.",
  },
  {
    daysAgo: 10,
    body: "Had the call with the alum. She told me what fintech teams look for and offered to refer me. Added unit tests to the budgeting app afterward.",
    items: [
      { kind: "bloom", pillar: "Networking", interpretation: "Had a call with the alum about fintech internships.",
        quote: "Had the call with the alum." },
      { kind: "bloom", pillar: "Projects", interpretation: "Added unit tests to the budgeting app.",
        quote: "Added unit tests to the budgeting app afterward." },
    ],
    lantern: "Spend 10 minutes finding the fintech posting the alum mentioned and saving the link.",
  },
  {
    daysAgo: 8,
    body: "Tired today and didn't get much done. Rewatched a lecture and went to bed early.",
    items: [],
    lantern: "Spend 10 minutes reading the fintech posting and noting two skills it asks for.",
  },
  {
    daysAgo: 7,
    body: "Submitted three applications, including the fintech one with the alum's referral. Updated my LinkedIn headline and added the budgeting app to my featured section.",
    items: [
      { kind: "bloom", pillar: "Applications", interpretation: "Submitted three applications, including the referred fintech one.",
        quote: "Submitted three applications, including the fintech one with the alum's referral." },
      { kind: "bloom", pillar: "Resume", interpretation: "Updated the LinkedIn headline and featured the budgeting app.",
        quote: "Updated my LinkedIn headline and added the budgeting app to my featured section." },
    ],
    lantern: "Spend 15 minutes practicing one behavioral story out loud with a timer.",
  },
  {
    daysAgo: 5,
    body: "Got an email for a first round interview at the healthcare company! Did a mock behavioral interview with my roommate using my three stories. I wanted to start a portfolio site but couldn't decide on a design.",
    items: [
      { kind: "bloom", pillar: "Interview Prep", interpretation: "Did a mock behavioral interview with a roommate.",
        quote: "Did a mock behavioral interview with my roommate using my three stories." },
      { kind: "friction", pillar: "Projects", interpretation: "Couldn't decide on a design to start the portfolio site.",
        quote: "I wanted to start a portfolio site but couldn't decide on a design." },
    ],
    lantern: "Spend 15 minutes reviewing the healthcare company's mission and one recent project of theirs.",
  },
  {
    daysAgo: 2,
    body: "Had my first round interview with the healthcare company. I was nervous but I think it went okay. Sent the interviewer a thank you note on LinkedIn afterward.",
    items: [
      { kind: "bloom", pillar: "Applications", interpretation: "Had a first round interview with the healthcare company.",
        quote: "Had my first round interview with the healthcare company." },
      { kind: "bloom", pillar: "Networking", interpretation: "Sent the interviewer a thank you note on LinkedIn.",
        quote: "Sent the interviewer a thank you note on LinkedIn afterward." },
    ],
    lantern: "Spend 15 minutes sketching a simple homepage for your portfolio site on paper.",
  },
  {
    daysAgo: 1,
    body: "Picked a simple template and got the homepage of my portfolio site done. Asked the alum if she'd look over my resume and she said yes.",
    items: [
      { kind: "bloom", pillar: "Projects", interpretation: "Built the portfolio site homepage.",
        quote: "Picked a simple template and got the homepage of my portfolio site done." },
      { kind: "bloom", pillar: "Resume", interpretation: "Asked the alum to review the resume.",
        quote: "Asked the alum if she'd look over my resume" },
    ],
    lantern: "Spend 15 minutes adding the budgeting app as the first project on your portfolio site.",
  },
];

// An evening timestamp `daysAgo` days back, with journal → confirm a few minutes apart.
function at(daysAgo: number, minutesAfter = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(21, minutesAfter, 0, 0);
  return d.toISOString();
}

const back = (iso: string) => new Date(Date.parse(iso) - DAYS * DAY_MS).toISOString();

export async function POST() {
  const db = supabaseServer();

  const { data: grove, error: groveErr } = await db
    .from("groves").select("id, created_at").eq("user_id", demoUserId()).eq("is_active", true).maybeSingle();
  if (groveErr) return dbError("load grove", groveErr);
  if (!grove) return apiError("not_found", "No grove exists yet.", 404);

  const { data: pillars, error: pillarErr } = await db.from("pillars").select("id, name").eq("grove_id", grove.id);
  if (pillarErr) return dbError("load trees", pillarErr);
  const pillarId = new Map(pillars.map((p) => [p.name as string, p.id as string]));

  // 1. Move everything that already happened two weeks into the past.
  const { data: journals, error: jErr } = await db.from("journals").select("id, created_at").eq("grove_id", grove.id);
  if (jErr) return dbError("load journals", jErr);
  const { data: extractions, error: eErr } = await db
    .from("extractions").select("id, created_at, confirmed_at").in("journal_id", journals.map((j) => j.id));
  if (eErr) return dbError("load extractions", eErr);

  const shifts = await Promise.all([
    db.from("groves").update({ created_at: back(grove.created_at) }).eq("id", grove.id),
    ...journals.map((j) => db.from("journals").update({ created_at: back(j.created_at) }).eq("id", j.id)),
    ...extractions.map((e) => db.from("extractions").update({
      created_at: back(e.created_at),
      confirmed_at: e.confirmed_at && back(e.confirmed_at),
    }).eq("id", e.id)),
  ]);
  const shiftErr = shifts.find((r) => r.error)?.error;
  if (shiftErr) return dbError("shift timestamps", shiftErr);

  // 2. Fill the two weeks with confirmed, grounded entries.
  let leaves = 0;
  for (const entry of HISTORY) {
    const items = entry.items.flatMap((x) => {
      const pid = x.pillar ? pillarId.get(x.pillar) : null;
      const pos = findQuote(entry.body, x.quote);
      if (pid === undefined || !pos) return [];
      return [{ ...x, pid, evidence_quote: normalize(x.quote), quote_start: pos.start, quote_end: pos.end }];
    });

    const { data: journal, error } = await db
      .from("journals").insert({ grove_id: grove.id, body: entry.body, created_at: at(entry.daysAgo) })
      .select("id").single();
    if (error) return dbError("insert journal", error);

    const toRaw = (x: (typeof items)[number]) => ({ interpretation: x.interpretation, evidence_quote: x.quote, pillar_id: x.pid });
    const { data: extraction, error: exErr } = await db
      .from("extractions")
      .insert({
        journal_id: journal.id,
        raw_json: {
          seeded: true,
          blooms: items.filter((x) => x.kind === "bloom").map(toRaw),
          friction: items.filter((x) => x.kind === "friction").map(toRaw),
          lantern: entry.lantern,
        },
        lantern: entry.lantern,
        status: "confirmed",
        created_at: at(entry.daysAgo, 1),
        confirmed_at: at(entry.daysAgo, 3),
      })
      .select("id").single();
    if (exErr) return dbError("insert extraction", exErr);

    if (items.length) {
      const { error: iErr } = await db.from("items").insert(items.map((x) => ({
        extraction_id: extraction.id,
        kind: x.kind,
        original_interpretation: x.interpretation,
        original_pillar_id: x.pid,
        final_interpretation: x.interpretation,
        final_pillar_id: x.pid,
        evidence_quote: x.evidence_quote,
        quote_start: x.quote_start,
        quote_end: x.quote_end,
        status: "accepted",
      })));
      if (iErr) return dbError("insert items", iErr);
    }
    leaves += items.filter((x) => x.kind === "bloom").length;
  }

  return NextResponse.json({ journals: HISTORY.length, leaves });
}

function dbError(step: string, err: unknown) {
  console.error(`fast-forward: ${step} failed`, err);
  return apiError("db_error", `Failed to ${step}.`, 500);
}
