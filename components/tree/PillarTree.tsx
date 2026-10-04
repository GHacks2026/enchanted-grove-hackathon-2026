"use client";

// One tree for one Pillar (issue #4). Draws leaf_count leaves and a bark knot when has_knot.
// Tap the tree (or its name) to see its progress; tap a single leaf to see that one moment.
// Newly added leaves (newCount) grow in with a brief golden glow. Leaves still flying in from the
// review (hiddenCount) aren't drawn until they land (see LeafFlight); those arrive full size, so
// they skip the grow and start at full glow (flownIn).
// Grass, mushrooms and the breeze are scenery only. Leaves are the only progress.
import { useMemo } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import type { GrovePillar } from "@/lib/client";
import { pillarColor, shade } from "./colors";
import { buildTree, GROUND_Y, LEAF_MIDRIB, LEAF_PATH as LEAF, LEAF_VEINS, seeded, TREE_H, TREE_W } from "./treeModel";

interface Props {
  pillar: GrovePillar;
  selectedLeaf?: number | null;
  knotSelected?: boolean;
  /** How many of the newest leaves to celebrate (e.g. just confirmed) */
  newCount?: number;
  /** How many of the newest leaves are still on their way (not drawn yet) */
  hiddenCount?: number;
  /** The new leaves flew in (LeafFlight) rather than growing in place */
  flownIn?: boolean;
  onLeafSelect?: (index: number, anchor: Element) => void;
  onKnotSelect?: (anchor: Element) => void;
  onOpenTrail?: () => void;
}

const CX = TREE_W / 2;
const BARK_DARK = "#43301F", BARK = "#6B4E3A", BARK_LIT = "#A88763";
// The moon is up to the right: light falls from there, so right-facing edges catch it
const MOON = { x: 0.6, y: -0.8 };

