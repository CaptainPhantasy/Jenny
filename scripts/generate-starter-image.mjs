// Generates assets/starter-image.png — the picture the app opens with.
//
// Why this exists (and is committed):
//   1. The app used to fetch a RANDOM photo from picsum.photos on every load.
//      That meant an external network call, an unpredictable image, and no way
//      to guarantee what a classroom of children would see. This replaces it
//      with one fixed, bundled, hand-authored picture.
//   2. Every pixel here is computed from the math below, so the content is
//      known and appropriate by construction — nothing is downloaded.
//   3. The scene is chosen to TEACH: it deliberately spans a full range of
//      light values — a near-white sun (highlight), mid-value sky and grass
//      (midtone), and a dark tree trunk and shadowed hill (shadow) — so the
//      three-tone "value study" and the edge-detection coloring page both show
//      an obvious, satisfying result the moment the app opens.
//
// Run with:  node scripts/generate-starter-image.mjs
// Dependency-free: writes a valid PNG using only Node's built-in zlib.

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SIZE = 800;

// ---------- tiny helpers ----------
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => [
  lerp(c1[0], c2[0], t),
  lerp(c1[1], c2[1], t),
  lerp(c1[2], c2[2], t),
];
/** Smooth 0..1 ramp; used for soft edges instead of hard aliasing. */
const smoothstep = (edge0, edge1, x) => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

// ---------- palette (warm, friendly, high value-contrast) ----------
const SKY_TOP = [58, 130, 205];      // deeper blue overhead
const SKY_HORIZON = [255, 221, 170]; // warm glow at the horizon
const SUN_CORE = [255, 252, 232];    // near-white -> reads as HIGHLIGHT
const SUN_EDGE = [255, 197, 92];
const HILL_BACK = [86, 140, 96];     // distant hill, cooler/darker
const HILL_FRONT = [122, 178, 92];   // near hill, brighter green
const HILL_SHADOW = [52, 92, 68];    // shadowed band -> reads as SHADOW
const TRUNK = [74, 48, 34];          // dark trunk -> reads as SHADOW
const CANOPY_LIGHT = [126, 190, 96];
const CANOPY_DARK = [58, 110, 68];
const CLOUD = [255, 255, 255];

// Scene geometry (all in pixels, on an 800x800 canvas)
const SUN = { x: 592, y: 214, r: 78 };
const TREE = { x: 214, groundY: 566, trunkW: 34, trunkTop: 402 };

/** Rolling back hill: y of the hill crest at a given x. */
const backHillY = (x) =>
  536 + Math.sin((x / SIZE) * Math.PI * 2.0 + 0.6) * 34 + Math.sin((x / SIZE) * Math.PI * 5.0) * 10;

/** Front hill crest. */
const frontHillY = (x) =>
  622 + Math.sin((x / SIZE) * Math.PI * 1.6 + 2.4) * 30;

/** Soft round cloud made of overlapping lobes; returns 0..1 coverage. */
function cloudCoverage(x, y, cx, cy, scale) {
  const lobes = [
    [0, 0, 46],
    [-42, 10, 33],
    [40, 8, 36],
    [-16, -18, 30],
    [20, -14, 28],
  ];
  let cov = 0;
  for (const [ox, oy, r] of lobes) {
    const dx = x - (cx + ox * scale);
    const dy = y - (cy + oy * scale);
    const d = Math.sqrt(dx * dx + dy * dy);
    cov = Math.max(cov, 1 - smoothstep(r * scale - 6, r * scale + 6, d));
  }
  return cov;
}

/** Tree canopy: overlapping blobs, lighter on the sun side. */
function canopy(x, y) {
  const blobs = [
    [TREE.x, 372, 96],
    [TREE.x - 68, 424, 72],
    [TREE.x + 70, 420, 76],
    [TREE.x - 26, 320, 66],
    [TREE.x + 34, 330, 62],
  ];
  let cov = 0;
  for (const [cx, cy, r] of blobs) {
    const d = Math.hypot(x - cx, y - cy);
    cov = Math.max(cov, 1 - smoothstep(r - 5, r + 5, d));
  }
  return cov;
}

