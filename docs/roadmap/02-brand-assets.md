# 02 — Brand Assets Pipeline

| | |
|---|---|
| Milestone | M0 Foundation |
| Depends on | 01 |
| Spec refs | FS §85, §86 · Template sheet (header, theme variations, colour customization) |
| Output | Production-ready icon, adaptive icon, splash, logo components and fonts, all generated from the supplied logos |

## Objective

Turn the supplied logos into every asset the app and stores need. Build reusable `<VyroMark/>` and `<VyroLogo/>` components that can follow the accent colour. Never replace the supplied branding (FS §86).

## Source analysis

| File | Content | Use |
|---|---|---|
| `docs/template/big_logo.png` | 1454×1082, **transparent**. Lime V mark, white "VYRO" wordmark with a lime V, "TRAIN • TRACK • EVOLVE" tagline, heavy glow. | Splash lockup, onboarding welcome, About screen |
| `docs/template/min_logo.png` | 1536×1024, V mark on **opaque `#01070C`** background. | App icon source, header mark, loading states |
| `docs/template/template.png` | Reference sheet | Colours, splash composition ("Train smarter. Live stronger." + Get Started), recoloured logo variants |

Brand colours from the sheet: **Primary `#7EFF00`**, **Background `#01070C`**.

## Tasks

### 1. Raster assets

Use `sharp` in a Node script at `scripts/brand/generate-assets.mjs` so assets can be regenerated.

- [x] **Icon master**: crop the V from `min_logo.png`, centred on a square `#01070C` canvas with about 18 % padding. Output 1024×1024 `assets/brand/icon.png`.
- [x] **Android adaptive icon**: foreground = V mark on transparent 1024×1024, inside the 66 % safe zone. Background colour `#01070C`. Monochrome = white V silhouette for themed icons (Android 13+).
- [x] **Splash**: `assets/brand/splash-mark.png` (V only, transparent, about 400 px wide). `expo-splash-screen` background `#01070C`. Keep the native splash simple. The animated lockup comes in step 11.
- [x] **Lockup**: `assets/brand/logo-lockup.png` (@1x/@2x/@3x) trimmed from `big_logo.png`.
- [x] **Wordmark only** and **tagline only** crops, used where the full lockup is too tall.
- [x] **Favicon** 48×48 for web builds (optional).
- [x] Wire `icon`, `android.adaptiveIcon` (foreground, background colour, monochrome) and the `expo-splash-screen` plugin config in `app.config.ts`.

### 2. Vector mark (recolourable)

The template shows the logo recoloured per accent (Lime, Purple, Blue, Orange, Red, Teal). A raster cannot do that cleanly.

- [x] Trace the V into an SVG (two leaf strokes with a gradient: light top edge, deeper body). Keep it at two or three paths.
- [x] `src/components/brand/VyroMark.tsx` uses `react-native-svg`. Props: `size`, `color` (defaults to theme `primary`), `glow` (boolean, a soft blurred duplicate path behind the mark).
- [x] `src/components/brand/VyroLogo.tsx`: mark + wordmark + optional tagline. Variants `stacked | horizontal | markOnly`. The horizontal variant matches the footer "V VYRO" on the template sheet.
- [x] Compare the SVG to the PNG at 64, 128 and 256 px. The shapes must be visually identical.

### 3. Imagery the template needs (asset requests)

The template uses photographic content that is **not supplied**. Plan for it explicitly:

| Asset | Where | Plan |
|---|---|---|
| Mountain/terrain hero background (dark, lime rim light) | Splash, Today card, onboarding | Create or source a licensed image. Export 3 sizes to `assets/images/hero/`. Provide an SVG/gradient fallback in the meantime. |
| Workout cover images (gym, running, abs, home) | Train list thumbnails, Start hero card | Ship 6–8 bundled, licensed, dark-graded covers keyed by `cover_key`. Users can also pick their own photo later. |
| Light-mode hero (snowy mountain) | Light theme splash | Same pipeline |

