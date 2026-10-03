// Tomorrow's Lantern as a real lantern on a little post, with a few moths drawn to its light.
// Unlit (no moths) until the first confirm, when GET /api/grove still returns lantern: null.
import type { CSSProperties } from "react";

const MOTHS = [
  { r: 22, dur: 7, delay: 0, size: 1 },
  { r: 30, dur: 9.5, delay: -3.2, size: 0.85 },
  { r: 17, dur: 6, delay: -1.6, size: 0.75 },
];

export default function LanternPost({ lit }: { lit: boolean }) {
  return (
    <div aria-hidden className="relative mr-3 h-[92px] w-[64px] flex-none origin-bottom-left scale-125">
      <svg viewBox="0 0 64 92" className="absolute inset-0 overflow-visible">
        <defs>
          <radialGradient id="lantern-light">
            <stop offset="0" stopColor="#FFE3A3" stopOpacity=".75" />
            <stop offset="1" stopColor="#FFE3A3" stopOpacity="0" />
          </radialGradient>
        </defs>
        {lit && <circle cx="40" cy="36" r="30" fill="url(#lantern-light)" className="animate-lantern" />}
        {/* Post and arm */}
        <path d="M14 92 V14 Q14 8 20 8 H40" fill="none" stroke="#5A4130" strokeWidth="4" strokeLinecap="round" />
        <path d="M40 8 V16" stroke="#3B2C22" strokeWidth="1.5" />
        {/* Lantern */}
        <path d="M33 17 H47 L45 20 H35 Z" fill="#3B2C22" />
        <rect x="32" y="20" width="16" height="22" rx="7" fill={lit ? "#F6C66A" : "#6E6650"} className={lit ? "animate-lantern" : undefined} />
        <path d="M34 25 H46 M34 31 H46 M34 37 H46" stroke={lit ? "#C98E2E" : "#4E4838"} strokeWidth="0.8" opacity=".7" />
        <path d="M35 42 H45 L43 45 H37 Z" fill="#3B2C22" />
        {/* A tuft of grass at the foot of the post */}
        <path d="M8 92 Q9 85 6 80 M12 92 Q13 84 15 79 M17 92 Q18 86 21 83" fill="none" stroke="#86A75E" strokeWidth="1.3" strokeLinecap="round" />
      </svg>

      {lit && MOTHS.map((m, i) => (
        <span key={i} className="animate-moth-orbit absolute top-[31px] left-[40px] size-0"
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
