#!/usr/bin/env node
/**
 * Regenerates every brand raster from the supplied logos (roadmap step 02).
 *
 *   node scripts/brand/generate-assets.mjs
 *
 * Sources (never modified):
 *   docs/template/min_logo.png  V mark on an opaque dark background
 *   docs/template/big_logo.png  transparent lockup: mark + wordmark + tagline
 *
 * The script is idempotent: same inputs → identical outputs.
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '../..');
const SRC = path.join(ROOT, 'docs/template');
const OUT = path.join(ROOT, 'assets/brand');

const BRAND_BG = { r: 1, g: 7, b: 12 }; // #01070C
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

// Measured with a row/colour profile of the source images.
const MIN_MARK_BOX = { left: 391, top: 267, right: 1143, bottom: 759 };
const BIG_BANDS = {
  mark: { top: 168, bottom: 562 },
  wordmark: { top: 650, bottom: 849 },
  tagline: { top: 931, bottom: 982 },
};

const out = (name) => path.join(OUT, name);

/**
 * Keys the flat dark background out of min_logo.png, keeping the glow as soft alpha.
 * Colour is un-premultiplied against the measured background so edges don't turn grey.
 */
async function extractMark() {
  const pad = 60;
  const src = sharp(path.join(SRC, 'min_logo.png'));
  const { data, info } = await src.raw().toBuffer({ resolveWithObject: true });
  const bg = [data[0], data[1], data[2]]; // top-left pixel is pure background
  const left = MIN_MARK_BOX.left - pad;
  const top = MIN_MARK_BOX.top - pad;
  const width = MIN_MARK_BOX.right - MIN_MARK_BOX.left + pad * 2;
  const height = MIN_MARK_BOX.bottom - MIN_MARK_BOX.top + pad * 2;
  const rgba = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const si = ((top + y) * info.width + (left + x)) * info.channels;
      const di = (y * width + x) * 4;
      const px = [data[si], data[si + 1], data[si + 2]];
      const dist = Math.max(...px.map((v, i) => Math.abs(v - bg[i])));
      const a = Math.min(1, Math.max(0, (dist - 4) / 110));
      for (let c = 0; c < 3; c++) {
        const un = a > 0 ? (px[c] - bg[c] * (1 - a)) / a : 0;
        rgba[di + c] = Math.round(Math.min(255, Math.max(0, un)));
      }
      rgba[di + 3] = Math.round(a * 255);
    }
  }
  return sharp(rgba, { raw: { width, height, channels: 4 } }).png();
}

// Outline paths of the two leaves, shared with src/components/brand/markPaths.ts.
const LEAF_LEFT =
  'M0 4 L168 4 C196 4 214 14 228 36 L350 214 C364 236 368 260 362 276 L286 394 C278 408 262 412 254 398 Z';
const LEAF_RIGHT =
  'M756 4 L620 4 C580 4 548 22 530 46 L304 404 C290 426 288 452 302 468 C322 494 366 504 404 498 C420 496 432 490 440 482 Z';

/** Crisp white silhouette rendered from the vector, for Android themed (monochrome) icons. */
async function monochromeSilhouette() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 510" width="1520" height="1020">
    <path fill="#FFFFFF" d="${LEAF_LEFT}"/><path fill="#FFFFFF" d="${LEAF_RIGHT}"/></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * Splits a raster into (a) everything that is not lime and (b) a white alpha mask of the lime parts.
 * The app tints the mask with the current accent, so the wordmark V and tagline follow the theme.
 */
async function splitAccent(png) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = info.width * info.height;
  const base = Buffer.alloc(n * 4);
  const mask = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) {
    const [r, g, b, a] = [data[i * 4], data[i * 4 + 1], data[i * 4 + 2], data[i * 4 + 3]];
    const greenness = Math.min(1, Math.max(0, (g - Math.max(r, b) - 25) / 60));
    base[i * 4] = r;
    base[i * 4 + 1] = g;
    base[i * 4 + 2] = b;
    base[i * 4 + 3] = Math.round(a * (1 - greenness));
    mask[i * 4] = mask[i * 4 + 1] = mask[i * 4 + 2] = 255;
    mask[i * 4 + 3] = Math.round(a * greenness * Math.min(1, g / 200));
  }
  const raw = { raw: { width: info.width, height: info.height, channels: 4 } };
  return {
    base: await sharp(base, raw).png().toBuffer(),
    mask: await sharp(mask, raw).png().toBuffer(),
  };
}

