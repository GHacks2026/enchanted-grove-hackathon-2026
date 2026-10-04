// Geometry for one Pillar's tree. Same input, same tree, on every load.
// - Shape: a tapered trunk that forks into limbs, each limb ending in twigs, like a real tree.
// - Leaves: one per confirmed bloom (leaf_count), clustered toward the twig tips like foliage.
// - Growth: more leaves -> taller tree, more limbs and twigs. Never shrinks or wilts.
// - Knot: a bark knot on the trunk when has_knot is true.
// Coordinates are in the tree's own box: TREE_W x TREE_H, ground at GROUND_Y.

export const TREE_W = 260;
export const TREE_H = 320;
export const GROUND_Y = 296;
const CX = TREE_W / 2;

/** A tapered, slightly curved limb drawn as a filled shape, plus a thin highlight line. */
export interface Limb { d: string; highlight: string }
export interface LeafSpot { index: number; x: number; y: number; angle: number; scale: number; tint: number; depth: number }
export interface TreeModel {
  seedling: boolean;
  height: number;
  baseW: number;
  trunk: string;
  limbs: Limb[];
  leaves: LeafSpot[];
  crown: { x: number; y: number; rx: number; ry: number };
  knot: { x: number; y: number; r: number };
  top: { x: number; y: number };
}

/** Stable 0..1 numbers from a string, so the same tree draws the same way every time. */
export function seeded(seed: string) {
  let h = 2166136261;
  for (const ch of seed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; };
}

const r1 = (n: number) => Math.round(n * 10) / 10;
type P = { x: number; y: number };

/** Quadratic curve from a to b bending toward c, wide at a and narrow at b, as a closed shape. */
function taper(a: P, c: P, b: P, wa: number, wb: number): Limb {
  const nrm = (p: P, q: P) => { const dx = q.x - p.x, dy = q.y - p.y, l = Math.hypot(dx, dy) || 1; return { x: -dy / l, y: dx / l }; };
  const na = nrm(a, c), nb = nrm(c, b), nc = nrm(a, b), wc = (wa + wb) / 2;
  const L = (p: P, n: P, w: number) => `${r1(p.x + n.x * w)} ${r1(p.y + n.y * w)}`;
  const R = (p: P, n: P, w: number) => `${r1(p.x - n.x * w)} ${r1(p.y - n.y * w)}`;
  return {
    d: `M${L(a, na, wa)} Q ${L(c, nc, wc)} ${L(b, nb, wb)} L ${R(b, nb, wb)} Q ${R(c, nc, wc)} ${R(a, na, wa)} Z`,
    highlight: `M${L(a, na, wa * 0.45)} Q ${L(c, nc, wc * 0.45)} ${L(b, nb, wb * 0.45)}`,
  };
}

const along = (a: P, c: P, b: P, t: number): P => ({
  x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * c.x + t * t * b.x,
  y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * c.y + t * t * b.y,
});

