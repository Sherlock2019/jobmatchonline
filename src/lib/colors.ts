// Apple iOS system colors (light). Used to give every card a vivid, varied
// background even when the record has no brand accent.
export const APPLE_COLORS = [
  '#FF3B30', // red
  '#FF9500', // orange
  '#FFCC00', // yellow
  '#34C759', // green
  '#00C7BE', // mint
  '#30B0C7', // teal
  '#32ADE6', // cyan
  '#007AFF', // blue
  '#5856D6', // indigo
  '#AF52DE', // purple
  '#FF2D55', // pink
  '#A2845E', // brown
];

function hash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

/** Deterministic Apple system color for a seed (stable per id). */
export function appleColor(seed: string): string {
  return APPLE_COLORS[hash(String(seed)) % APPLE_COLORS.length];
}

/** A pleasant two-stop gradient from two nearby Apple colors, stable per seed. */
export function appleGradient(seed: string): string {
  const h = hash(String(seed));
  const a = APPLE_COLORS[h % APPLE_COLORS.length];
  const b = APPLE_COLORS[(h + 4) % APPLE_COLORS.length];
  return `linear-gradient(150deg, ${a}, ${b})`;
}