/** Places `img` centred on a square canvas, scaled to `fraction` of the canvas width. */
async function onCanvas(img, size, fraction, background) {
  const resized = await sharp(img)
    .resize({
      width: Math.round(size * fraction),
      height: Math.round(size * fraction),
      fit: 'inside',
    })
    .toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: resized, gravity: 'centre' }])
    .png();
}

async function cropBigLogo(band, pad) {
  const meta = await sharp(path.join(SRC, 'big_logo.png')).metadata();
  const top = Math.max(0, band.top - pad);
  const bottom = Math.min(meta.height, band.bottom + pad);
  // Separate pipelines: sharp applies trim before extract within one pipeline.
  const bandPng = await sharp(path.join(SRC, 'big_logo.png'))
    .extract({ left: 0, top, width: meta.width, height: bottom - top })
    .png()
    .toBuffer();
  return sharp(bandPng).trim({ threshold: 1 }).png().toBuffer();
}

async function writeScaled(buffer, baseName, width1x) {
  const [name, ext] = baseName.split('.');
  for (const scale of [1, 2, 3]) {
    const suffix = scale === 1 ? '' : `@${scale}x`;
    await sharp(buffer)
      .resize({ width: width1x * scale })
      .png({ compressionLevel: 9 })
      .toFile(out(`${name}${suffix}.${ext}`));
  }
}

async function main() {
  await mkdir(OUT, { recursive: true });

  const mark = await (await extractMark()).toBuffer();
  const markTrimmed = await sharp(mark).trim({ threshold: 1 }).png().toBuffer();
  await sharp(markTrimmed).toFile(out('mark.png'));

  // App icon: mark on brand background, ~18 % padding each side.
  await (
    await onCanvas(markTrimmed, 1024, 0.64, { ...BRAND_BG, alpha: 1 })
  ).toFile(out('icon.png'));

  // Android adaptive icon: the mark must fit the 66 % safe circle (its diagonal ≤ 0.66 × 1024).
  await (
    await onCanvas(markTrimmed, 1024, 0.54, TRANSPARENT)
  ).toFile(out('adaptive-foreground.png'));
  const mono = await monochromeSilhouette();
  await (await onCanvas(mono, 1024, 0.5, TRANSPARENT)).toFile(out('adaptive-monochrome.png'));

  // Native splash image (rendered at imageWidth in app.config.ts).
  await sharp(markTrimmed).resize({ width: 600 }).png().toFile(out('splash-mark.png'));

  // Lockup and its parts from the transparent big logo.
  const lockup = await sharp(path.join(SRC, 'big_logo.png'))
    .trim({ threshold: 1 })
    .png()
    .toBuffer();
  await writeScaled(lockup, 'logo-lockup.png', 320);
  const wordmark = await cropBigLogo(BIG_BANDS.wordmark, 30);
  const tagline = await cropBigLogo(BIG_BANDS.tagline, 24);
  await writeScaled(wordmark, 'wordmark.png', 240);
  await writeScaled(tagline, 'tagline.png', 240);

  // Recolourable layers (see splitAccent): same canvas size, so they stack exactly.
  const wm = await splitAccent(wordmark);
  await writeScaled(wm.base, 'wordmark-base.png', 240);
  await writeScaled(wm.mask, 'wordmark-accent.png', 240);
  await writeScaled((await splitAccent(tagline)).mask, 'tagline-mask.png', 240);

  // Web favicon.
  await sharp(out('icon.png')).resize(48).png().toFile(out('favicon.png'));

  console.log('Brand assets written to assets/brand/');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
