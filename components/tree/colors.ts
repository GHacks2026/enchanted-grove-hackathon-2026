// One color per tree, by pillar position. Used by the tree, Grove, review and trail.
const PILLAR_COLORS = ["#7FA35B", "#4E9483", "#B5A642", "#9478B8", "#C9824F", "#5B86B5"];

export const pillarColor = (position: number) =>
  PILLAR_COLORS[((position % PILLAR_COLORS.length) + PILLAR_COLORS.length) % PILLAR_COLORS.length];

/** Mix a hex color toward white (amount > 0) or black (amount < 0). Used for leaf highlights and shadows. */
export function shade(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount));
  const r = mix((n >> 16) & 255), g = mix((n >> 8) & 255), b = mix(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
