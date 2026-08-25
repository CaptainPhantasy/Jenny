# Tests

Two layers guard against regressions.

## 1. Unit tests (`*.test.ts`) — run in CI, no browser

Pure app logic is extracted into `lib/` and covered here with [Vitest]:

- `saveTarget.test.ts` — how the Save button chooses **download vs. share**
  (the desktop/Chromebook "save to disk" fix).
- `glitch.test.ts` — the pixelation ↔ slider-percent mapping and round-trip.
- `imageFit.test.ts` — the "contain" fit math for the canvas plane.
- `tone.test.ts` — the three-tone threshold ordering invariant.

Run them:

```bash
npm test          # one-shot
npm run test:watch
npm run typecheck  # tsc --noEmit
```

These are fast, deterministic, and need no GPU or camera, so they're safe to run
anywhere (including CI). They do **not** slow or affect the Vercel build — Vitest
is a dev dependency only and is never invoked during `vite build`.

## 2. End-to-end smoke (manual, needs a browser)

The WebGL rendering, camera, capture, flip, and mobile-drawer flows can't be
unit-tested without a real browser. A Playwright driver verifies them:

- app loads and the canvas renders a non-blank image after upload,
- Selfie Station shows the live feed with Take Photo + flip controls,
- a rapid double camera-flip opens and then **stops every** camera track
  (no leaked streams),
- Take Photo freezes a still and turns the camera off,
- on a phone viewport, choosing a source closes the controls drawer,
- no console/page errors in any of the above.

Because a live CDN (Tailwind) is required for layout, the driver stubs Tailwind,
Google Fonts, and the sample image via request interception so it runs offline.
This layer is intentionally **not** wired into the default `npm test` (it needs
`npx playwright install` and a Chromium binary); run it before releases on a
machine with a browser.