- [x] Create `assets/images/ASSETS.md` listing every required image, its size, licence source and status.
- [x] Until real images arrive, `CoverArt` renders a themed gradient with a large category icon. No broken layouts. *(Rule recorded in `ASSETS.md`. The component itself is built in step 04, where `CoverArt` is in the kit inventory and theme tokens exist.)*

### 4. Fonts

The template uses a clean geometric sans with tabular numbers.

- [x] Bundle **Inter** (400, 500, 600, 700, 800) through `expo-font`, loaded at the root before hiding the splash.
- [x] Use `fontVariant: ['tabular-nums']` for all timers, weights and counters. This prevents jitter while numbers tick.
- [x] The wordmark stays a vector/image. Never render "VYRO" in a text font.

## Acceptance criteria

- [ ] A fresh dev build shows the VYRO icon (adaptive and monochrome) on the Android launcher.
- [ ] The native splash shows the V on `#01070C` with no white flash.
- [x] `<VyroMark color="#3B82F6"/>` renders a blue mark. The prop is allowed in a dev story only; production code passes theme tokens.
- [x] `scripts/brand/generate-assets.mjs` regenerates everything idempotently.
- [x] `ASSETS.md` exists and lists the missing imagery.

## Pitfalls

- `min_logo.png` has an opaque background, so do not use it where transparency is needed. Crop the mark or use the SVG.
- Glow effects on Android: `shadow*` props do nothing. Use an SVG blur filter or a blurred duplicate layer.

## Execution log (2026-09-25)

- `scripts/brand/generate-assets.mjs` (run with `pnpm brand:assets`) builds every raster with `sharp`. It is idempotent: a second run produces byte-identical files for all 24 PNGs.
- **Mark extraction:** `min_logo.png` sits on `#030A14`, not the brand `#01070C`. The script keys that background out and un-premultiplies the colour, so the V and its glow become a clean transparent `mark.png` with no square halo.
- **Vector mark:** a potrace attempt was too noisy (it followed the shading), so the V was hand-built from measured edge points: two leaf outlines, two lighter "fold" faces and two fold highlight lines. An overlay on the original matched the silhouette closely. The paths live in `src/components/brand/markPaths.ts` and `assets/brand/vyro-mark.svg`.
- **Monochrome icon** is rendered from the vector silhouette (crisp), not from the raster alpha (which had ragged edges).
- **Recolourable wordmark (beyond the plan):** the wordmark's lime V and the tagline are split into white alpha masks (`wordmark-accent`, `tagline-mask`) that `VyroLogo` tints with the accent through `expo-image` `tintColor`. The whole lockup follows all six accents, matching the template's "Color Customization Example".
- **Glow** uses stroked, low-opacity copies of the leaf outlines. It works on Android, where `shadow*` props and SVG filters are unreliable.
- `VyroMark` puts its accessibility props on a wrapping `View`, because react-native-svg forwards `accessible` to the DOM on web and React warns.
- **Fonts:** Inter 400/500/600/700/800 via `@expo-google-fonts/inter` per-weight subpaths (only those files are bundled). The root layout keeps the native splash until fonts load. `fontFamily` names are used because Android does not switch weights through `fontWeight` for custom fonts. `tabularNums` is exported for timers and counters.
- Added `src/theme/brand.ts` accent presets and `src/theme/color.ts` helpers (mix, lighten, darken, withAlpha, markShades), which step 03 builds on.
- Dev route `/dev/brand` previews all variants and accents. Checked in headless Chromium at phone size: Lime and Purple render correctly, with zero console errors.
- Jest: added an explicit `moduleNameMapper` because jest-expo resolved `@/assets/*` through the generic `@/*` alias.
- **Deferred verification:** the launcher icon (adaptive and monochrome) and the native splash can only be checked in a real build, because Expo Go shows its own icon. They are checked with the first EAS development build, scheduled by AD-01 before step 25. The config paths were confirmed with `expo config`.
