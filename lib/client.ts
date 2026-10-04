// Frontend data layer: the only place screens load data from (CONTRACT §8 routes).
// USE_MOCKS = true  -> read mocks/*.json, no backend needed.
// USE_MOCKS = false -> call the real /api routes (needs .env.local).
import type { Grove, Item, ItemKind, Pillar, ReviewAction } from "@/lib/types";
import groveMock from "@/mocks/grove.json";
import trailMock from "@/mocks/pillars-trail.json";
import journalsMock from "@/mocks/journals.json";
import suggestMock from "@/mocks/pillars-suggest.json";
import grovePostMock from "@/mocks/grove-post.json";
import confirmMock from "@/mocks/extractions-confirm.json";
import journalsGetMock from "@/mocks/journals-get.json";

export const USE_MOCKS = false;

// Response shapes from CONTRACT §8, built from the shared types in lib/types.ts.
export type GrovePillar = Pillar & { leaf_count: number; has_knot: boolean };
export type GroveData = { grove: Grove; pillars: GrovePillar[]; lantern: string | null };
export type TrailEntry = {
  item_id: string; kind: ItemKind; date: string; interpretation: string; evidence_quote: string;
  journal_id: string; journal_body: string;
};
export type TrailData = { pillar: Pillar; entries: TrailEntry[] };
export type JournalResult = { extraction_id: string; items: Item[]; lantern: string };
export type PillarDraft = { name: string; description: string };
export type ReviewedItem = { id: string; action: ReviewAction; final_interpretation: string; final_pillar_id: string | null };
export type ConfirmResult = { confirmed: Item[]; lantern: string };
export type JournalEntry = {
  journal_id: string; date: string; body: string; lantern: string;
  items: { kind: ItemKind; interpretation: string; evidence_quote: string; pillar_id: string | null }[];
};

// Screens branch on `status` (404, 409, 502), not on the error code string.
export class RequestError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    throw new RequestError(0, "Couldn't reach Sprout. Check your connection and try again.");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new RequestError(res.status, body?.error?.message ?? `Something went wrong (${res.status}).`);
  }
  return res.json() as Promise<T>;
}

const pause = () => new Promise(r => setTimeout(r, 300));

/** GET /api/grove. Returns null when no grove exists yet (404), so the app can show onboarding. */
export async function getGrove(): Promise<GroveData | null> {
  if (USE_MOCKS) {
    await pause();
    return groveMock as GroveData;
  }
  try {
    return await request<GroveData>("/api/grove");
  } catch (e) {
    if (e instanceof RequestError && e.status === 404) return null;
    throw e;
  }
}

/** GET /api/pillars/:id/trail. Newest first; includes friction entries. */
export async function getTrail(pillarId: string): Promise<TrailData> {
  if (USE_MOCKS) {
    await pause();
    // mocks/pillars-trail.json covers the Projects tree. Other trees get sample entries,
    // one per leaf, so every tree can be tried while building.
    if (pillarId === trailMock.pillar.id) return trailMock as TrailData;
    const pillar = (groveMock as GroveData).pillars.find(p => p.id === pillarId);
    if (!pillar) throw new RequestError(404, "That tree couldn't be found.");
    const { leaf_count, has_knot, ...plain } = pillar;
    const day = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
    const entries: TrailEntry[] = Array.from({ length: leaf_count }, (_, i) => ({
      item_id: `${pillarId}-sample-${i}`, kind: "bloom" as const, date: day(i * 2 + 1),
      interpretation: `Sample progress ${leaf_count - i} in ${pillar.name}`,
      evidence_quote: "sample words from a journal entry (mock data)",
      journal_id: `${pillarId}-journal-${i}`,
      journal_body: "A sample day. I wrote some sample words from a journal entry (mock data) and then kept going.",
    }));
    if (has_knot) entries.unshift({ item_id: `${pillarId}-friction`, kind: "friction", date: day(1),
      interpretation: "Getting started on the resume was difficult.", evidence_quote: "I kept putting off my resume",
      journal_id: `${pillarId}-journal-friction`, journal_body: "Long day at work. I kept putting off my resume, so I'll try again tomorrow." });
    return { pillar: plain, entries };
  }
  return request<TrailData>(`/api/pillars/${encodeURIComponent(pillarId)}/trail`);
}

/**
 * POST /api/journals. Runs extraction and grounding, then saves. Takes a few seconds.
 * On 502 nothing is saved, so the screen keeps the text and simply sends it again.
 * Mock tip: put [fail] in the entry to see the error screen.
 */
export async function submitJournal(body: string): Promise<JournalResult> {
  if (USE_MOCKS) {
    await new Promise(r => setTimeout(r, 2500));
    if (body.includes("[fail]")) throw new RequestError(502, "Sprout couldn't read your entry just now.");
    return journalsMock as JournalResult;
  }
  return request<JournalResult>("/api/journals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
}

/** GET /api/journals. Past entries (confirmed only), newest first. */
export async function getJournals(): Promise<JournalEntry[]> {
  if (USE_MOCKS) {
    await pause();
    return (journalsGetMock as { entries: JournalEntry[] }).entries;
  }
  const res = await request<{ entries: JournalEntry[] }>("/api/journals");
  return res.entries;
}

/**
 * POST /api/extractions/:id/confirm. Sends every reviewed item once; the only call that adds leaves.
 * 409 if this extraction was already confirmed.
 */
export async function confirmExtraction(extractionId: string, items: ReviewedItem[]): Promise<ConfirmResult> {
  if (USE_MOCKS) {
    await pause();
    return confirmMock as ConfirmResult;
  }
  return request<ConfirmResult>(`/api/extractions/${encodeURIComponent(extractionId)}/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
}

/** POST /api/pillars/suggest. AI suggestions only; nothing is saved. */
export async function suggestPillars(goal: string): Promise<PillarDraft[]> {
  if (USE_MOCKS) {
    await new Promise(r => setTimeout(r, 1500));
    return suggestMock.pillars;
  }
  const res = await request<{ pillars: PillarDraft[] }>("/api/pillars/suggest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ goal }),
  });
  return res.pillars;
}

/** POST /api/grove. Saves the goal and the confirmed pillars. 409 if a grove already exists. */
export async function createGrove(goal: string, pillars: PillarDraft[]): Promise<{ grove: Grove; pillars: Pillar[] }> {
  if (USE_MOCKS) {
    await new Promise(r => setTimeout(r, 600));
    return grovePostMock;
  }
  return request("/api/grove", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ goal, pillars }),
  });
}
