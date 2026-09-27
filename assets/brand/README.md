# assets/brand

Generated from `docs/template/min_logo.png` and `docs/template/big_logo.png`. **Do not edit these files by hand.** Change `scripts/brand/generate-assets.mjs` and run:

```bash
pnpm brand:assets
```

| File                                    | Purpose                                                                                 |
| --------------------------------------- | --------------------------------------------------------------------------------------- |
| `icon.png`                              | App icon, 1024², V mark on `#01070C`                                                    |
| `adaptive-foreground.png`               | Android adaptive icon foreground (inside the 66 % safe zone)                            |
| `adaptive-monochrome.png`               | Android 13+ themed icon, white silhouette from the vector                               |
| `splash-mark.png`                       | Native splash image, shown on `#01070C`                                                 |
| `mark.png`                              | Transparent V mark with its glow (keyed from `min_logo.png`)                            |
| `vyro-mark.svg`                         | Master vector of the V. Same paths as `src/components/brand/markPaths.ts`               |
| `logo-lockup(@2x,@3x).png`              | Full lockup, Lime only (About screen, store assets)                                     |
| `wordmark(@2x,@3x).png`                 | "VYRO" wordmark, Lime only                                                              |
| `wordmark-base` + `wordmark-accent`     | Recolourable wordmark: white letters plus a white mask of the lime parts, tinted in-app |
| `tagline(@2x,@3x).png` / `tagline-mask` | "TRAIN • TRACK • EVOLVE", Lime only / tintable mask                                     |
| `favicon.png`                           | Web favicon, 48²                                                                        |

In the app, use `VyroMark` and `VyroLogo` from `@/components/brand`. They follow the accent colour.
