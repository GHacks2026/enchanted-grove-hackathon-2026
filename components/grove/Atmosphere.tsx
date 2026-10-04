// Scenery behind and around the Grove: stars, moon, hills, mist and fireflies.
// Decoration only. Nothing here means anything about progress (no streaks, no scores).
// All motion is slow and faint, and stops when the user prefers reduced motion (globals.css).
import type { CSSProperties } from "react";

/** Stable pseudo-random numbers, so the sky looks the same on every load (and on the server). */
function rng(seed: number) {
  return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
}

const r = rng(42);
const STARS = Array.from({ length: 34 }, () => ({
  left: r() * 100, top: r() * 52, size: r() < 0.15 ? 2.5 : 1.5, twinkle: r() < 0.35, dur: 2.5 + r() * 3, delay: -r() * 5,
}));
const SEEDS = Array.from({ length: 5 }, () => ({
  top: 12 + r() * 45, scale: 0.7 + r() * 0.6, drift: 45 + r() * 30, bob: 5 + r() * 4, delay: -r() * 70,
}));
const FIREFLIES = Array.from({ length: 16 }, () => ({
  left: 4 + r() * 92, top: 10 + r() * 48, size: 3 + r() * 1.8, // in the sky and among the trees, not below them
  dx: (r() - 0.5) * 90, dy: (r() - 0.5) * 60, drift: 14 + r() * 12, blink: 2.6 + r() * 2.4, delay: -r() * 20,
}));

/** Behind the trees: stars, moon, hills, mist. Text-heavy pages hide the moon on phones. */
export function Sky({ moonOnPhones = true }: { moonOnPhones?: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {STARS.map((s, i) => (
        <span key={i} className={`absolute rounded-full bg-white ${s.twinkle ? "animate-twinkle" : "opacity-60"}`}
          style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, animationDuration: `${s.dur}s`, animationDelay: `${s.delay}s` }} />
      ))}

      {/* Crescent moon with a soft halo, up in the top right corner. It sits above the scene's grain and
          vignette (z-5) and the header's dark fade (z-10) in GroveCanvas, which would otherwise dim it. */}
      <div className={`absolute z-[11] top-[calc(1.75rem+env(safe-area-inset-top))] right-8 size-14 max-[900px]:top-[19%] max-[900px]:right-[8%] max-[900px]:size-10 ${moonOnPhones ? "" : "max-[640px]:hidden"}`}>
        <div className="absolute -inset-10 rounded-full bg-[radial-gradient(circle,rgba(246,231,190,.22)_0%,transparent_65%)]" />
        {/* A crescent drawn with an inset shadow, so the sky shows through the dark side */}
        <div className="absolute inset-0 rotate-[-20deg] rounded-full shadow-[inset_11px_-3px_0_0_#F4ECD2]" />
      </div>

      {/* Far hills, then nearer hills */}
      <svg className="absolute inset-x-0 bottom-0 h-[60%] w-full" viewBox="0 0 1200 400" preserveAspectRatio="none">
        <path d="M0 60 Q 150 25 320 50 T 640 42 T 960 34 T 1200 52 V400 H0 Z" fill="#2C2F55" />
        <path d="M0 125 Q 200 90 420 115 T 820 104 T 1200 120 V400 H0 Z" fill="#283A45" />
        <path d="M0 230 Q 260 195 560 222 T 1200 212 V400 H0 Z" fill="#26392F" />
      </svg>

      {/* Dandelion seeds drifting slowly across the sky */}
      {SEEDS.map((d, i) => (
        <span key={i} className="animate-seed-drift absolute left-0" style={{ top: `${d.top}%`, animationDuration: `${d.drift}s`, animationDelay: `${d.delay}s` }}>
          <span className="animate-seed-bob block" style={{ animationDuration: `${d.bob}s`, animationDelay: `${d.delay / 5}s` }}>
            <svg viewBox="-8 -9 16 22" width={16 * d.scale} height={22 * d.scale} className="overflow-visible opacity-75">
              <path d="M0 0 L0.6 12" stroke="#E9E6DA" strokeWidth="0.6" />
              <g stroke="#F4F1E6" strokeWidth="0.45" strokeLinecap="round">
                {[-80, -55, -30, -8, 12, 35, 58, 82].map(a => {
                  const rad = (a - 90) * Math.PI / 180;
                  // Rounded so server and browser render the same digits (Math.cos can differ in the last place)
                  return <line key={a} x1="0" y1="0" x2={(Math.cos(rad) * 7).toFixed(3)} y2={(Math.sin(rad) * 7).toFixed(3)} />;
                })}
              </g>
              <circle cx="0" cy="0" r="0.9" fill="#F4F1E6" />
            </svg>
          </span>
        </span>
      ))}

      {/* Mist along the horizon */}
      <div className="animate-mist absolute inset-x-[-10%] bottom-[38%] h-[16%] bg-[radial-gradient(60%_50%_at_50%_50%,rgba(220,230,220,.13),transparent_70%)]" />
    </div>
  );
}

/** In front of the trees but behind the buttons: a few fireflies drifting and glowing. */
export function Fireflies() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-[5] overflow-hidden">
      {FIREFLIES.map((f, i) => (
        <span key={i} className="animate-firefly-drift absolute"
          style={{ left: `${f.left}%`, top: `${f.top}%`, "--dx": `${f.dx}px`, "--dy": `${f.dy}px`, animationDuration: `${f.drift}s`, animationDelay: `${f.delay}s` } as CSSProperties}>
          <span className="animate-firefly-blink block rounded-full opacity-60 bg-[#F8DC85] shadow-[0_0_8px_3px_rgba(248,220,133,.55)]"
            style={{ width: f.size, height: f.size, animationDuration: `${f.blink}s`, animationDelay: `${f.delay / 3}s` }} />
        </span>
      ))}
    </div>
  );
}
