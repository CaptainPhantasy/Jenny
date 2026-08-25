import { defineConfig } from 'vitest/config';

// Unit tests for the app's pure logic (lib/*). These run in Node — no browser,
// no GPU — so they stay fast and deterministic and can run in CI without any
// extra setup. Behavior-heavy WebGL/camera flows are covered separately by the
// Playwright driver documented in tests/README.md.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
