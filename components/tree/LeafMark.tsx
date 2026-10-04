// The tree's leaf, small: a marker wherever a confirmed leaf is referenced (timelines, item notes),
// so the leaf in a panel is the same leaf that grew on the tree. Points up and to the right.
import { LEAF_MIDRIB, LEAF_PATH } from "./treeModel";

export default function LeafMark({ color, size = 14, className = "" }: { color: string; size?: number; className?: string }) {
  return (
    <svg aria-hidden viewBox="-1 -12 26 26" width={size} height={size} className={`flex-none overflow-visible ${className}`}>
      <g transform="rotate(-45 12 0)">
        <path d={LEAF_PATH} fill={color} stroke="var(--color-moss)" strokeWidth={1.2} strokeLinejoin="round" />
        <path d={LEAF_MIDRIB} fill="none" stroke="rgba(255,255,255,.55)" strokeWidth={1} strokeLinecap="round" />
      </g>
    </svg>
  );
}
