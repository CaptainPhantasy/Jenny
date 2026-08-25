import { describe, it, expect } from 'vitest';
import { resToGlitchPercent, glitchPercentToRes } from '../lib/glitch';

describe('resToGlitchPercent', () => {
  it('reads the 2048 default (and anything above 500) as 0% (off)', () => {
    expect(resToGlitchPercent(2048)).toBe(0);
    expect(resToGlitchPercent(3000)).toBe(0);
    expect(resToGlitchPercent(501)).toBe(0);
  });
  it('reads the most-pixelated resolution as 100%', () => {
    expect(resToGlitchPercent(20)).toBe(100);
  });
  it('is roughly half-way at the midpoint', () => {
    expect(resToGlitchPercent(260)).toBe(50);
  });
  it('never returns outside 0..100', () => {
    for (const r of [0, 5, 20, 100, 260, 500, 2048, 9999]) {
      const p = resToGlitchPercent(r);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(100);
    }
  });
});

describe('glitchPercentToRes', () => {
  it('maps 0% to the off resolution (2048)', () => {
    expect(glitchPercentToRes(0)).toBe(2048);
    expect(glitchPercentToRes(-5)).toBe(2048);
  });
  it('maps 100% to the most-pixelated resolution (20)', () => {
    expect(glitchPercentToRes(100)).toBeCloseTo(20, 6);
  });
  it('round-trips within rounding tolerance for active values', () => {
    for (const pct of [10, 25, 50, 75, 100]) {
      expect(resToGlitchPercent(glitchPercentToRes(pct))).toBeCloseTo(pct, 0);
    }
  });
});
