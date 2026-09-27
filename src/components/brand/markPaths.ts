/**
 * V mark geometry, traced from docs/template/min_logo.png into a 760 × 510 box.
 * Also used by scripts/brand/generate-assets.mjs and assets/brand/vyro-mark.svg: keep them in sync.
 */
export const MARK_VIEWBOX = { width: 760, height: 510 } as const;

export const markPaths = {
  leafLeft:
    'M0 4 L168 4 C196 4 214 14 228 36 L350 214 C364 236 368 260 362 276 L286 394 C278 408 262 412 254 398 Z',
  faceLeft:
    'M0 4 L168 4 C196 4 214 14 228 36 L350 214 C362 234 366 258 362 276 C310 150 210 72 36 58 Z',
  foldLeft: 'M362 276 C310 150 210 72 36 58',
  leafRight:
    'M756 4 L620 4 C580 4 548 22 530 46 L304 404 C290 426 288 452 302 468 C322 494 366 504 404 498 C420 496 432 490 440 482 Z',
  faceRight: 'M756 4 L620 4 C580 4 548 22 530 46 L368 300 C450 170 580 100 720 60 Z',
  foldRight: 'M368 300 C450 170 580 100 720 60',
} as const;
