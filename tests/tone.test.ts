import { describe, it, expect } from 'vitest';
import { clampShadowThreshold, clampHighlightThreshold } from '../lib/tone';

describe('three-tone threshold clamps', () => {
  it('keeps a raised shadow threshold below the highlight threshold', () => {
    expect(clampShadowThreshold(0.9, 0.66)).toBeCloseTo(0.64, 6);
  });
  it('leaves a valid shadow threshold untouched', () => {
    expect(clampShadowThreshold(0.3, 0.66)).toBe(0.3);
  });
  it('keeps a lowered highlight threshold above the shadow threshold', () => {
    expect(clampHighlightThreshold(0.1, 0.33)).toBeCloseTo(0.35, 6);
  });
  it('leaves a valid highlight threshold untouched', () => {
    expect(clampHighlightThreshold(0.7, 0.33)).toBe(0.7);
  });
  it('never lets the two splits cross (shadow stays < highlight)', () => {
    const highlight = 0.5;
    const shadow = clampShadowThreshold(0.8, highlight);
    expect(shadow).toBeLessThan(highlight);
  });
});
