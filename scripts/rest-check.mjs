// Checks whether the extraction prompt counts rest/reflection as progress.
// Usage: start the app (npm run dev), then: node scripts/rest-check.mjs
// Optional: BASE_URL=https://... node scripts/rest-check.mjs  (prod uses the shared DB, prefer local)
//
// Creates a test grove only if none exists. Never confirms anything, so no leaves are created.
// Afterward, run the reset script to clear the test grove and pending extractions.

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const RUNS = Number(process.env.RUNS ?? 1); // set RUNS=3 to catch flaky answers

const TEST_GROVE = {
  goal: "Become a strong software engineer",
  pillars: [
    { name: "Technical Skills", description: "Practicing and deepening core programming skills." },
    { name: "Projects", description: "Building and shipping personal projects like a portfolio." },
    { name: "Career", description: "Job search, applications, interviews, and networking." },
    { name: "Learning", description: "Courses, reading, and studying new topics." },
  ],
};

// expected = exact number of blooms that should come back
const CASES = [
  { name: "sleep", expected: 0, body: "Went to bed early, I was exhausted." },
  { name: "rest day", expected: 0, body: "Took a full rest day. Didn't touch anything." },
  { name: "anxious + TV", expected: 0, body: "Felt anxious about interviews so I watched TV all night." },
  { name: "reflection", expected: 0, body: "Thought a lot about whether I'm even on the right path." },
  { name: "intending", expected: 0, body: "I really want to start LeetCode tomorrow. I think I'll do two problems before class." },
  { name: "planning only", expected: 0, body: "Made a mental note that my portfolio needs a better about page. Didn't get to it." },
  { name: "rest + 1 bug", expected: 1, body: "Rested most of the day but fixed one bug in my portfolio." },
  { name: "nap + 1 problem", expected: 1, body: "Napped for two hours. Later I solved one LeetCode medium on binary search." },
];

async function api(path, init) {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { "Content-Type": "application/json" },
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

async function ensureGrove() {
  const got = await api("/api/grove");
  if (got.status === 200) {
    console.log(`Using existing grove: "${got.json.grove.goal}"\n`);
    return;
  }
  if (got.status !== 404) throw new Error(`GET /api/grove → ${got.status} ${JSON.stringify(got.json)}`);
  const made = await api("/api/grove", { method: "POST", body: JSON.stringify(TEST_GROVE) });
  if (made.status !== 200 && made.status !== 201) {
    throw new Error(`POST /api/grove → ${made.status} ${JSON.stringify(made.json)}`);
  }
  console.log("Created test grove (remember to reset afterward).\n");
}

async function main() {
  await ensureGrove();
  let failures = 0;

  for (const c of CASES) {
    for (let run = 1; run <= RUNS; run++) {
      const { status, json } = await api("/api/journals", {
        method: "POST",
        body: JSON.stringify({ body: c.body }),
      });
      const label = RUNS > 1 ? `${c.name} (run ${run})` : c.name;
      if (status !== 200 && status !== 201) {
        failures++;
        console.log(`ERROR  ${label}: ${status} ${JSON.stringify(json)}\n`);
        continue;
      }
      const blooms = json.items.filter((i) => i.kind === "bloom");
      const friction = json.items.filter((i) => i.kind === "friction");
      const ok = blooms.length === c.expected;
      if (!ok) failures++;
      console.log(`${ok ? "PASS " : "FAIL "} ${label}: ${blooms.length} bloom(s), expected ${c.expected}`);
      console.log(`       journal: ${c.body}`);
      for (const b of blooms) console.log(`       bloom:    ${b.original_interpretation}  ←  "${b.evidence_quote}"`);
      for (const f of friction) console.log(`       friction: ${f.original_interpretation}  ←  "${f.evidence_quote}"`);
      console.log(`       lantern:  ${json.lantern}\n`);
    }
  }

  const total = CASES.length * RUNS;
  console.log(`${total - failures}/${total} passed`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