export function buildTree(pillarId: string, leafCount: number): TreeModel {
  const n = Math.max(0, leafCount);
  const g = Math.min(n, 20) / 20; // growth 0..1
  const rand = seeded(pillarId);
  const lean = (rand() - 0.5) * 10;

  if (n === 0) {
    const topY = GROUND_Y - 40;
    return {
      seedling: true, height: 40, baseW: 1.5, limbs: [], leaves: [],
      trunk: `M${CX} ${GROUND_Y} Q ${CX - 4} ${GROUND_Y - 22} ${CX + 1} ${topY}`,
      top: { x: CX + 1, y: topY }, crown: { x: CX, y: topY, rx: 0, ry: 0 },
      knot: { x: CX - 1, y: GROUND_Y - 16, r: 4.5 },
    };
  }

  // Trunk up to the fork
  const height = 120 + 140 * Math.pow(g, 0.75);
  const forkY = GROUND_Y - height * (0.42 + 0.06 * rand());
  const forkX = CX + lean * 0.5;
  const baseW = 10 + 12 * g;
  const forkW = baseW * 0.62;
  const trunk = [
    `M${r1(CX - baseW - 4)} ${GROUND_Y}`,
    `Q ${r1(CX - baseW * 0.8)} ${r1(GROUND_Y - 14)} ${r1(CX - baseW * 0.75)} ${r1(GROUND_Y - 30)}`,
    `Q ${r1(forkX - forkW * 1.05)} ${r1((GROUND_Y + forkY) / 2)} ${r1(forkX - forkW)} ${r1(forkY)}`,
    `L ${r1(forkX + forkW)} ${r1(forkY)}`,
    `Q ${r1(forkX + forkW * 1.05)} ${r1((GROUND_Y + forkY) / 2)} ${r1(CX + baseW * 0.75)} ${r1(GROUND_Y - 30)}`,
    `Q ${r1(CX + baseW * 0.8)} ${r1(GROUND_Y - 14)} ${r1(CX + baseW + 4)} ${GROUND_Y}`,
    "Z",
  ].join(" ");

  // Limbs fan out from the fork; twigs split off each limb
  const limbCount = n < 3 ? 2 : n < 8 ? 3 : 4;
  const crownH = height - (GROUND_Y - forkY);
  const spread = 34 + 62 * g;
  const limbs: Limb[] = [];
  const slots: (P & { angle: number; depth: number })[] = [];

  for (let i = 0; i < limbCount; i++) {
    const f = i / (limbCount - 1); // 0 = leftmost, 1 = rightmost
    const ang = (-62 + 124 * f + (rand() - 0.5) * 14) * Math.PI / 180; // angle from vertical
    const len = crownH * (0.95 + 0.25 * rand()) * (1 - Math.abs(f - 0.5) * 0.35);
    const a = { x: forkX + (f - 0.5) * forkW, y: forkY + 2 };
    const b = { x: a.x + Math.sin(ang) * len * (spread / 70), y: a.y - Math.cos(ang) * len };
    const c = { x: a.x + (b.x - a.x) * 0.3, y: a.y + (b.y - a.y) * 0.62 };
    const w0 = forkW * (0.62 - 0.08 * Math.abs(f - 0.5)), w1 = 1.6 + 1.2 * g;
    limbs.push(taper(a, c, b, w0, w1));

    // Twigs: 1-3 per limb as the tree grows
    const twigs = n < 4 ? 1 : n < 12 ? 2 : 3;
    for (let k = 0; k < twigs; k++) {
      const t = 0.45 + 0.4 * ((k + 1) / (twigs + 1)) + (rand() - 0.5) * 0.08;
      const s = along(a, c, b, t);
      const side = (k % 2 ? 1 : -1) * (f < 0.5 ? -1 : 1);
      const tAng = ang + side * (0.5 + 0.3 * rand());
      const tLen = (16 + 26 * g) * (0.8 + 0.4 * rand());
      const e = { x: s.x + Math.sin(tAng) * tLen, y: s.y - Math.cos(tAng) * tLen };
      const m = { x: (s.x + e.x) / 2 + side * 3, y: (s.y + e.y) / 2 - 3 };
      limbs.push(taper(s, m, e, w1 + 1.2 + 1.5 * g * (1 - t), 1.1));
      // Leaf slots cluster toward the twig tip
      for (let j = 0; j < 4; j++) {
        const p = along(s, m, e, Math.min(1, 0.55 + 0.15 * j));
        slots.push({ x: p.x, y: p.y, angle: tAng * 180 / Math.PI - 90 + (j % 2 ? 40 : -40), depth: rand() });
      }
    }
    // Limb tips carry a cluster too
    for (let j = 0; j < 4; j++) {
      const p = along(a, c, b, 0.82 + 0.06 * j);
      slots.push({ x: p.x, y: p.y, angle: ang * 180 / Math.PI - 90 + (j % 2 ? 45 : -45) + (j - 1.5) * 10, depth: rand() });
    }
  }

  // Shuffle slots (stably) so the first leaves spread across the whole crown, not one branch
  const order = seeded(`${pillarId}:slots`);
  const shuffled = slots.map(s => ({ s, k: order() })).sort((p, q) => p.k - q.k).map(x => x.s);
  const leaves: LeafSpot[] = Array.from({ length: n }, (_, index) => {
    const slot = shuffled[index % shuffled.length];
    const lr = seeded(`${pillarId}:${index}`);
    const jitter = 5 + Math.floor(index / shuffled.length) * 5; // extra leaves nestle nearby
    return {
      index,
      x: r1(slot.x + (lr() - 0.5) * jitter), y: r1(slot.y + (lr() - 0.5) * jitter),
      angle: r1(slot.angle + (lr() - 0.5) * 30), scale: r1(1.35 + lr() * 0.35), tint: lr(), depth: slot.depth,
    };
  });

  const xs = leaves.map(l => l.x), ys = leaves.map(l => l.y);
  const crown = {
    x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2,
    rx: (Math.max(...xs) - Math.min(...xs)) / 2 + 30, ry: (Math.max(...ys) - Math.min(...ys)) / 2 + 26,
  };
  const ky = GROUND_Y - (GROUND_Y - forkY) * 0.45;
  return {
    seedling: false, height, baseW, trunk, limbs, leaves, crown,
    top: { x: forkX, y: GROUND_Y - height },
    knot: { x: r1(CX + lean * 0.2), y: r1(ky), r: r1(6 + 3 * g) },
  };
}