// ---------- render ----------
const px = Buffer.alloc(SIZE * SIZE * 3);

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    // 1. Sky gradient (vertical): deep blue overhead -> warm near the horizon.
    const skyT = smoothstep(0, SIZE * 0.78, y);
    let c = mix(SKY_TOP, SKY_HORIZON, skyT);

    // 2. Sun: warm glow, then a bright near-white disc.
    const dSun = Math.hypot(x - SUN.x, y - SUN.y);
    const glow = 1 - smoothstep(SUN.r, SUN.r * 3.4, dSun);
    c = mix(c, SUN_EDGE, glow * 0.55);
    const disc = 1 - smoothstep(SUN.r - 3, SUN.r + 3, dSun);
    c = mix(c, mix(SUN_EDGE, SUN_CORE, 1 - clamp01(dSun / SUN.r)), disc);

    // 3. Clouds (soft, friendly, well clear of the sun).
    const cl = Math.max(
      cloudCoverage(x, y, 190, 168, 1.0),
      cloudCoverage(x, y, 470, 96, 0.66),
    );
    c = mix(c, CLOUD, cl * 0.9);

    // 4. Ground: back hill, then front hill drawn over it.
    const bY = backHillY(x);
    if (y > bY - 2) {
      const inBack = smoothstep(bY - 2, bY + 2, y);
      // Gentle vertical shading so the hill has form, not a flat fill.
      const shade = smoothstep(bY, SIZE, y);
      c = mix(c, mix(HILL_BACK, HILL_SHADOW, shade * 0.75), inBack);
    }
    const fY = frontHillY(x);
    if (y > fY - 2) {
      const inFront = smoothstep(fY - 2, fY + 2, y);
      const shade = smoothstep(fY, SIZE + 120, y);
      c = mix(c, mix(HILL_FRONT, HILL_SHADOW, shade * 0.85), inFront);
    }

    // 5. Tree trunk (dark -> anchors the shadow end of the value range).
    const halfW = TREE.trunkW / 2 + smoothstep(TREE.trunkTop, TREE.groundY, y) * 9;
    const inTrunkX = 1 - smoothstep(halfW - 2, halfW + 2, Math.abs(x - TREE.x));
    const inTrunkY =
      smoothstep(TREE.trunkTop - 2, TREE.trunkTop + 2, y) *
      (1 - smoothstep(TREE.groundY - 2, TREE.groundY + 2, y));
    c = mix(c, TRUNK, inTrunkX * inTrunkY);

    // 6. Canopy, lit from the sun side (right) for readable form.
    const cov = canopy(x, y);
    if (cov > 0) {
      const lightT = clamp01((x - (TREE.x - 110)) / 220);
      c = mix(c, mix(CANOPY_DARK, CANOPY_LIGHT, lightT), cov);
    }

    const i = (y * SIZE + x) * 3;
    px[i] = Math.round(clamp01(c[0] / 255) * 255);
    px[i + 1] = Math.round(clamp01(c[1] / 255) * 255);
    px[i + 2] = Math.round(clamp01(c[2] / 255) * 255);
  }
}

// ---------- PNG encoding (truecolour, 8-bit, Paeth-filtered) ----------
const paeth = (a, b, c) => {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

const stride = SIZE * 3;
const raw = Buffer.alloc((stride + 1) * SIZE);
for (let y = 0; y < SIZE; y++) {
  const rowStart = y * (stride + 1);
  raw[rowStart] = 4; // Paeth filter
  for (let i = 0; i < stride; i++) {
    const cur = px[y * stride + i];
    const left = i >= 3 ? px[y * stride + i - 3] : 0;
    const up = y > 0 ? px[(y - 1) * stride + i] : 0;
    const upLeft = y > 0 && i >= 3 ? px[(y - 1) * stride + i - 3] : 0;
    raw[rowStart + 1 + i] = (cur - paeth(left, up, upLeft)) & 0xff;
  }
}

const crcTable = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 2; // colour type: truecolour RGB
ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const outPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'starter-image.png');
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, png);
console.log(`Wrote ${outPath} (${SIZE}x${SIZE}, ${(png.length / 1024).toFixed(1)} KB)`);
