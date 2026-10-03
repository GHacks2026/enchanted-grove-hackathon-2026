// Geometry for one Pillar's tree. Same input, same tree, on every load.
// - Leaves: one per confirmed bloom (leaf_count). Leaf n's spot comes from the pillar id + n.
// - Growth: more leaves -> taller trunk, more and longer branches. Never shrinks or wilts.
// - Knot: a bark knot on the trunk when has_knot is true.
// Coordinates are in the tree's own box: TREE_W x TREE_H, ground at GROUND_Y.

export const TREE_W = 260;
export const TREE_H = 320;
export const GROUND_Y = 296;
const CX = TREE_W / 2;

export interface Branch { d: string; width: number; sx: number; sy: number; cx: number; cy: number; ex: number; ey: number }
export interface LeafSpot { index: number; x: number; y: number; angle: number; scale: number; tint: number }
export interface TreeModel {
  seedling: boolean;
  height: number;
  baseW: number;
  lean: number;
  trunk: string;
  top: { x: number; y: number };
  branches: Branch[];
  leaves: LeafSpot[];
  knot: { x: number; y: number; r: number };
}

/** Stable 0..1 numbers from a string, so the same tree draws the same way every time. */
export function seeded(seed: string) {
  let h = 2166136261;
  for (const ch of seed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; };
}

const q = (a: number, c: number, b: number, t: number) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * c + t * t * b;
const qd = (a: number, c: number, b: number, t: number) => 2 * (1 - t) * (c - a) + 2 * t * (b - c);
const r1 = (n: number) => Math.round(n * 10) / 10;

export function buildTree(pillarId: string, leafCount: number): TreeModel {
  const n = Math.max(0, leafCount);
  const g = Math.min(n, 18) / 18;
  const rand = seeded(pillarId);
  const lean = (rand() - 0.5) * 14;

  if (n === 0) {
    const topY = GROUND_Y - 38;
    return {
      seedling: true, height: 38, baseW: 1.5, lean: 0, branches: [], leaves: [],
      trunk: `M${CX} ${GROUND_Y} Q ${CX - 4} ${GROUND_Y - 20} ${CX + 1} ${topY}`,
      top: { x: CX + 1, y: topY },
      knot: { x: CX - 1, y: GROUND_Y - 16, r: 4.5 },
    };
  }

  const height = 84 + 160 * Math.pow(g, 0.8);
  const topY = GROUND_Y - height, topX = CX + lean;
  const baseW = 9 + 11 * g, topW = 2.5 + 2.5 * g;
  const midY = GROUND_Y - height * 0.5, midX = CX + lean * 0.35;
  const trunk = [
    `M${r1(CX - baseW)} ${GROUND_Y}`,
    `Q ${r1(midX - (baseW + topW) / 2)} ${r1(midY)} ${r1(topX - topW)} ${r1(topY)}`,
    `L ${r1(topX + topW)} ${r1(topY)}`,
    `Q ${r1(midX + (baseW + topW) / 2)} ${r1(midY)} ${r1(CX + baseW)} ${GROUND_Y}`,
    "Z",
  ].join(" ");
  const trunkX = (y: number) => { const t = (GROUND_Y - y) / height; return CX + lean * t * t; };

  const count = Math.max(2, Math.min(10, 2 + Math.floor(n * 0.6)));
  let side = rand() < 0.5 ? -1 : 1;
  const branches: Branch[] = [];
  for (let b = 0; b < count; b++) {
    const t = Math.min(0.95, 0.36 + 0.58 * ((b + 0.5) / count) + (rand() - 0.5) * 0.06);
    const sy = GROUND_Y - height * t, sx = trunkX(sy);
    const ang = side * (58 - 26 * t + (rand() - 0.5) * 12) * Math.PI / 180;
    const len = (42 + 70 * g) * (1.05 - t * 0.45) * (0.85 + 0.3 * rand());
    const cx = sx + len * 0.55 * Math.sin(ang * 1.25), cy = sy - len * 0.55 * Math.cos(ang * 1.25);
    const ex = sx + len * Math.sin(ang), ey = sy - len * Math.cos(ang);
    branches.push({ d: `M${r1(sx)} ${r1(sy)} Q ${r1(cx)} ${r1(cy)} ${r1(ex)} ${r1(ey)}`, width: r1(2 + 3.5 * g * (1 - t * 0.6)), sx, sy, cx, cy, ex, ey });
    side = -side;
  }
  const lead = 26 + 30 * g; // the trunk's own tip carries leaves too
  branches.push({
    d: `M${r1(topX)} ${r1(topY + 2)} Q ${r1(topX + 3)} ${r1(topY - lead * 0.5)} ${r1(topX - 2)} ${r1(topY - lead)}`,
    width: r1(1.8 + 2 * g), sx: topX, sy: topY + 2, cx: topX + 3, cy: topY - lead * 0.5, ex: topX - 2, ey: topY - lead,
  });

  const leaves: LeafSpot[] = Array.from({ length: n }, (_, index) => {
    const lr = seeded(`${pillarId}:${index}`);
    const br = branches[Math.floor(lr() * branches.length)];
    const t = 0.3 + 0.7 * lr();
    const along = Math.atan2(qd(br.sy, br.cy, br.ey, t), qd(br.sx, br.cx, br.ex, t)) * 180 / Math.PI;
    const s = lr() < 0.5 ? -1 : 1;
    return {
      index, x: r1(q(br.sx, br.cx, br.ex, t)), y: r1(q(br.sy, br.cy, br.ey, t)),
      angle: r1(along + s * (35 + lr() * 25)), scale: r1(0.85 + lr() * 0.3), tint: lr(),
    };
  });

  const ky = GROUND_Y - height * 0.4;
  return { seedling: false, height, baseW, lean, trunk, top: { x: topX, y: topY }, branches, leaves, knot: { x: r1(trunkX(ky)), y: r1(ky), r: r1(5.5 + 3 * g) } };
}
