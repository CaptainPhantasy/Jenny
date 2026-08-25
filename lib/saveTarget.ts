// Decides how the "Download / Save" button delivers the finished PNG.
//
// Background: an earlier version always preferred the Web Share API whenever
// `navigator.canShare({ files })` was truthy. That check used to be a reliable
// "this is a phone" signal, but desktop Chrome/Edge (Windows) and ChromeOS /
// Chromebooks now support sharing files too — so on those computers the app
// opened the OS *share sheet* ("send to app") and never saved the file to disk.
// Elementary schools run heavily on Chromebooks and Windows Chrome, so this hit
// exactly the machines that need a plain "save to Downloads".
//
// Fix: only prefer Web Share on genuinely touch-first (mobile / tablet) devices,
// where "Save Image → Photos/Files" is the natural gesture. Everywhere else we
// fall through to a normal <a download> which saves locally on every desktop
// browser. This helper is pure so it can be unit-tested without a real browser.

export interface WebShareCapableNavigator {
  canShare?: (data?: { files?: File[] }) => boolean;
  share?: (data?: unknown) => Promise<void>;
  /** Number of simultaneous touch points; 0 on a typical mouse-only desktop. */
  maxTouchPoints?: number;
}

/** True when the primary pointer is coarse (finger), i.e. a phone/tablet. */
export function isTouchFirstDevice(
  matchMedia: ((query: string) => { matches: boolean }) | undefined,
  nav: Pick<WebShareCapableNavigator, 'maxTouchPoints'>,
): boolean {
  const coarsePrimaryPointer =
    typeof matchMedia === 'function' && !!matchMedia('(pointer: coarse)').matches;
  const hasTouchPoints = (nav.maxTouchPoints ?? 0) > 0;
  return coarsePrimaryPointer || hasTouchPoints;
}

/**
 * Whether to route the save through the Web Share sheet (true) or a direct
 * file download (false). Web Share is used only when the device is touch-first
 * AND actually supports sharing this file; every other case downloads.
 */
export function shouldUseWebShare(
  matchMedia: ((query: string) => { matches: boolean }) | undefined,
  nav: WebShareCapableNavigator,
  file: File,
): boolean {
  if (!isTouchFirstDevice(matchMedia, nav)) return false;
  return (
    typeof nav.canShare === 'function' &&
    typeof nav.share === 'function' &&
    nav.canShare({ files: [file] })
  );
}
