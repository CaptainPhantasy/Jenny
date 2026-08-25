import { describe, it, expect } from 'vitest';
import { containScale } from '../lib/imageFit';

describe('containScale', () => {
  it('fits a wide image to the container width and letterboxes vertically', () => {
    // image 2:1 inside a 1:1 view -> full width, half height, aspect preserved.
    const { scaleX, scaleY } = containScale(2, 1);
    expect(scaleX).toBe(1);
    expect(scaleY).toBe(0.5);
    expect(scaleX / scaleY).toBeCloseTo(2, 6); // displayed aspect == image aspect
  });

  it('fits a tall image to the container height and letterboxes horizontally', () => {
    // image 1:2 (aspect 0.5) inside a 1:1 view -> full height, half width.
    const { scaleX, scaleY } = containScale(0.5, 1);
    expect(scaleX).toBe(0.5);
    expect(scaleY).toBe(1);
    expect(scaleX / scaleY).toBeCloseTo(0.5, 6);
  });

  it('preserves the source aspect ratio inside a non-square container', () => {
    const imageAspect = 1.5;
    const containerAspect = 1.2;
    const { scaleX, scaleY } = containScale(imageAspect, containerAspect);
    expect(scaleX / scaleY).toBeCloseTo(imageAspect, 6);
  });

  it('never produces NaN or zero scale for valid aspects', () => {
    for (const [ia, ca] of [[1, 1], [0.3, 2], [2, 0.3], [16 / 9, 4 / 3]]) {
      const { scaleX, scaleY } = containScale(ia, ca);
      expect(Number.isFinite(scaleX)).toBe(true);
      expect(Number.isFinite(scaleY)).toBe(true);
      expect(scaleX).toBeGreaterThan(0);
      expect(scaleY).toBeGreaterThan(0);
    }
  });
});
