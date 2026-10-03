// Runs the golden demo journal several times and checks it gives the same clean result.
// Usage: npm run reset, start the app (npm run dev), then: node scripts/demo-check.mjs
// Optional: RUNS=10 node scripts/demo-check.mjs
//
// Creates the demo grove if none exists. Never confirms anything, so no leaves are created.
// Run npm run reset afterward.

import { readFileSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const RUNS = Number(process.env.RUNS ?? 5);
const JOURNAL = readFileSync(new URL("../seed/demo-journal.txt", import.meta.url), "utf8").trim();

const DEMO_GROVE = {
  goal: "Get a software engineer internship for the summer",
  pillars: [
    { name: "Applications", description: "Finding internship openings and submitting applications." },
    { name: "Interview Prep", description: "Practicing coding problems and behavioral interview answers." },
    { name: "Projects", description: "Building and improving projects that show what I can do." },
    { name: "Networking", description: "Reaching out to recruiters, alumni, and engineers." },
    { name: "Resume", description: "Keeping my resume and LinkedIn profile strong and up to date." },
  ],
};

// Expected result: one bloom on each of these pillars, and one friction on Resume.
const EXPECTED_BLOOM_PILLARS = ["Applications", "Interview Prep", "Networking"];
const EXPECTED_FRICTION_PILLAR = "Resume";

async function api(path, init) {
  const res = await fetch(BASE + path, { ...init, headers: { "Content-Type": "application/json" } });
  return { status: res.status, json: await res.json().catch(() => null) };
}

async function loadGrove() {
  let got = await api("/api/grove");
  if (got.status === 404) {
    const made = await api("/api/grove", { method: "POST", body: JSON.stringify(DEMO_GROVE) });
    if (made.status >= 300) throw new Error(`POST /api/grove → ${made.status} ${JSON.stringify(made.json)}`);
    console.log("Created demo grove.\n");
    got = await api("/api/grove");
  }
  if (got.status !== 200) throw new Error(`GET /api/grove → ${got.status} ${JSON.stringify(got.json)}`);
  if (got.json.grove.goal !== DEMO_GROVE.goal) {
    throw new Error(`Existing grove is "${got.json.grove.goal}", not the demo grove. Run npm run reset first.`);
  }
  return new Map(got.json.pillars.map((p) => [p.id, p.name]));
}

const sameSet = (a, b) => a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");

async function main() {
  const pillarName = await loadGrove();
  console.log(`Journal:\n${JOURNAL}\n`);
  let clean = 0;

  for (let run = 1; run <= RUNS; run++) {
    const started = Date.now();
    const { status, json } = await api("/api/journals", { method: "POST", body: JSON.stringify({ body: JOURNAL }) });
    const secs = ((Date.now() - started) / 1000).toFixed(1);
    if (status >= 300) {
      console.log(`ERROR run ${run}: ${status} ${JSON.stringify(json)}\n`);
      continue;
    }

    const blooms = json.items.filter((i) => i.kind === "bloom");
    const friction = json.items.filter((i) => i.kind === "friction");
    const bloomPillars = blooms.map((b) => pillarName.get(b.original_pillar_id) ?? "?");
    const frictionPillars = friction.map((f) => pillarName.get(f.original_pillar_id) ?? "none");

    const problems = [];
    if (!sameSet(bloomPillars, EXPECTED_BLOOM_PILLARS)) {
      problems.push(`blooms on [${bloomPillars.join(", ")}], expected [${EXPECTED_BLOOM_PILLARS.join(", ")}]`);
    }
    if (friction.length !== 1 || frictionPillars[0] !== EXPECTED_FRICTION_PILLAR) {
      problems.push(`friction on [${frictionPillars.join(", ")}], expected [${EXPECTED_FRICTION_PILLAR}]`);
    }

    if (problems.length === 0) clean++;
    console.log(`${problems.length ? "FAIL" : "PASS"}  run ${run} (${secs}s)`);
    for (const p of problems) console.log(`       problem:  ${p}`);
    blooms.forEach((b, i) =>
      console.log(`       bloom:    [${bloomPillars[i]}] ${b.original_interpretation}  ←  "${b.evidence_quote}"`));
    friction.forEach((f, i) =>
      console.log(`       friction: [${frictionPillars[i]}] ${f.original_interpretation}  ←  "${f.evidence_quote}"`));
    console.log(`       lantern:  ${json.lantern}\n`);
  }

  console.log(`${clean}/${RUNS} clean runs`);
  process.exit(clean === RUNS ? 0 : 1);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
