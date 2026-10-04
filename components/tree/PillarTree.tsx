"use client";

// One tree for one Pillar (issue #4). Draws leaf_count leaves and a bark knot when has_knot.
// Tap the tree (or its name) to see its progress; tap a single leaf to see that one moment.
// Newly added leaves (newCount) pop in with a sparkle and keep a soft golden glow.
// Grass, mushrooms and the breeze are scenery only. Leaves are the only progress.
import { useMemo } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import type { GrovePillar } from "@/lib/client";
import { pillarColor, shade } from "./colors";
import { buildTree, GROUND_Y, seeded, TREE_H, TREE_W } from "./treeModel";

interface Props {
  pillar: GrovePillar;
  selectedLeaf?: number | null;
  knotSelected?: boolean;
  /** How many of the newest leaves to celebrate (e.g. just confirmed) */
  newCount?: number;
  onLeafSelect?: (index: number, anchor: Element) => void;
  onKnotSelect?: (anchor: Element) => void;
  onOpenTrail?: () => void;
}

const LEAF = "M0 0 Q 11 -9.5 23 0 Q 11 9.5 0 0 Z";
const CX = TREE_W / 2;
const BARK_DARK = "#43301F", BARK = "#6B4E3A", BARK_LIGHT = "#9A7759";

export default function PillarTree({ pillar, selectedLeaf, knotSelected, newCount = 0, onLeafSelect, onKnotSelect, onOpenTrail }: Props) {
  const tree = useMemo(() => buildTree(pillar.id, pillar.leaf_count), [pillar.id, pillar.leaf_count]);
  const color = pillarColor(pillar.position);
  const n = pillar.leaf_count;
  const id = pillar.id;
  const firstNew = n - Math.min(newCount, n);

  const scenery = useMemo(() => {
    const r = seeded(`${id}:scenery`);
    return {
      tufts: Array.from({ length: 7 }, (_, i) => ({ x: 52 + i * 26 + (r() - 0.5) * 12, h: 6 + r() * 6, lean: (r() - 0.5) * 4 })),
      mushrooms: Array.from({ length: r() < 0.5 ? 1 : 2 }, (_, i) => ({ x: CX + (i % 2 ? 1 : -1) * (52 + r() * 28), s: 0.8 + r() * 0.5, cap: r() < 0.5 ? "#F2C7D3" : "#F3DDA6" })),
      sway: 8 + r() * 4, delay: -r() * 8,
    };
  }, [id]);

  // Back leaves first and a little darker, so the crown has depth
  const leaves = useMemo(() => [...tree.leaves].sort((a, b) => a.depth - b.depth), [tree.leaves]);

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
          <radialGradient id={`glow-${id}`}><stop offset="0" stopColor={color} stopOpacity=".42" /><stop offset="1" stopColor={color} stopOpacity="0" /></radialGradient>
          <linearGradient id={`trunk-${id}`} x1="0" x2="1">
            <stop offset="0" stopColor={BARK_LIGHT} /><stop offset=".4" stopColor={BARK} /><stop offset="1" stopColor={BARK_DARK} />
          </linearGradient>
          <linearGradient id={`leaf-${id}`} x1="0" x2="1">
            <stop offset="0" stopColor={shade(color, -0.25)} /><stop offset=".55" stopColor={color} /><stop offset="1" stopColor={shade(color, 0.4)} />
          </linearGradient>
          <radialGradient id={`new-${id}`}><stop offset="0" stopColor="#FFE3A3" stopOpacity=".9" /><stop offset="1" stopColor="#FFE3A3" stopOpacity="0" /></radialGradient>
          <radialGradient id={`shroom-${id}`}><stop offset="0" stopColor="#FFE9B8" stopOpacity=".5" /><stop offset="1" stopColor="#FFE9B8" stopOpacity="0" /></radialGradient>
        </defs>

        {n > 0 && (
          <ellipse cx={tree.crown.x} cy={tree.crown.y} rx={tree.crown.rx + 20} ry={tree.crown.ry + 18}
            fill={`url(#glow-${id})`} opacity={Math.min(1, 0.5 + n * 0.04)} />
        )}

        {/* A low mound where the tree meets the meadow */}
        <ellipse cx={CX} cy={GROUND_Y + 4} rx={70} ry={9} fill="#3C5530" opacity={0.9} />

        <g className="animate-breeze" style={sway}>
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
                    <path d={l.d} fill={BARK_DARK} />
                    <path d={l.highlight} fill="none" stroke={BARK_LIGHT} strokeWidth={1} strokeLinecap="round" opacity={0.55} />
                  </g>
                ))}
                <path d={tree.trunk} fill={`url(#trunk-${id})`} />
                <path d={`M${CX - tree.baseW * 0.3} ${GROUND_Y - 8} Q ${CX - tree.baseW * 0.2} ${GROUND_Y - tree.height * 0.2} ${CX - tree.baseW * 0.1} ${GROUND_Y - tree.height * 0.38}`}
                  fill="none" stroke={BARK_DARK} strokeWidth={1} opacity={0.4} strokeLinecap="round" />
                <path d={`M${CX + tree.baseW * 0.35} ${GROUND_Y - 6} Q ${CX + tree.baseW * 0.25} ${GROUND_Y - tree.height * 0.16} ${CX + tree.baseW * 0.15} ${GROUND_Y - tree.height * 0.3}`}
                  fill="none" stroke={BARK_DARK} strokeWidth={0.9} opacity={0.35} strokeLinecap="round" />
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
              <ellipse cx={tree.knot.x} cy={tree.knot.y} rx={tree.knot.r} ry={tree.knot.r * 1.45} fill="#3A291D" />
              <ellipse cx={tree.knot.x} cy={tree.knot.y} rx={tree.knot.r * 0.55} ry={tree.knot.r * 0.85} fill="none"
                className={knotSelected ? "stroke-amber [stroke-width:2]" : "stroke-[#C29E7C] [stroke-width:1.6] group-hover:stroke-amber group-focus-visible:stroke-amber"} />
              <circle cx={tree.knot.x} cy={tree.knot.y} r={1.5} fill="#2A1D14" />
            </g>
          )}

          {leaves.map(l => {
            const selected = selectedLeaf === l.index;
            const isNew = l.index >= firstNew;
            return (
              <g key={l.index} transform={`translate(${l.x} ${l.y}) rotate(${l.angle}) scale(${l.scale})`}>
                {isNew && <circle cx={11} cy={0} r={16} fill={`url(#new-${id})`} className="animate-glow pointer-events-none" />}
                <g role="button" tabIndex={onLeafSelect ? 0 : -1} className="group cursor-pointer outline-none"
                  aria-label={`${isNew ? "New leaf" : "Leaf"} ${l.index + 1} on ${pillar.name}`}
                  onClick={e => onLeafSelect?.(l.index, e.currentTarget)} onKeyDown={e => onKey(e, () => onLeafSelect?.(l.index, e.currentTarget))}>
                  <path d={LEAF} fill={`url(#leaf-${id})`}
                    style={{ filter: `brightness(${(0.78 + l.depth * 0.22 + l.tint * 0.12).toFixed(2)})` }}
                    className={`origin-left transition-transform duration-150 [transform-box:fill-box] ${isNew ? "animate-leaf-pop" : ""} ${selected
                      ? "scale-125 stroke-amber [stroke-width:1.8]"
                      : isNew
                        ? "stroke-[#FFE3A3] [stroke-width:1.1] group-hover:scale-115"
                        : "stroke-[rgba(20,30,15,.4)] [stroke-width:0.5] group-hover:scale-115 group-focus-visible:scale-125 group-focus-visible:stroke-amber group-focus-visible:[stroke-width:1.8]"}`} />
                  <path d="M1.5 0 Q 10 -1 19 0" stroke="rgba(255,255,255,.4)" strokeWidth={0.6} fill="none" className="pointer-events-none" />
                </g>
                {isNew && (
                  <g className="pointer-events-none" fill="#FFF3CF">
                    {[[-4, -12, 0], [26, -9, 0.15], [12, 14, 0.3]].map(([x, y, d], i) => (
                      <path key={i} d={`M${x} ${y - 3} L${x + 0.8} ${y - 0.8} L${x + 3} ${y} L${x + 0.8} ${y + 0.8} L${x} ${y + 3} L${x - 0.8} ${y + 0.8} L${x - 3} ${y} L${x - 0.8} ${y - 0.8} Z`}
                        className="animate-sparkle [transform-box:fill-box] origin-center" style={{ animationDelay: `${d}s` }} />
                    ))}
                  </g>
                )}
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
        {scenery.tufts.map((t, i) => (
          <g key={i} transform={`translate(${t.x} ${GROUND_Y + 6})`} className="pointer-events-none" stroke="#86A75E" strokeWidth={1.2} strokeLinecap="round" fill="none">
            <path d={`M0 0 Q ${t.lean} ${-t.h * 0.6} ${t.lean * 1.5 - 2} ${-t.h}`} />
            <path d={`M2 0 Q ${2 + t.lean} ${-t.h * 0.7} ${3 + t.lean * 1.5} ${-t.h * 1.2}`} stroke="#A2BF77" />
            <path d={`M4 0 Q ${4 + t.lean} ${-t.h * 0.5} ${6 + t.lean} ${-t.h * 0.8}`} />
          </g>
        ))}
      </svg>

      <figcaption className="mt-1 text-center">
        <button type="button" onClick={() => onOpenTrail?.()} disabled={!onOpenTrail}
          className="group inline-flex cursor-pointer flex-col items-center rounded-lg px-2.5 py-1 font-display text-xl leading-tight text-sky [text-shadow:0_2px_10px_rgba(20,18,40,.8)] hover:bg-sky/10 focus-visible:outline-3 focus-visible:outline-amber disabled:cursor-default disabled:hover:bg-transparent">
          {pillar.name}
          {onOpenTrail && (
            <span className="mt-0.5 font-body text-xs text-sky-soft opacity-70 transition-opacity group-hover:opacity-100 group-hover/tree:opacity-100">
              See progress
            </span>
          )}
        </button>
      </figcaption>
    </figure>
  );
}
