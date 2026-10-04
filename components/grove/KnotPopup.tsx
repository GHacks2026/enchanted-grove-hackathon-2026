// A tapped knot opens as a slice of wood cut through it: a bark rim around a sanded face, growth rings
// bending around the knot's dark heart near one edge, and a fine check (crack) where it dried.
// The words sit on the face, clear of the rim.
import type { CSSProperties, ReactNode } from "react";

interface Props {
  style: CSSProperties;
  label: string;
  children: ReactNode;
}

// The knot's heart sits in the margin at the lower left, clear of the words
const HEART = { x: 8.5, y: 47 };
const BARK = "#4A3424", INNER_BARK = "#7A5A3E", INK = "#5A3E28";

/** A rounded, slightly irregular slab outline (a superellipse with a gentle wobble), in a 100×62 box. */
function slab(inset: number, seed: number) {
  const pts: string[] = [];
  const rx = 50 - inset, ry = 31 - inset * 0.62, n = 3.2;
  for (let i = 0; i < 64; i++) {
    const t = (i / 64) * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
    const wob = 1 + 0.018 * Math.sin(3 * t + seed) + 0.012 * Math.sin(7 * t + seed * 2);
    const x = 50 + rx * wob * Math.sign(c) * Math.abs(c) ** (2 / n);
    const y = 31 + ry * wob * Math.sign(s) * Math.abs(s) ** (2 / n);
    pts.push(`${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return `M${pts.join(" L")} Z`;
}

/** Growth ring k around the knot's heart: wider than tall, each a little less round than the last */
function ring(k: number) {
  const cx = HEART.x, cy = HEART.y, pts: string[] = [];
  for (let i = 0; i < 48; i++) {
    const t = (i / 48) * Math.PI * 2;
    const r = 1 + 0.05 * Math.sin(2 * t + k) + 0.03 * Math.sin(5 * t + k * 1.7);
    pts.push(`${(cx + Math.cos(t) * k * 9 * r).toFixed(2)} ${(cy + Math.sin(t) * k * 5.2 * r).toFixed(2)}`);
  }
  return `M${pts.join(" L")} Z`;
}

const OUTER = slab(0, 1.3), FACE = slab(3.2, 2.1), RINGS = Array.from({ length: 11 }, (_, i) => ring(i + 1));

export default function KnotPopup({ style, label, children }: Props) {
  return (
    <div role="dialog" aria-label={label}
      className="animate-rise-in absolute z-20 w-[min(340px,calc(100%-1.5rem))]"
      style={{ ...style, "--pop-ink": INK } as CSSProperties}>
      <svg aria-hidden viewBox="0 0 100 62" preserveAspectRatio="none"
        className="absolute inset-0 size-full overflow-visible [filter:drop-shadow(0_12px_16px_rgb(10_8_30/.55))]">
        <defs>
          <radialGradient id="knot-pop-face" cx="40%" cy="55%" r="70%">
            <stop offset="0" stopColor="#F2E2C2" /><stop offset=".65" stopColor="#EAD3A8" /><stop offset="1" stopColor="#D9B988" />
          </radialGradient>
          <clipPath id="knot-pop-clip"><path d={FACE} /></clipPath>
        </defs>
        <path d={OUTER} fill={BARK} />
        <path d={slab(1.6, 1.7)} fill={INNER_BARK} />
        <path d={FACE} fill="url(#knot-pop-face)" />
        <g clipPath="url(#knot-pop-clip)" fill="none" stroke="#A97E4F" vectorEffect="non-scaling-stroke">
          {RINGS.map((d, i) => <path key={i} d={d} strokeOpacity={0.3 - i * 0.015} strokeWidth={1} vectorEffect="non-scaling-stroke" />)}
          {/* The knot's heart */}
          <ellipse cx={HEART.x} cy={HEART.y} rx={2.6} ry={2.2} fill="#6B4A30" stroke="#3E2A1B" strokeOpacity={0.6} />
          <ellipse cx={HEART.x + 0.3} cy={HEART.y - 0.3} rx={1} ry={0.8} fill="#3E2A1B" stroke="none" />
          {/* A dry check running in from the rim */}
          <path d="M96 20 L89 22.5 L86 22 L81 24" stroke="#5A3E28" strokeOpacity={0.45} strokeWidth={1} vectorEffect="non-scaling-stroke" />
        </g>
      </svg>
      <div className="relative px-[13%] py-[12%] text-ink">{children}</div>
    </div>
  );
}
