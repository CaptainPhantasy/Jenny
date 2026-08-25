import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

// These guard the classroom-critical property that the app opens with a fixed,
// bundled, appropriate picture and makes NO external image request. A future
// change that reintroduces a remote sample image will fail here.
describe('bundled starter image', () => {
  it('ships the generated PNG asset', () => {
    const p = join(root, 'assets/starter-image.png');
    expect(existsSync(p)).toBe(true);
    const buf = readFileSync(p);
    // Valid PNG magic number.
    expect([...buf.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    // Non-trivial image (guards against an empty/placeholder file).
    expect(buf.length).toBeGreaterThan(10_000);
  });

  it('is committed alongside the generator that produced it', () => {
    expect(existsSync(join(root, 'scripts/generate-starter-image.mjs'))).toBe(true);
  });

  it('is wired up as the default image in constants, not types', () => {
    const constants = read('constants.ts');
    expect(constants).toContain("from './assets/starter-image.png'");
    expect(constants).toMatch(/export const STARTER_IMAGE/);
  });

  it('is what the app initialises imageSrc with', () => {
    expect(read('App.tsx')).toMatch(/imageSrc:\s*STARTER_IMAGE/);
  });

  it('makes NO reference to an external sample-image host anywhere in source', () => {
    for (const f of ['App.tsx', 'types.ts', 'constants.ts', 'index.html']) {
      expect(read(f)).not.toMatch(/picsum/i);
    }
  });

  it('has fully removed the old external DEFAULT_IMAGE constant', () => {
    expect(read('types.ts')).not.toMatch(/DEFAULT_IMAGE/);
    expect(read('App.tsx')).not.toMatch(/DEFAULT_IMAGE/);
  });
});
