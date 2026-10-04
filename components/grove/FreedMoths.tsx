"use client";

// When the user follows their Lantern, its moths break orbit and flutter out across the sky, then
// settle in as fireflies for the rest of the visit. Decoration only: nothing is counted or kept.
// With reduced motion they simply appear as fireflies where they would have landed.
import { useEffect, useMemo, useRef } from "react";
import type { CSSProperties } from "react";

type Point = { x: number; y: number };

const MOTHS = [0, 1, 2];

/** `from`: the lantern's centre, in px from the top left of the Grove; `area`: the Grove's size */
export default function FreedMoths({ from, area, seed }: { from: Point; area: { w: number; h: number }; seed: number }) {
  const flyers = useRef<(HTMLSpanElement | null)[]>([]);
  const glows = useRef<(HTMLSpanElement | null)[]>([]);

  // Where each moth settles: spread over the open sky, right of the goal and Lantern text
  const targets = useMemo(() => {
    let s = seed % 2147483647 || 1;
    const rnd = () => (s = (s * 48271) % 2147483647) / 2147483647;
    return MOTHS.map(i => ({
      x: area.w * (0.42 + i * 0.17 + rnd() * 0.08),
      y: area.h * (0.14 + rnd() * 0.3),
      dx: 14 + rnd() * 18, dy: 10 + rnd() * 14, drift: 16 + rnd() * 8, blink: 3 + rnd() * 1.5,
      wobble: (rnd() - 0.5) * 120,
    }));
  }, [seed, area.w, area.h]);

  useEffect(() => {
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const anims: Animation[] = [];
    targets.forEach((t, i) => {
      const fly = flyers.current[i], glow = glows.current[i];
      if (!fly || !glow) return;
      if (still) { fly.style.opacity = "0"; glow.style.opacity = "1"; return; }
      const sx = from.x - t.x, sy = from.y - t.y; // start offset from where it lands
      const delay = i * 260;
      // A loose, fluttering arc: up and out of the lantern's light, a swerve, then a soft landing
      anims.push(fly.animate([
        { transform: `translate(${sx}px, ${sy}px) scale(.7)`, opacity: 0 },
        { transform: `translate(${sx * 0.78}px, ${sy * 0.78 - 40}px) scale(1)`, opacity: 1, offset: 0.12 },
        { transform: `translate(${sx * 0.5 + t.wobble}px, ${sy * 0.45 - 70}px) rotate(14deg)`, offset: 0.45 },
        { transform: `translate(${sx * 0.18 - t.wobble * 0.4}px, ${sy * 0.15 - 24}px) rotate(-10deg)`, offset: 0.78 },
        { transform: "translate(0, 0) scale(.6)", opacity: 1, offset: 0.92 },
        { transform: "translate(0, 0) scale(.3)", opacity: 0 },
      ], { duration: 3400, delay, easing: "cubic-bezier(.35, .1, .3, 1)", fill: "both" }));
      // As the moth lands it becomes a firefly's glow
      anims.push(glow.animate([{ opacity: 0, transform: "scale(.2)" }, { opacity: 1, transform: "scale(1.6)", offset: 0.4 }, { opacity: 1, transform: "scale(1)" }],
        { duration: 1200, delay: delay + 3000, easing: "ease-out", fill: "both" }));
    });
    return () => anims.forEach(a => a.cancel());
  }, [from.x, from.y, targets]);

  return (
    // Above the header (z-10) so the moths stay bright as they leave the lantern beside the goal
    <div aria-hidden className="pointer-events-none absolute inset-0 z-[11] overflow-hidden">
      {targets.map((t, i) => (
        <span key={i} className="animate-firefly-drift absolute"
          style={{ left: t.x, top: t.y, "--dx": `${t.dx}px`, "--dy": `${t.dy}px`, animationDuration: `${t.drift}s` } as CSSProperties}>
          <span ref={el => { flyers.current[i] = el; }} className="absolute -translate-x-1/2 -translate-y-1/2 opacity-0">
            <svg viewBox="-6 -4 12 8" width="16" height="11" className="overflow-visible">
              <g className="animate-moth-flap">
                <ellipse cx="-2.6" cy="0" rx="3" ry="2.2" fill="#EDE6D6" opacity=".9" />
                <ellipse cx="2.6" cy="0" rx="3" ry="2.2" fill="#EDE6D6" opacity=".9" />
              </g>
              <ellipse cx="0" cy="0" rx="0.8" ry="2" fill="#B9AE98" />
            </svg>
          </span>
          <span ref={el => { glows.current[i] = el; }} className="absolute -translate-x-1/2 -translate-y-1/2 opacity-0">
            <span className="animate-firefly-blink block size-[5px] rounded-full bg-[#F8DC85] shadow-[0_0_8px_3px_rgba(248,220,133,.55)]"
              style={{ animationDuration: `${t.blink}s` }} />
          </span>
        </span>
      ))}
    </div>
  );
}
