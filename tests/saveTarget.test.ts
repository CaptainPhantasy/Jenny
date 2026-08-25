import { describe, it, expect } from 'vitest';
import { isTouchFirstDevice, shouldUseWebShare } from '../lib/saveTarget';

const mm = (coarse: boolean) => (q: string) => ({
  matches: q === '(pointer: coarse)' ? coarse : false,
});

const file = new File([new Uint8Array([1, 2, 3])], 'art-project.png', { type: 'image/png' });

const shareCapable = { canShare: () => true, share: async () => {}, maxTouchPoints: 0 };

describe('isTouchFirstDevice', () => {
  it('is true when the primary pointer is coarse (phone/tablet)', () => {
    expect(isTouchFirstDevice(mm(true), { maxTouchPoints: 0 })).toBe(true);
  });
  it('is true when the device reports touch points', () => {
    expect(isTouchFirstDevice(mm(false), { maxTouchPoints: 5 })).toBe(true);
  });
  it('is false on a mouse-only desktop', () => {
    expect(isTouchFirstDevice(mm(false), { maxTouchPoints: 0 })).toBe(false);
  });
  it('does not throw when matchMedia is unavailable', () => {
    expect(isTouchFirstDevice(undefined, { maxTouchPoints: 0 })).toBe(false);
  });
});

describe('shouldUseWebShare — the desktop-save regression guard', () => {
  it('DOWNLOADS (no share) on a desktop even when Web Share is available', () => {
    // This is the exact Chromebook / Windows-Chrome case that used to open the
    // share sheet instead of saving. It must resolve to a direct download.
    expect(shouldUseWebShare(mm(false), shareCapable, file)).toBe(false);
  });

  it('shares on a touch-first device that supports sharing files', () => {
    expect(shouldUseWebShare(mm(true), shareCapable, file)).toBe(true);
  });

  it('downloads on a touch device that cannot share files', () => {
    const noFileShare = { canShare: () => false, share: async () => {}, maxTouchPoints: 5 };
    expect(shouldUseWebShare(mm(true), noFileShare, file)).toBe(false);
  });

  it('downloads when the Web Share API is entirely absent', () => {
    expect(shouldUseWebShare(mm(true), { maxTouchPoints: 5 }, file)).toBe(false);
  });
});
