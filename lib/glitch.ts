// Mapping between the internal pixelation resolution (20..2048) and the 0..100%
// "Retro Glitch" slider. 2048 (and anything above 500) reads as 0% (off); 20
// reads as 100%. Kept pure so the round-trip is locked under tests.

/** Internal resolution -> slider percentage (0..100). */
export function resToGlitchPercent(res: number): number {
  if (res >= 2048) return 0;
  if (res > 500) return 0; // Buffer zone: 500..2048 all read as "off".
  const p = ((500 - res) / (500 - 20)) * 100;
  return Math.max(0, Math.min(100, Math.round(p)));
}

/** Slider percentage (0..100) -> internal resolution. */
export function glitchPercentToRes(pct: number): number {
  if (pct <= 0) return 2048; // Off
  return 500 - (Math.min(pct, 100) / 100) * (500 - 20);
}
