import { shade } from "@/components/tree/colors";

// A seed half-buried in soil. When sprouted, its coat splits, a shoot rises and two seed leaves unfurl.
// Animations only run from a "from" keyframe, so with reduced motion the sprout simply appears grown.
// Given `growth` (0 to 1) instead, the shoot follows it: the coat splits as it starts, the stem rises
// as growth climbs, and the seed leaves unfurl once it reaches 1.
export default function Sprout({ color, sprouted = false, soil, delay = 0, growth, className = "" }: {
  color: string; sprouted?: boolean; soil: string; delay?: number; growth?: number; className?: string;
}) {
  if (growth !== undefined) return <GrowingSprout color={color} soil={soil} growth={growth} className={className} />;
  const d = (s: number) => ({ animationDelay: `${delay + s}s` });
  const hinge = { transformBox: "view-box", transformOrigin: "60px 88px" } as const;
  const node = { transformBox: "view-box", transformOrigin: "60px 44px" } as const;
  return (
    <svg aria-hidden viewBox="0 0 120 100" className={className}>
      <g fill="#8A6240" stroke="#5E4129" strokeWidth="1.2">
        <path d="M60 75 C 53 75 50 79 50 83 C 50 86 54 89 60 89 Z" style={{ ...hinge, ...(sprouted ? d(0) : {}), transform: sprouted ? "rotate(-26deg)" : undefined }} className={sprouted ? "animate-split" : ""} />
        <path d="M60 75 C 67 75 70 79 70 83 C 70 86 66 89 60 89 Z" style={{ ...hinge, ...(sprouted ? d(0) : {}), transform: sprouted ? "rotate(26deg)" : undefined }} className={sprouted ? "animate-split" : ""} />
      </g>
      {sprouted && (
        <>
          <path d="M60 86 C 61.5 72 57 58 60 44" pathLength={1} fill="none" stroke={shade(color, -0.3)} strokeWidth="3.2" strokeLinecap="round"
            strokeDasharray="1" className="animate-shoot" style={d(0.15)} />
          <SeedLeaves color={color} className="animate-unfurl" style={{ ...node, ...d(0.75) }} />
        </>
      )}
      <Soil soil={soil} />
    </svg>
  );
}

const HINGE = { transformBox: "view-box", transformOrigin: "60px 88px", transition: "transform .6s cubic-bezier(.2, .8, .2, 1)" } as const;
const NODE = { transformBox: "view-box", transformOrigin: "60px 44px", animationDelay: ".5s" } as const;

function GrowingSprout({ color, soil, growth, className }: { color: string; soil: string; growth: number; className: string }) {
  const open = growth > 0;
  return (
    <svg aria-hidden viewBox="0 0 120 100" className={className}>
      <g fill="#8A6240" stroke="#5E4129" strokeWidth="1.2">
        <path d="M60 75 C 53 75 50 79 50 83 C 50 86 54 89 60 89 Z" style={{ ...HINGE, transform: open ? "rotate(-26deg)" : "none" }} />
        <path d="M60 75 C 67 75 70 79 70 83 C 70 86 66 89 60 89 Z" style={{ ...HINGE, transform: open ? "rotate(26deg)" : "none" }} />
      </g>
      <path d="M60 86 C 61.5 72 57 58 60 44" pathLength={1} fill="none" stroke={shade(color, -0.3)} strokeWidth="3.2" strokeLinecap="round"
        strokeDasharray="1" strokeDashoffset={1 - Math.min(1, Math.max(0, growth))}
        style={{ transition: "stroke-dashoffset .8s cubic-bezier(.2, .8, .2, 1)" }} />
      {growth >= 1 && <SeedLeaves color={color} className="animate-unfurl" style={NODE} />}
      <Soil soil={soil} />
    </svg>
  );
}

function SeedLeaves({ color, className, style }: { color: string; className: string; style: React.CSSProperties }) {
  return (
    <g className={className} style={style}>
      <path d="M60 44 C 52 31 38 28 27 34 C 35 45 50 48 60 44 Z" fill={color} stroke={shade(color, -0.3)} strokeWidth="1" />
      <path d="M60 44 C 68 31 82 28 93 34 C 85 45 70 48 60 44 Z" fill={color} stroke={shade(color, -0.3)} strokeWidth="1" />
      <path d="M59 43 Q 45 36 30 35 M61 43 Q 75 36 90 35" fill="none" stroke={shade(color, 0.4)} strokeWidth="1.1" strokeLinecap="round" />
    </g>
  );
}

function Soil({ soil }: { soil: string }) {
  return (
    <>
      <path d="M6 100 C 20 88 40 84 60 84 C 80 84 100 88 114 100 Z" fill={soil} />
      <path d="M22 91 C 36 86 48 85 60 85 C 72 85 84 86 98 91" fill="none" stroke={shade(soil, 0.18)} strokeWidth="1.2" strokeLinecap="round" />
    </>
  );
}
