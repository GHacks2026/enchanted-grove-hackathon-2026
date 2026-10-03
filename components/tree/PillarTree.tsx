"use client";

// One tree for one Pillar (issue #4). Pure view: draws leaf_count leaves and a knot when has_knot.
// Leaves and the knot are buttons; the Grove decides what to show when they're tapped.
// Grass, mushrooms and the breeze are scenery only. Leaves are the only evidence.
import { useMemo } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import type { GrovePillar } from "@/lib/client";
import { pillarColor, shade } from "./colors";
import { buildTree, GROUND_Y, seeded, TREE_H, TREE_W } from "./treeModel";

interface Props {
  pillar: GrovePillar;
  selectedLeaf?: number | null;
  knotSelected?: boolean;
  onLeafSelect?: (index: number, anchor: Element) => void;
  onKnotSelect?: (anchor: Element) => void;
  onOpenTrail?: () => void;
}

const LEAF = "M0 0 Q 11 -9.5 23 0 Q 11 9.5 0 0 Z";
const CX = TREE_W / 2;
const BARK_DARK = "#4A3527", BARK = "#6B4E3A", BARK_LIGHT = "#8F6E52";

export default function PillarTree({ pillar, selectedLeaf, knotSelected, onLeafSelect, onKnotSelect, onOpenTrail }: Props) {
  const tree = useMemo(() => buildTree(pillar.id, pillar.leaf_count), [pillar.id, pillar.leaf_count]);
  const color = pillarColor(pillar.position);
  const n = pillar.leaf_count;
  const id = pillar.id;

  // Scenery, seeded from the pillar so it never jumps around between loads
  const scenery = useMemo(() => {
    const r = seeded(`${id}:scenery`);
    const tufts = Array.from({ length: 7 }, (_, i) => ({ x: 52 + i * 26 + (r() - 0.5) * 12, h: 6 + r() * 6, lean: (r() - 0.5) * 4 }));
    const mushrooms = Array.from({ length: r() < 0.5 ? 1 : 2 }, (_, i) => ({
      x: CX + (i % 2 ? 1 : -1) * (48 + r() * 30), s: 0.8 + r() * 0.5, cap: r() < 0.5 ? "#F2C7D3" : "#F3DDA6",
    }));
    const bark = Array.from({ length: 3 }, () => (r() - 0.5) * 1.2);
    const roots = [-1, 1, r() < 0.5 ? -1 : 1].map((side, i) => ({ side, reach: 10 + r() * 10 + i * 3 }));
    return { tufts, mushrooms, bark, roots, sway: 7 + r() * 4, delay: -r() * 8 };
  }, [id]);

  const onKey = (e: KeyboardEvent, act: () => void) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); act(); }
  };

  const sway: CSSProperties = {
    animationDuration: `${scenery.sway.toFixed(1)}s`, animationDelay: `${scenery.delay.toFixed(1)}s`,
    transformOrigin: `${CX}px ${GROUND_Y}px`, transformBox: "view-box",
  };

  return (
    <figure className="m-0 flex w-[260px] flex-col items-center">
      <svg
        viewBox={`0 0 ${TREE_W} ${TREE_H}`} width={TREE_W} height={TREE_H} className="block overflow-visible"
        role="group" aria-label={`${pillar.name}: ${n} ${n === 1 ? "leaf" : "leaves"}${pillar.has_knot ? ", with recent friction" : ""}`}
      >
        <defs>
          <radialGradient id={`glow-${id}`}>
            <stop offset="0" stopColor={color} stopOpacity=".4" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`trunk-${id}`} x1="0" x2="1">
            <stop offset="0" stopColor={BARK_LIGHT} /><stop offset=".45" stopColor={BARK} /><stop offset="1" stopColor={BARK_DARK} />
          </linearGradient>
          <linearGradient id={`leaf-${id}`} x1="0" x2="1">
            <stop offset="0" stopColor={shade(color, -0.2)} /><stop offset=".55" stopColor={color} /><stop offset="1" stopColor={shade(color, 0.4)} />
          </linearGradient>
          <linearGradient id={`mound-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#56763F" /><stop offset="1" stopColor="#2B3D24" />
          </linearGradient>
          <radialGradient id={`shroom-${id}`}>
            <stop offset="0" stopColor="#FFE9B8" stopOpacity=".55" /><stop offset="1" stopColor="#FFE9B8" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Canopy glow that fills in as evidence grows */}
        {n > 0 && (
          <ellipse cx={tree.top.x} cy={tree.top.y + 34} rx={56 + n * 4} ry={46 + n * 3}
            fill={`url(#glow-${id})`} opacity={Math.min(1, 0.45 + n * 0.05)} />
        )}

        {/* Grassy mound */}
        <path d={`M34 ${GROUND_Y + 8} Q ${CX} ${GROUND_Y - 20} ${TREE_W - 34} ${GROUND_Y + 8} Q ${CX} ${GROUND_Y + 20} 34 ${GROUND_Y + 8} Z`}
          fill={`url(#mound-${id})`} />

        <g className="animate-breeze" style={sway}>
          {tree.seedling ? (
            <g>
              <path d={tree.trunk} fill="none" stroke={BARK} strokeWidth={3} strokeLinecap="round" />
              {/* A closed bud, not a leaf: leaves only come from confirmed evidence */}
              <ellipse cx={tree.top.x} cy={tree.top.y - 6} rx={4.5} ry={7} fill="#8E9C6E" />
              <path d={`M${tree.top.x - 2} ${tree.top.y - 10} Q ${tree.top.x} ${tree.top.y - 4} ${tree.top.x - 1} ${tree.top.y + 1}`} stroke="#B7C493" strokeWidth={1} fill="none" />
            </g>
          ) : (
            <>
              {scenery.roots.map((root, i) => (
                <path key={i} strokeLinecap="round" fill="none" stroke={BARK} strokeWidth={3 + tree.baseW * 0.25}
                  d={`M${CX + root.side * tree.baseW * 0.5} ${GROUND_Y - 3} Q ${CX + root.side * (tree.baseW + root.reach * 0.5)} ${GROUND_Y + 1} ${CX + root.side * (tree.baseW + root.reach)} ${GROUND_Y + 5}`} />
              ))}
              {tree.branches.map((b, i) => (
                <g key={i}>
                  <path d={b.d} fill="none" stroke={BARK_DARK} strokeWidth={b.width} strokeLinecap="round" />
                  <path d={b.d} fill="none" stroke={BARK_LIGHT} strokeWidth={Math.max(0.6, b.width * 0.35)} strokeLinecap="round" opacity={0.5} />
                </g>
              ))}
              <path d={tree.trunk} fill={`url(#trunk-${id})`} />
              {scenery.bark.map((o, i) => (
                <path key={i} fill="none" stroke={BARK_DARK} strokeWidth={0.9} opacity={0.45} strokeLinecap="round"
                  d={`M${CX + o * tree.baseW} ${GROUND_Y - 6} Q ${CX + o * tree.baseW * 0.7 + tree.lean * 0.1} ${GROUND_Y - tree.height * 0.3} ${CX + o * tree.baseW * 0.35 + tree.lean * 0.3} ${GROUND_Y - tree.height * 0.62}`} />
              ))}
            </>
          )}

          {pillar.has_knot && (
            <g
              role="button" tabIndex={onKnotSelect ? 0 : -1} className="group cursor-pointer outline-none"
              aria-label={`Recent friction in ${pillar.name}`}
              onClick={e => onKnotSelect?.(e.currentTarget)}
              onKeyDown={e => onKey(e, () => onKnotSelect?.(e.currentTarget))}
            >
              <circle cx={tree.knot.x} cy={tree.knot.y} r={14} fill="transparent" />
              <ellipse cx={tree.knot.x} cy={tree.knot.y} rx={tree.knot.r} ry={tree.knot.r * 1.45} fill="#3E2C20" />
              <ellipse cx={tree.knot.x} cy={tree.knot.y} rx={tree.knot.r * 0.55} ry={tree.knot.r * 0.85} fill="none"
                className={knotSelected ? "stroke-amber [stroke-width:1.8]" : "stroke-[#C29E7C] [stroke-width:1.5] group-hover:stroke-amber group-focus-visible:stroke-amber"} />
              <circle cx={tree.knot.x} cy={tree.knot.y} r={1.4} fill="#2A1D14" />
            </g>
          )}

          {tree.leaves.map(l => {
            const selected = selectedLeaf === l.index;
            return (
              <g key={l.index} transform={`translate(${l.x} ${l.y}) rotate(${l.angle}) scale(${l.scale})`}>
                <g
                  role="button" tabIndex={onLeafSelect ? 0 : -1} className="group cursor-pointer outline-none"
                  aria-label={`Leaf ${l.index + 1} on ${pillar.name}`}
                  onClick={e => onLeafSelect?.(l.index, e.currentTarget)}
                  onKeyDown={e => onKey(e, () => onLeafSelect?.(l.index, e.currentTarget))}
                >
                  <path d={LEAF} fill={`url(#leaf-${id})`} style={{ filter: `brightness(${(0.9 + l.tint * 0.25).toFixed(2)})` }}
                    className={`origin-left transition-transform duration-150 [transform-box:fill-box] ${selected
                      ? "scale-130 stroke-amber [stroke-width:2.2]"
                      : "stroke-[rgba(20,30,15,.45)] [stroke-width:0.6] group-hover:scale-125 group-focus-visible:scale-130 group-focus-visible:stroke-amber group-focus-visible:[stroke-width:2.2]"}`} />
                  <path d="M1.5 0 Q 10 -1 19 0" stroke="rgba(255,255,255,.4)" strokeWidth={0.7} fill="none" className="pointer-events-none" />
                </g>
              </g>
            );
          })}
        </g>

        {/* Scenery on the mound: grass and a tiny glowing mushroom or two */}
        {scenery.mushrooms.map((m, i) => (
          <g key={i} transform={`translate(${m.x} ${GROUND_Y + 3}) scale(${m.s})`} className="pointer-events-none">
            <circle r={10} cy={-6} fill={`url(#shroom-${id})`} className="animate-glow" style={{ animationDelay: `${-i * 1.7}s` }} />
            <rect x={-1.2} y={-6} width={2.4} height={6} rx={1} fill="#EDE3CC" />
            <path d="M-5 -5 Q 0 -12 5 -5 Z" fill={m.cap} />
            <circle cx={-1.5} cy={-7.5} r={0.8} fill="#fff" opacity={0.7} />
          </g>
        ))}
        {scenery.tufts.map((t, i) => (
          <g key={i} transform={`translate(${t.x} ${GROUND_Y + 4 + Math.abs(t.x - CX) * 0.06})`} className="pointer-events-none" stroke="#86A75E" strokeWidth={1.2} strokeLinecap="round" fill="none">
            <path d={`M0 0 Q ${t.lean} ${-t.h * 0.6} ${t.lean * 1.5 - 2} ${-t.h}`} />
            <path d={`M2 0 Q ${2 + t.lean} ${-t.h * 0.7} ${3 + t.lean * 1.5} ${-t.h * 1.2}`} stroke="#A2BF77" />
            <path d={`M4 0 Q ${4 + t.lean} ${-t.h * 0.5} ${6 + t.lean} ${-t.h * 0.8}`} />
          </g>
        ))}
      </svg>

      <figcaption className="mt-1 text-center">
        {!onOpenTrail ? (
          <span className="px-2.5 py-1 font-display text-xl leading-tight text-sky [text-shadow:0_2px_10px_rgba(20,18,40,.8)]">{pillar.name}</span>
        ) : (
          <button type="button" onClick={onOpenTrail}
            className="group inline-flex cursor-pointer flex-col items-center rounded-lg px-2.5 py-1 font-display text-xl leading-tight text-sky [text-shadow:0_2px_10px_rgba(20,18,40,.8)] hover:bg-sky/10 focus-visible:outline-3 focus-visible:outline-amber">
            {pillar.name}
            <span className="mt-0.5 font-body text-xs text-sky-soft opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 [@media(hover:none)]:opacity-80">
              See evidence
            </span>
          </button>
        )}
      </figcaption>
    </figure>
  );
}
