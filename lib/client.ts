// Frontend data layer: the only place screens load data from (CONTRACT §8 routes).
// USE_MOCKS = true  -> read mocks/*.json, no backend needed.
// USE_MOCKS = false -> call the real /api routes (needs .env.local).
import type { Grove, ItemKind, Pillar } from "@/lib/types";
import groveMock from "@/mocks/grove.json";
import trailMock from "@/mocks/pillars-trail.json";

export const USE_MOCKS = true;

// Response shapes from CONTRACT §8, built from the shared types in lib/types.ts.
export type GrovePillar = Pillar & { leaf_count: number; has_knot: boolean };
export type GroveData = { grove: Grove; pillars: GrovePillar[]; lantern: string | null };
export type TrailEntry = { item_id: string; kind: ItemKind; date: string; interpretation: string; evidence_quote: string };
export type TrailData = { pillar: Pillar; entries: TrailEntry[] };

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
    // The mock only has entries for one tree (Projects). Other trees come back empty.
    if (pillarId === trailMock.pillar.id) return trailMock as TrailData;
    const pillar = (groveMock as GroveData).pillars.find(p => p.id === pillarId);
    if (!pillar) throw new RequestError(404, "That tree couldn't be found.");
    const { leaf_count: _l, has_knot: _k, ...plain } = pillar;
    return { pillar: plain, entries: [] };
  }
  return request<TrailData>(`/api/pillars/${encodeURIComponent(pillarId)}/trail`);
}