export default function PillarTree({ pillar, selectedLeaf, knotSelected, newCount = 0, hiddenCount = 0, flownIn = false, onLeafSelect, onKnotSelect, onOpenTrail }: Props) {
  const color = pillarColor(pillar.position);
  const n = pillar.leaf_count;
  const id = pillar.id;
  const firstNew = n - Math.min(newCount, n);
  // While leaves are in the air the tree keeps the shape it has without them, so nothing on it moves
  // before they land; it grows a step as each one arrives.
  const shown = n - Math.min(hiddenCount, n);
  const tree = useMemo(() => buildTree(pillar.id, shown), [pillar.id, shown]);

  const scenery = useMemo(() => {
    const r = seeded(`${id}:scenery`);
    return {
      // Clumps gather at the trunk and thin out toward the edge of the mound; nearer ones (larger y) stand taller
      tufts: Array.from({ length: 12 }, () => {
        const d = 10 + Math.pow(r(), 1.4) * 66, x = CX + (r() < 0.5 ? -1 : 1) * d, y = GROUND_Y - 2 + r() * 11;
        const h = (9 + r() * 7) * (1 - d / 160) * (0.8 + (y - GROUND_Y) / 22);
        return { x, y, h, blades: Array.from({ length: 3 + Math.floor(r() * 3) }, (_, j) => ({ dx: (j - 1.5) * 1.8 + (r() - 0.5), lean: (j - 1.5) * 1.6 + (r() - 0.5) * 3, h: h * (0.6 + r() * 0.45) })) };
      }).sort((a, b) => a.y - b.y),
      mushrooms: Array.from({ length: r() < 0.5 ? 1 : 2 }, (_, i) => ({ x: CX + (i % 2 ? 1 : -1) * (52 + r() * 28), s: 0.8 + r() * 0.5, cap: r() < 0.5 ? "#F2C7D3" : "#F3DDA6" })),
      sway: 8 + r() * 4, delay: -r() * 8,
    };
  }, [id]);

  // Back leaves first and a little darker, so the crown has depth
  const leaves = useMemo(() => [...tree.leaves].sort((a, b) => a.depth - b.depth), [tree.leaves]);

  // Engraved grain up the trunk, bending around the knot the way real grain does. Strokes on the
  // moonlit side are pale, the rest dark.
  const grain = useMemo(() => {
    if (tree.seedling) return [];
    const r = seeded(`${id}:grain`), k = tree.knot, span = GROUND_Y - tree.fork.y;
    return Array.from({ length: 6 }, (_, i) => {
      const f = -0.7 + (1.4 * (i + r() * 0.6)) / 6, end = 0.45 + r() * 0.45, y0 = GROUND_Y - 3 - r() * 5;
      const pts = Array.from({ length: 10 }, (_, j) => {
        const y = y0 - (y0 - (GROUND_Y - span * end)) * (j / 9), t = (GROUND_Y - y) / span;
        const half = tree.baseW * 0.85 * (1 - t) + tree.fork.w * t, cx = CX + (tree.fork.x - CX) * t;
        let x = cx + f * half;
        if (pillar.has_knot) {
          const dx = x - k.x, reach = k.r * 2.3;
          if (Math.abs(dx) < reach) x += (dx >= 0 ? 1 : -1) * k.r * 1.5 * Math.exp(-(((y - k.y) / (k.r * 2.2)) ** 2)) * (1 - Math.abs(dx) / reach);
        }
        return `${x.toFixed(1)} ${y.toFixed(1)}`;
      });
      return { d: `M${pts.join(" L")}`, lit: f > 0.3 };
    });
  }, [tree, id, pillar.has_knot]);

  const onKey = (e: KeyboardEvent, act: () => void) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); act(); }
  };
  const sway: CSSProperties = {
    animationDuration: `${scenery.sway.toFixed(1)}s`, animationDelay: `${scenery.delay.toFixed(1)}s`,
    transformOrigin: `${CX}px ${GROUND_Y}px`, transformBox: "view-box",
  };

  return (
    <figure className="group/tree m-0 flex w-[260px] flex-col items-center">
      <svg viewBox={`0 0 ${TREE_W} ${TREE_H}`} width={TREE_W} height={TREE_H} className="block overflow-visible"
        role="group" aria-label={`${pillar.name}: ${n} ${n === 1 ? "leaf" : "leaves"}${pillar.has_knot ? ", with recent friction" : ""}`}>
        <defs>
          <linearGradient id={`leaf-${id}`} x1="0" x2="1">
            <stop offset="0" stopColor={shade(color, -0.25)} /><stop offset=".55" stopColor={color} /><stop offset="1" stopColor={shade(color, 0.4)} />
          </linearGradient>
          {/* Bark: one light across the whole tree, shadowed on the left and moonlit on the right */}
          <linearGradient id={`bark-${id}`} gradientUnits="userSpaceOnUse" x1={CX - 70} x2={CX + 70} y1={0} y2={0}>
            <stop offset="0" stopColor="#4A3527" /><stop offset=".45" stopColor={BARK} /><stop offset=".8" stopColor="#7A5B42" /><stop offset="1" stopColor="#9A7A58" />
          </linearGradient>
          {/* Grain and the knot stay on the bark */}
          <clipPath id={`trunk-${id}`}><path d={tree.trunk} /></clipPath>
          <radialGradient id={`new-${id}`}><stop offset="0" stopColor="#FFE3A3" stopOpacity=".9" /><stop offset="1" stopColor="#FFE3A3" stopOpacity="0" /></radialGradient>
          <radialGradient id={`mound-${id}`}><stop offset="0" stopColor="#4A6A3A" stopOpacity=".85" /><stop offset=".55" stopColor="#3C5530" stopOpacity=".6" /><stop offset="1" stopColor="#3C5530" stopOpacity="0" /></radialGradient>
          <radialGradient id={`shroom-${id}`}><stop offset="0" stopColor="#FFE9B8" stopOpacity=".5" /><stop offset="1" stopColor="#FFE9B8" stopOpacity="0" /></radialGradient>
        </defs>

        {/* A low mound where the tree meets the meadow, fading into it */}
        <ellipse cx={CX} cy={GROUND_Y + 4} rx={88} ry={14} fill={`url(#mound-${id})`} />

        {scenery.tufts.filter(t => t.y <= GROUND_Y + 1).map((t, i) => <Tuft key={i} {...t} />)}

        <g data-canopy className="animate-breeze" style={sway}>
          {/* The tree itself is a button: tap it to see its progress */}
          <g role="button" tabIndex={onOpenTrail ? 0 : -1} aria-label={`See progress in ${pillar.name}`}
            className={`outline-none ${onOpenTrail ? "cursor-pointer" : ""} transition-[filter] duration-200 group-hover/tree:brightness-115 focus-visible:brightness-125`}
            onClick={() => onOpenTrail?.()} onKeyDown={e => onKey(e, () => onOpenTrail?.())}>
            {tree.seedling ? (
              <g>
                <path d={tree.trunk} fill="none" stroke={BARK} strokeWidth={3} strokeLinecap="round" />
                {/* A closed bud, not a leaf: leaves only come from confirmed progress */}
                <ellipse cx={tree.top.x} cy={tree.top.y - 6} rx={5} ry={8} fill="#8E9C6E" />
                <path d={`M${tree.top.x - 2} ${tree.top.y - 11} Q ${tree.top.x} ${tree.top.y - 4} ${tree.top.x - 1} ${tree.top.y + 1}`} stroke="#B7C493" strokeWidth={1} fill="none" />
                <circle cx={tree.top.x} cy={tree.top.y - 6} r={22} fill="transparent" />
              </g>
            ) : (
              <>
                {tree.limbs.map((l, i) => (
                  <g key={i}>
                    <path d={l.d} fill={`url(#bark-${id})`} />
                    <path d={l.highlight} fill="none" stroke={BARK_DARK} strokeWidth={1} strokeLinecap="round" opacity={0.4} />
                  </g>
                ))}
                <path d={tree.trunk} fill={`url(#bark-${id})`} />
                <g clipPath={`url(#trunk-${id})`}>
                  {grain.map((g, i) => (
                    <path key={i} d={g.d} fill="none" stroke={g.lit ? BARK_LIT : BARK_DARK} strokeWidth={g.lit ? 0.8 : 0.9}
                      opacity={g.lit ? 0.45 : 0.5} strokeLinecap="round" strokeLinejoin="round" />
                  ))}
                </g>
                {/* A soft, invisible hit area over the crown, so tapping near the leaves opens the tree too */}
                <ellipse cx={tree.crown.x} cy={tree.crown.y} rx={tree.crown.rx} ry={tree.crown.ry} fill="transparent" />
              </>
            )}
          </g>

          {pillar.has_knot && (
            <g role="button" tabIndex={onKnotSelect ? 0 : -1} className="group cursor-pointer outline-none"
              aria-label={`Recent friction in ${pillar.name}`}
              onClick={e => onKnotSelect?.(e.currentTarget)} onKeyDown={e => onKey(e, () => onKnotSelect?.(e.currentTarget))}>
              <circle cx={tree.knot.x} cy={tree.knot.y} r={15} fill="transparent" />
              <g clipPath={`url(#trunk-${id})`}>
              {/* A bark knot: a raised swelling (moonlit on its right lip) around a dark, off-centre
                  opening with the old branch's heart inside, as the knot pop-up shows it cut through */}
              <ellipse cx={tree.knot.x} cy={tree.knot.y} rx={tree.knot.r * 1.2} ry={tree.knot.r * 1.7} fill="#7A5A40"
                className={knotSelected ? "stroke-amber [stroke-width:2]" : "stroke-transparent [stroke-width:1.6] group-hover:stroke-amber group-focus-visible:stroke-amber"} />
              <path d={`M${tree.knot.x + tree.knot.r * 0.5} ${tree.knot.y - tree.knot.r * 1.45} Q ${tree.knot.x + tree.knot.r * 1.35} ${tree.knot.y} ${tree.knot.x + tree.knot.r * 0.5} ${tree.knot.y + tree.knot.r * 1.45}`}
                fill="none" stroke="#D4B48C" strokeWidth={1.6} strokeLinecap="round" opacity={0.95} />
              {/* Its shadowed lip on the left */}
              <path d={`M${tree.knot.x - tree.knot.r * 0.3} ${tree.knot.y - tree.knot.r * 1.6} Q ${tree.knot.x - tree.knot.r * 1.45} ${tree.knot.y} ${tree.knot.x - tree.knot.r * 0.3} ${tree.knot.y + tree.knot.r * 1.6}`}
                fill="none" stroke="#2E2016" strokeWidth={1.4} strokeLinecap="round" opacity={0.75} />
              <path d={`M${tree.knot.x - tree.knot.r * 0.15} ${tree.knot.y - tree.knot.r * 1.05} Q ${tree.knot.x + tree.knot.r * 0.5} ${tree.knot.y + tree.knot.r * 0.1} ${tree.knot.x - tree.knot.r * 0.15} ${tree.knot.y + tree.knot.r * 1.05} Q ${tree.knot.x - tree.knot.r * 0.8} ${tree.knot.y + tree.knot.r * 0.1} ${tree.knot.x - tree.knot.r * 0.15} ${tree.knot.y - tree.knot.r * 1.05} Z`}
                fill="#1E140D" />
              <ellipse cx={tree.knot.x - tree.knot.r * 0.1} cy={tree.knot.y - tree.knot.r * 0.2} rx={tree.knot.r * 0.28} ry={tree.knot.r * 0.4} fill="#9A7048" />
              </g>
            </g>
          )}

          {leaves.map(l => {
            const selected = selectedLeaf === l.index;
            const isNew = l.index >= firstNew;
            // Which edge faces the moon (the leaf is rotated, so check its upper edge's outward normal),
            // and the right side of the crown a touch brighter than the left
            const a = l.angle * Math.PI / 180, upperLit = MOON.x * Math.sin(a) - MOON.y * Math.cos(a) > 0;
            const lift = ((l.x - tree.crown.x) / Math.max(tree.crown.rx, 1)) * 0.07;
            return (
              <g key={l.index} transform={`translate(${l.x} ${l.y}) rotate(${l.angle}) scale(${l.scale})`}>
                {isNew && <circle cx={11} cy={0} r={16} fill={`url(#new-${id})`} className={`${flownIn ? "animate-land-glow" : "animate-new-glow"} pointer-events-none`} />}
                <g role="button" tabIndex={onLeafSelect ? 0 : -1} className={`group cursor-pointer outline-none ${isNew && !flownIn ? "animate-leaf-grow origin-left [transform-box:fill-box]" : ""}`}
                  aria-label={`${isNew ? "New leaf" : "Leaf"} ${l.index + 1} on ${pillar.name}`}
                  onClick={e => onLeafSelect?.(l.index, e.currentTarget)} onKeyDown={e => onKey(e, () => onLeafSelect?.(l.index, e.currentTarget))}>
                  <path d={LEAF} fill={`url(#leaf-${id})`}
                    // A selected leaf just stands a little larger (scale-125), no glow
                    style={{ filter: `brightness(${(0.78 + l.depth * 0.22 + l.tint * 0.12 + lift).toFixed(2)})` }}
                    className={`origin-left transition-transform duration-150 [transform-box:fill-box] ${selected
                      ? "scale-125 stroke-[rgba(20,30,15,.4)] [stroke-width:0.5]"
                      : "stroke-[rgba(20,30,15,.4)] [stroke-width:0.5] group-hover:scale-115 group-focus-visible:scale-125 group-focus-visible:stroke-amber group-focus-visible:[stroke-width:1.8]"}`} />
                  <path d={upperLit ? "M1.2 -0.3 Q 11 -9.2 22.4 -0.1" : "M1.2 0.3 Q 11 9.2 22.4 0.1"} fill="none" stroke={shade(color, 0.65)}
                    strokeWidth={0.8} strokeLinecap="round" opacity={0.75} className="pointer-events-none" />
                  <path d={LEAF_MIDRIB} stroke="rgba(255,255,255,.4)" strokeWidth={0.6} fill="none" className="pointer-events-none" />
                  <path d={LEAF_VEINS} stroke="rgba(255,255,255,.22)" strokeWidth={0.35} fill="none" strokeLinecap="round" className="pointer-events-none" />
                </g>
              </g>
            );
          })}
        </g>

        {scenery.mushrooms.map((m, i) => (
          <g key={i} transform={`translate(${m.x} ${GROUND_Y + 4}) scale(${m.s})`} className="pointer-events-none">
            <circle r={10} cy={-6} fill={`url(#shroom-${id})`} className="animate-glow" style={{ animationDelay: `${-i * 1.7}s` }} />
            <rect x={-1.2} y={-6} width={2.4} height={6} rx={1} fill="#EDE3CC" />
            <path d="M-5 -5 Q 0 -12 5 -5 Z" fill={m.cap} />
          </g>
        ))}
        {scenery.tufts.filter(t => t.y > GROUND_Y + 1).map((t, i) => <Tuft key={i} {...t} />)}
      </svg>

      {/* Zoomed far out (e.g. beside a panel), the names stop shrinking so the leaf count stays readable */}
      <figcaption className="mt-1 text-center [zoom:max(1,calc(.95/var(--cam-k,1)))]">
        <button type="button" onClick={() => onOpenTrail?.()} disabled={!onOpenTrail}
          className="group inline-flex cursor-pointer flex-col items-center rounded-lg px-2.5 py-1 font-display text-name font-medium text-sky [text-shadow:0_2px_10px_rgba(20,18,40,.8)] focus-visible:outline-3 focus-visible:outline-amber disabled:cursor-default">
          {/* Hovering glows the name only, no box */}
          <span className="transition-[text-shadow] duration-200 group-enabled:group-hover:[text-shadow:0_0_14px_rgba(255,227,163,.9),0_2px_10px_rgba(20,18,40,.8)]">{pillar.name}</span>
          {onOpenTrail && (
            <span className="mt-0.5 font-body text-xs font-medium text-sky-soft opacity-70 transition-opacity group-hover:opacity-100 group-hover/tree:opacity-100">
              {n} {n === 1 ? "leaf" : "leaves"}
            </span>
          )}
        </button>
      </figcaption>
    </figure>
  );
}

// A clump of filled, tapered blades. Clumps behind the trunk (higher on the mound) are darker; nearer ones
// catch a little moonlight at the tips.
function Tuft({ x, y, h, blades }: { x: number; y: number; h: number; blades: { dx: number; lean: number; h: number }[] }) {
  const near = y > GROUND_Y + 1;
  return (
    <g transform={`translate(${x} ${y})`} className="pointer-events-none">
      {blades.map((b, i) => (
        <path key={i} fill={near ? (i % 2 ? "#7C9C58" : "#5F8046") : (i % 2 ? "#557345" : "#47633A")}
          d={`M${b.dx - 1.1} 0 Q ${b.dx + b.lean * 0.35 - 0.3} ${-b.h * 0.55} ${b.dx + b.lean} ${-b.h} Q ${b.dx + b.lean * 0.35 + 0.5} ${-b.h * 0.5} ${b.dx + 1.1} 0 Z`} />
      ))}
    </g>
  );
}
