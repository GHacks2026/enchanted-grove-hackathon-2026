// A tapped leaf opens as a larger copy of itself: a pale leaf in its tree's color, with a midrib and
// veins, its stem reaching back toward the leaf on the tree. The words sit in the widest part.
import type { CSSProperties, ReactNode } from "react";
import { shade } from "@/components/tree/colors";

interface Props {
  color: string;
  /** Which way the stem points: toward the tapped leaf */
  stem: "left" | "right";
  style: CSSProperties;
  label: string;
  children: ReactNode;
}

// Base at the left, tip at the right. Nearly symmetric end to end, so the words fit whichever way
// it faces; the tip leans a touch upward like a real blade.
const BLADE = "M2 31 C 9 -7, 80 -9, 98 30 C 80 69, 9 69, 2 31 Z";
const VEINS = [
  [20, 6, 27, 30], [37, 2, 44, 30], [55, 2, 61, 30], [72, 6, 77, 30], [86, 15, 89, 29],
  [20, 56, 27, 31], [37, 59, 44, 31], [55, 59, 61, 31], [72, 55, 77, 31], [86, 45, 89, 30],
];

export default function LeafPopup({ color, stem, style, label, children }: Props) {
  const light = shade(color, 0.8), mid = shade(color, 0.62), dark = shade(color, -0.35);
  return (
    <div role="dialog" aria-label={label}
      className={`animate-leaf-open absolute z-20 w-[min(340px,calc(100%-1.5rem))] ${stem === "left" ? "origin-left" : "origin-right"}`}
      style={{ ...style, "--pop-ink": shade(color, -0.6) } as CSSProperties}>
      <svg aria-hidden viewBox="0 0 100 62" preserveAspectRatio="none"
        className={`absolute inset-0 size-full overflow-visible [filter:drop-shadow(0_12px_16px_rgb(10_8_30/.5))] ${stem === "right" ? "-scale-x-100" : ""}`}>
        <defs>
          <radialGradient id="leaf-pop-blade" cx="45%" cy="45%" r="65%">
            <stop offset="0" stopColor={light} /><stop offset=".7" stopColor={light} /><stop offset="1" stopColor={mid} />
          </radialGradient>
          {/* The midrib shows at the stem and tip and fades out behind the words */}
          <linearGradient id="leaf-pop-rib" x1="0" x2="1">
            <stop offset="0" stopColor={dark} stopOpacity=".55" /><stop offset=".2" stopColor={dark} stopOpacity=".06" />
            <stop offset=".8" stopColor={dark} stopOpacity=".06" /><stop offset="1" stopColor={dark} stopOpacity=".5" />
          </linearGradient>
        </defs>
        <path d="M4 31 C -1 33, -4 37, -8 42" fill="none" stroke={dark} strokeWidth={1.4} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <path d={BLADE} fill="url(#leaf-pop-blade)" stroke={shade(color, 0.2)} strokeWidth={1} vectorEffect="non-scaling-stroke" />
        <path d="M4 31 Q 50 28 95 29.5" fill="none" stroke="url(#leaf-pop-rib)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        {VEINS.map(([x0, y0, x1, y1], i) => (
          <path key={i} d={`M${x1} ${y1} Q ${(x0 + x1) / 2 + 2} ${(y0 + y1) / 2} ${x0} ${y0}`} fill="none"
            stroke={dark} strokeOpacity={0.1} strokeWidth={1} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      {/* The inscribed middle of the blade, clear of its pointed ends and curved edges (vertical padding
          is a share of the width, so the leaf stays full however long the words run) */}
      <div className="relative px-[16%] py-[13%] text-ink">{children}</div>
    </div>
  );
}
