# 03 — Design Tokens & Theme Engine

| | |
|---|---|
| Milestone | M0 Foundation |
| Depends on | 01, 02 |
| Spec refs | FS §45, §46 · UI §35, §41 · AD-14 · Template sheet (Main Colors, Theme Variations, Color Customization) |
| Output | `src/theme/` with tokens, dark and light schemes, six accent presets, a `ThemeProvider`, and a `useTheme()` hook |

## Objective

Build one theme system so no component hardcodes a colour, size or radius (FS §46). Users can switch Dark / Light / System and pick an accent, exactly as the template's "Customize the main color" panel shows.

## Visual language extracted from the template

- **Canvas:** near-black blue `#01070C`. Cards are one step lighter with a **1 px lime-tinted border** and a faint inner glow.
- **Accent use:** lime is used **sparingly**. It marks primary CTAs (pill, filled), active tab, completed ticks, chart line, progress fill, and the Start FAB. Everything else is neutral.
- **Shapes:** large rounded cards (about 16–20 radius), pill buttons and chips, circular icon tiles with an outline.
- **Type:** bold white titles, muted grey secondary lines ("Gym · 55 min · 6 exercises"), small uppercase tracking for section labels.
- **Status tags:** Completed = filled accent, Next = accent outline, Pending = neutral outline.
- **Glow:** a soft accent halo on the Start FAB, primary buttons and the logo. Never on body text.

## Tasks

### 1. Token files

`src/theme/tokens.ts` holds raw primitives. Suggested starting values (tune on device):

```ts
export const palette = {
  ink950: '#01070C', ink900: '#050E15', ink850: '#0A151E', ink800: '#0F1C26',
  ink700: '#1A2A36', ink600: '#2A3B48', ink400: '#5E707D', ink300: '#8A9BA8',
  ink100: '#E6ECEF', white: '#FFFFFF',
  paper50: '#F5F8F6', paper100: '#EDF2EF', paper200: '#DDE5E0',
  danger: '#FF4D5E', warning: '#FFB020', info: '#38BDF8',
};

export const accents = {
  lime:   { base: '#7EFF00', ink: '#3F8F00', onBase: '#01070C' },
  blue:   { base: '#3B82F6', ink: '#1D4ED8', onBase: '#FFFFFF' },
  purple: { base: '#A855F7', ink: '#7E22CE', onBase: '#FFFFFF' },
  orange: { base: '#FF8A1F', ink: '#C2570C', onBase: '#01070C' },
  red:    { base: '#FF4D5E', ink: '#C81E32', onBase: '#FFFFFF' },
  teal:   { base: '#14E0D0', ink: '#0F8F86', onBase: '#01070C' },
} as const;
```

- `spacing`: 4-pt scale `{ xxs:2, xs:4, sm:8, md:12, lg:16, xl:20, xxl:24, xxxl:32, huge:48 }`.
- `radius`: `{ sm:8, md:12, lg:16, xl:20, pill:999 }`.
- `typography`: `display` (34/800), `title` (24/700), `heading` (18/700), `body` (15/500), `caption` (13/500), `overline` (11/700, letterSpacing 1.2, uppercase), `metric` (32/800, tabular), `timer` (64/800, tabular).
- `touch`: `{ min: 44, comfortable: 52, execution: 64 }`. Execution screens use large targets (UI §42).
- `motion`: `{ fast: 150, base: 220, slow: 320 }` plus a standard easing.
- `icon`: sizes `{ sm: 16, md: 20, lg: 24, xl: 32 }`.

### 2. Semantic schemes

`src/theme/schemes.ts` builds `dark` and `light` from primitives plus the chosen accent:

| Token | Dark | Light |
|---|---|---|
| `bg` | ink950 | paper50 |
| `surface` | ink900 | white |
| `surfaceRaised` | ink850 | paper100 |
| `border` | ink700 | paper200 |
| `borderAccent` | accent @ 35 % alpha | accent.ink @ 30 % |
| `text` | white | ink950 |
| `textMuted` | ink300 | ink400 |
| `primary` | accent.base | accent.base (fills only) |
| `primaryInk` | accent.base | **accent.ink** (text/icons on light) |
| `onPrimary` | accent.onBase | accent.onBase |
| `success / warning / danger / info` | status colours | darker variants |
| `glow` | accent @ 45 % | none |

Status mapping (`statusColors`): planned → textMuted, in_progress → primary, completed → primary, modified → info, skipped → warning, cancelled → textMuted with strikethrough, missed → danger. **Every status also has an icon and a label** (FS §74: never colour alone).

### 3. Contrast guard

- [x] `src/theme/contrast.ts`: a WCAG contrast ratio function.
- [x] A unit test asserts that `text/bg`, `textMuted/bg`, `onPrimary/primary` and `primaryInk/bg` are at least 4.5:1 for **every accent in both schemes**. Adjust the `ink` values until the test passes.

### 4. Provider and hook

- [x] `ThemeProvider` reads the preference (`system | dark | light`) and the accent from settings, with an in-memory default until step 10 wires persistence.
- [x] `useTheme()` returns `{ colors, spacing, radius, typography, touch, motion, scheme, accent }`.
- [x] A `makeStyles((t) => StyleSheet.create({...}))` helper memoizes styles per theme so screens do not recreate them every render.
- [x] Sync the status bar, navigation bar (Android) and `expo-system-ui` root background with the scheme. This prevents white flashes on navigation.

### 5. Theme preview

- [x] `src/app/dev/theme.tsx` shows swatches for every token, all six accents, both schemes, and the typography scale.

## Acceptance criteria

- [x] Switching accent in the dev preview recolours primary buttons, the mark, tags and glow instantly.
- [x] Light mode is readable everywhere, and lime text on white never appears (it uses `primaryInk`).
- [x] The contrast test passes for 6 accents × 2 schemes.
- [x] Lint confirms zero raw colours outside `src/theme/`.

## Pitfalls

- Do not make the whole UI lime. The template's premium feel comes from restraint.
- Keep gradients to hero cards and the splash only (FS §45 "avoid excessive gradients").

## Execution log (2026-09-25)

- Files: `src/theme/{tokens,schemes,contrast,ThemeProvider,makeStyles,index}.ts(x)` plus `/dev/theme` preview. Import everything from `@/theme`.
- **onPrimary is dark (`#01070C`) for all six accents.** White text on the accent fill fails 4.5:1 for every preset (lime 1.3, blue 3.7, purple 4.0), which matches the template's dark-on-lime buttons.
- Light-mode inks chosen by calculation: lime `#3A7D00` (4.8:1 on paper50), blue `#1D4ED8`, purple `#7E22CE`, orange `#B24A06`, red `#C81E32`, teal `#0B7A72`.
- Contrast test covers text, textMuted, onPrimary/primary, primaryInk on bg and on surface, for 6 accents × 2 schemes.
- `statusStyles()` gives each status a colour, a semantic icon name (resolved in step 04) and an i18n label key (step 06).
- `ThemeProvider` keeps preference and accent in memory (default Dark + Lime). Step 10 persists them without changing this API. It syncs the status bar style and the `expo-system-ui` root background. The Android navigation bar needs no extra call, because SDK 57 is edge-to-edge and the bar is transparent over app content.
