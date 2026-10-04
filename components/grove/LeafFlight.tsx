"use client";

// The core moment (CONTEXT §9): a confirmed bloom becomes a leaf that travels from its review card
// to its tree and lands. GroveCanvas runs these one at a time and grows the real leaf on landing.
import { useEffect, useRef } from "react";
import { LEAF_MIDRIB, LEAF_PATH, LEAF_VEINS } from "@/components/tree/treeModel";
import { shade } from "@/components/tree/colors";

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

const STEPS = 40;

export default function LeafFlight({ from, to, color, angle, length, onLanded }: Props) {
  const ref = useRef<SVGSVGElement>(null);
  const landed = useRef(onLanded);
  landed.current = onLanded;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = length, h = length * (12 / 23);
    // One smooth arc up and over (a quadratic curve, sampled), kept on screen
    const ctrl = { x: (from.x + to.x) / 2, y: Math.max(40, Math.min(from.y, to.y) - 160) };
    // It tumbles one way the whole trip, with a flutter that dies away, and ends exactly at its angle
    const keyframes = Array.from({ length: STEPS + 1 }, (_, i) => {
      const t = i / STEPS, u = 1 - t;
      const x = u * u * from.x + 2 * u * t * ctrl.x + t * t * to.x;
      const y = u * u * from.y + 2 * u * t * ctrl.y + t * t * to.y;
      const rot = angle - 320 * u * u + 14 * Math.sin(t * Math.PI * 4) * u;
      const scale = 1 + 0.6 * u * u;
      return {
        transform: `translate(${x - w / 2}px, ${y - h / 2}px) rotate(${rot}deg) scale(${scale})`,
        opacity: Math.min(1, t / 0.1),
        offset: t,
      };
    });
    const anim = el.animate(keyframes, { duration: 1400, easing: "cubic-bezier(.3,.1,.25,1)", fill: "forwards" });
    anim.onfinish = () => landed.current();
    return () => anim.cancel();
  }, [from, to, angle, length]);

  return (
    <svg ref={ref} aria-hidden viewBox="0 -6 23 12" width={length} height={length * (12 / 23)}
      className="pointer-events-none fixed top-0 left-0 z-30 overflow-visible opacity-0"
      style={{ filter: "drop-shadow(0 0 6px rgba(255,227,163,.8))" }}>
      {/* The same gradient as the leaves on the tree, so the landing swap is seamless */}
      <defs>
        <linearGradient id="leaf-flight" x1="0" x2="1">
          <stop offset="0" stopColor={shade(color, -0.25)} /><stop offset=".55" stopColor={color} /><stop offset="1" stopColor={shade(color, 0.4)} />
        </linearGradient>
      </defs>
      <path d={LEAF_PATH} fill="url(#leaf-flight)" />
      <path d={LEAF_MIDRIB} stroke="rgba(255,255,255,.45)" strokeWidth={0.6} fill="none" />
      <path d={LEAF_VEINS} stroke="rgba(255,255,255,.22)" strokeWidth={0.35} fill="none" strokeLinecap="round" />
    </svg>
  );
}
