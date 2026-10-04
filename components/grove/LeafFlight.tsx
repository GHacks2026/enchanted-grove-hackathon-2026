"use client";

// The core moment (CONTEXT §9): a confirmed bloom becomes a leaf that travels from its review card
// to its tree and lands. GroveCanvas runs these one at a time and grows the real leaf on landing.
import { useEffect, useRef } from "react";
import { LEAF_PATH } from "@/components/tree/treeModel";

type Point = { x: number; y: number };

interface Props {
  from: Point;
  /** Where the leaf's centre lands, in screen pixels */
  to: Point;
  color: string;
  /** The landed leaf's angle (degrees) and on-screen length (px) */
  angle: number;
  length: number;
  onLanded: () => void;
}

export default function LeafFlight({ from, to, color, angle, length, onLanded }: Props) {
  const ref = useRef<SVGSVGElement>(null);
  const landed = useRef(onLanded);
  landed.current = onLanded;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = length, h = length * (12 / 23);
    const at = (p: Point) => `translate(${p.x - w / 2}px, ${p.y - h / 2}px)`;
    // Arc up and over, drifting and turning like a falling leaf in reverse, then settle at its angle
    const mid = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 140 };
    const anim = el.animate([
      { transform: `${at(from)} rotate(-30deg) scale(1.6)`, opacity: 0 },
      { transform: `${at({ x: from.x - 20, y: from.y - 30 })} rotate(-60deg) scale(1.6)`, opacity: 1, offset: 0.15 },
      { transform: `${at(mid)} rotate(${angle - 200}deg) scale(1.3)`, offset: 0.55 },
      { transform: `${at(to)} rotate(${angle}deg) scale(1)`, opacity: 1 },
    ], { duration: 1300, easing: "cubic-bezier(.45,.05,.35,1)", fill: "forwards" });
    anim.onfinish = () => landed.current();
    return () => anim.cancel();
  }, [from, to, angle, length]);

  return (
    <svg ref={ref} aria-hidden viewBox="0 -6 23 12" width={length} height={length * (12 / 23)}
      className="pointer-events-none fixed top-0 left-0 z-30 overflow-visible opacity-0"
      style={{ filter: "drop-shadow(0 0 6px rgba(255,227,163,.8))" }}>
      <path d={LEAF_PATH} fill={color} />
      <path d="M1.5 0 Q 10 -1 19 0" stroke="rgba(255,255,255,.45)" strokeWidth={0.6} fill="none" />
    </svg>
  );
}
