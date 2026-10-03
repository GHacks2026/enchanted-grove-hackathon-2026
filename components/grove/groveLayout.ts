// Where each tree stands in the Grove. Picks the column count that makes trees
// largest for the screen's shape: one row on wide screens, a grid on phones.
import type { GrovePillar } from "@/lib/client";
import { TREE_H, TREE_W } from "@/components/tree/treeModel";
import type { Bounds } from "./useCamera";

const SLOT_W = TREE_W + 10;
const SLOT_H = TREE_H + 70; // room for the name under each tree

export interface Slot { pillar: GrovePillar; x: number; y: number }
export interface GroveLayout { slots: Slot[]; bounds: Bounds }

const stagger = (id: string) => {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (h % 26) - 10;
};

function layoutWith(pillars: GrovePillar[], cols: number): GroveLayout {
  const slots = pillars.map((pillar, i) => {
    const row = Math.floor(i / cols);
    const inRow = Math.min(cols, pillars.length - row * cols);
    const rowOffset = ((cols - inRow) * SLOT_W) / 2; // center a short last row
    return { pillar, x: rowOffset + (i % cols) * SLOT_W, y: row * SLOT_H + stagger(pillar.id) };
  });
  const ys = slots.map(s => s.y);
  const minY = Math.min(0, ...ys);
  return { slots, bounds: { x: 0, y: minY, w: cols * SLOT_W - 10, h: Math.max(0, ...ys) - minY + SLOT_H - 20 } };
}

export function layoutGrove(pillars: GrovePillar[], viewW: number, viewH: number): GroveLayout {
  const n = Math.max(1, pillars.length);
  let best = layoutWith(pillars, n), bestK = 0;
  for (let cols = 1; cols <= n; cols++) {
    const l = layoutWith(pillars, cols);
    const k = Math.min(viewW / (l.bounds.w + 80), viewH / (l.bounds.h + 80));
    if (k > bestK + 0.02) { best = l; bestK = k; }
  }
  return best;
}
