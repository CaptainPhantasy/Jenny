// Keeps the two three-tone luminance thresholds ordered with a small gap so the
// "Dark↔Midtone" split can never cross the "Midtone↔Light" split (which would
// invert the tone bands). Pure so the invariant is locked under tests.

const GAP = 0.02;

/** Clamp a proposed shadow threshold to stay below the highlight threshold. */
export function clampShadowThreshold(value: number, highlight: number): number {
  return Math.min(value, highlight - GAP);
}

/** Clamp a proposed highlight threshold to stay above the shadow threshold. */
export function clampHighlightThreshold(value: number, shadow: number): number {
  return Math.max(value, shadow + GAP);
}
