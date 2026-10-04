// Tomorrow's Lantern as a small forged-iron lantern with a candle inside, hanging under the goal, as if from a branch above the glade,
// with a few moths drawn to its light. Its next step is written beside it (GroveCanvas).
// Unlit (no moths) until the first confirm, when GET /api/grove still returns lantern: null.
import type { CSSProperties } from "react";

const IRON = "#2B2420";

const MOTHS = [
  { r: 17, dur: 7, delay: 0, size: 0.9 },
  { r: 23, dur: 9.5, delay: -3.2, size: 0.75 },
  { r: 13, dur: 6, delay: -1.6, size: 0.65 },
];

/** `celebrate`: the user just followed their Lantern (or a new one arrived), so it flares up for a moment.
 *  `mothsAway`: its moths have just flown off into the glade (FreedMoths); new ones gather when it turns false. */
export default function LanternPost({ lit, celebrate = false, mothsAway = false }: { lit: boolean; celebrate?: boolean; mothsAway?: boolean }) {
  // The iron catches a little of the candle's light when lit
  const edge = lit ? "#A9793A" : "#5E5248";
  return (
    <div aria-hidden data-lantern className="relative h-[52px] w-9 flex-none">
      <svg viewBox="0 0 36 52" className="absolute inset-0 overflow-visible">
        <defs>
          <radialGradient id="lantern-light">
            <stop offset="0" stopColor="#FFE3A3" stopOpacity=".75" />
            <stop offset="1" stopColor="#FFE3A3" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="lantern-glass" cx=".5" cy=".42" r=".7">
            <stop offset="0" stopColor="#FFE9B0" />
            <stop offset=".55" stopColor="#F2BE5C" />
            <stop offset="1" stopColor="#C98A2E" />
          </radialGradient>
        </defs>
        {lit && <circle cx="18" cy="30" r="26" fill="url(#lantern-light)" className="animate-lantern" />}
        {celebrate && <circle cx="18" cy="28" r="40" fill="url(#lantern-light)" className="animate-lantern-flare origin-center [transform-box:fill-box]" />}
        {/* The cord it hangs from, and its ring */}
        <path d="M18 0 V6.5" stroke="#8C7A5E" strokeWidth="1.2" opacity=".7" />
        <circle cx="18" cy="8.4" r="2" fill="none" stroke={IRON} strokeWidth="1.3" />
        {/* Forged iron cap: a pointed dome with a finial, over a brim */}
        <path d="M9.6 17.6 Q 10.4 13.4 18 10.6 Q 25.6 13.4 26.4 17.6 Z" fill={IRON} />
        <path d="M11.6 16.2 Q 13 13.6 17 11.8" fill="none" stroke={edge} strokeWidth=".8" strokeLinecap="round" />
        <rect x="8.4" y="17" width="19.2" height="2.4" rx="1.1" fill={IRON} />
        {/* Glass cage, tapering to the base, with the candle inside */}
        <path d="M10.6 19.4 H25.4 L23.6 36.6 H12.4 Z" fill={lit ? "url(#lantern-glass)" : "#45405E"} className={lit ? "animate-lantern" : undefined} />
        <rect x="16.4" y="29.4" width="3.2" height="7.2" rx=".6" fill={lit ? "#F6EBCB" : "#8E8775"} />
        <path d="M18 29.4 V28" stroke={IRON} strokeWidth=".7" />
        {lit && (
          <g className="animate-lantern">
            <path d="M18 21.6 C 20.4 24.4 20.2 27.2 18 28.2 C 15.8 27.2 15.6 24.4 18 21.6 Z" fill="#FFD27A" />
            <path d="M18 24 C 19.1 25.6 19 27.2 18 27.7 C 17 27.2 16.9 25.6 18 24 Z" fill="#FFF6DD" />
          </g>
        )}
        {!lit && <path d="M12.4 21.5 L13.6 33" stroke="#EEF0E2" strokeWidth=".8" opacity=".25" strokeLinecap="round" />}
        {/* Iron frame: the cage's edges and two bars */}
        <path d="M10.6 19.4 L12.4 36.6 M25.4 19.4 L23.6 36.6 M15.5 19.4 L16 36.6 M20.5 19.4 L20 36.6" stroke={IRON} strokeWidth="1.15" strokeLinecap="round" />
        {/* Base and the drop beneath it */}
        <rect x="11" y="36.2" width="14" height="2.4" rx="1.1" fill={IRON} />
        <path d="M14.4 38.6 H21.6 L18.6 43.4 Q 18 44.4 17.4 43.4 Z" fill={IRON} />
        <path d="M12 37.1 H16" stroke={edge} strokeWidth=".7" strokeLinecap="round" />
      </svg>

      {lit && MOTHS.map((m, i) => (
        <span key={i} className={`animate-moth-orbit absolute top-[28px] left-[18px] size-0 transition-opacity duration-[2500ms] ${mothsAway ? "opacity-0 duration-150" : "opacity-100"}`}
          style={{ "--r": `${m.r}px`, animationDuration: `${m.dur}s`, animationDelay: `${m.delay}s` } as CSSProperties}>
          <svg viewBox="-6 -4 12 8" width={12 * m.size} height={8 * m.size} className="-translate-x-1/2 -translate-y-1/2 overflow-visible">
            <g className="animate-moth-flap" style={{ animationDelay: `${m.delay / 4}s` }}>
              <ellipse cx="-2.6" cy="0" rx="3" ry="2.2" fill="#EDE6D6" opacity=".85" />
              <ellipse cx="2.6" cy="0" rx="3" ry="2.2" fill="#EDE6D6" opacity=".85" />
            </g>
            <ellipse cx="0" cy="0" rx="0.8" ry="2" fill="#B9AE98" />
          </svg>
        </span>
      ))}
    </div>
  );
}
