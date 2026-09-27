# 04 — UI Component Kit

| | |
|---|---|
| Milestone | M0 Foundation |
| Depends on | 03 |
| Spec refs | FS §47, §56, §57, §74 · UI §41, §43, §44, §47 · Template "UI Components", "Icons & Elements", "Status & Tags" |
| Output | `src/components/ui/*` primitives plus a live component gallery at `/dev/components` |

## Objective

Build every primitive screens need, so feature steps only compose. Each component is themed, accessible and documented in the gallery. The gallery is the visual contract to compare against `template.png`.

## Component inventory

| Component | Variants / props | Template reference |
|---|---|---|
| `Text` | `variant` = display, title, heading, body, caption, overline, metric, timer. `tone` = default, muted, primary, danger | All screens |
| `Button` | `primary` (filled pill + glow), `secondary` (accent outline pill), `ghost`, `danger`. Sizes sm/md/lg/xl. `icon`, `loading`, `disabled`, `fullWidth` | "Start Workout", "Create Workout", "Add Activity" |
| `IconButton` | round, outline or filled, minimum 44×44 | Header search, avatar |
| `Card` | `default`, `accent` (lime border + inner glow), `hero` (image or gradient background), `pressable` | Today card, Weight card |
| `ListRow` | leading (icon tile / thumbnail), title, subtitle, trailing (chevron, tag, value) | Workout list, Body Measurements rows |
| `IconTile` | circular outline tile with icon + label below | Quick Actions, "Icons & Elements" |
| `StatTile` | big number + label, optional icon | "This Week" 4 / 2 / 3 / 4h 18m |
| `StatusTag` | completed, next, pending, in_progress, modified, skipped, cancelled, missed. Always icon + text | "Completed", "Next", "Pending" |
| `Chip` / `ChipGroup` | selectable filter pills, single or multi select | All / Gym / Running / Six Pack / Other |
| `SegmentedControl` | 2–5 segments | Progress: Overview / Body / Photos / History |
| `ProgressBar` | value 0–1, label, percent text, animated | "1/3 completed 33 %" |
| `ProgressRing` | value, size, stroke, centre content | Execution and goals |
| `StreakChip` | 🔥 + "7 days" | Status & Tags |
| `Input` | label, helper, error, left/right icon, `numeric` mode | "Enter text…" |
| `NumberStepper` | − value + with long-press acceleration, units, step size | Execution weight/reps (big) |
| `Toggle` | accent track | Toggle / Switch |
| `Checkbox` / `Radio` | accessible | Scheduling form |
| `BottomSheet` | `@gorhom/bottom-sheet` wrapper (verify SDK compatibility first; fall back to a Reanimated modal) | Quick actions, pickers |
| `Modal` / `ConfirmDialog` | title, body, confirm/cancel, destructive variant | Import warning, delete |
| `Toast` | success, error, info. Queue, auto-dismiss, screen-reader announce | Save feedback |
| `EmptyState` | illustration/icon, title, body, CTA | FS §56 |
| `ErrorState` | human message + retry, never raw technical text | FS §57 |
| `Skeleton` | shimmer block, row and card presets | Loading states |
| `SectionHeader` | title + optional action ("See all") | "Quick Actions", "This Week", "Upcoming" |
| `ScreenContainer` | safe area, scroll or static, keyboard-aware, pull-to-refresh | All screens |
| `Header` | large title, optional back, right actions | Train, Progress, Plan |
| `Avatar` | initials fallback, optional local image | Home header |
| `CoverArt` | `cover_key` → bundled image or themed gradient + icon | Workout thumbnails |
| `Divider`, `Spacer` | token-based | — |
| `Icon` | wraps `@expo/vector-icons` with a **semantic name map** (home, train, start, progress, plan, ai, body, gallery, settings, running, gym, abs, rest, weight, measure, photo…) | Icons & Elements row |

## Tasks

- [x] Implement each component in its own file with a typed props interface and a `testID`.
- [x] Icons: build `src/components/ui/Icon.tsx` with a semantic map. Screens never import vector-icon sets directly, so the icon family can be swapped in one place. Match the template's outline style (MaterialCommunityIcons plus Ionicons outline names).
- [x] Haptics: `Button`, `Checkbox` and set completion call a `haptics.tap()` helper that respects a "Haptics" setting (added in step 12).
- [x] Accessibility: `accessibilityRole`, `accessibilityLabel`, `accessibilityState` (`selected`, `checked`, `disabled`, `busy`) on every interactive element. `hitSlop` where the visual is smaller than 44.
- [x] Respect **Reduce Motion** (`AccessibilityInfo.isReduceMotionEnabled`) in every animation, via one `useReducedMotion()` hook.
- [x] Support dynamic type: allow font scaling, but cap `maxFontSizeMultiplier` at about 1.6 on dense rows and metrics so layouts survive.
- [x] Gallery screen `src/app/dev/components.tsx` shows every component in every variant and state, in dark and light, with an accent switcher.
- [x] Component tests with React Native Testing Library for `Button` (press, disabled, loading), `StatusTag` (label present per status), `NumberStepper` (bounds, step) and `ChipGroup` (single/multi select).

## Acceptance criteria

- [x] Side by side with the template's "UI Components" and "Icons & Elements" panels, the gallery is clearly the same design language.
- [x] Every component renders correctly in both schemes and all six accents.
- [x] TalkBack reads a meaningful label for every interactive element in the gallery.
- [x] No component file contains a raw colour or numeric spacing literal (lint passes).

## Pitfalls

- Do not over-generalize. Build what the inventory lists, then extend when a feature needs it.
- Heavy inner glows on every card make the list lag on low-end Android. Keep glow to accent cards and the FAB.

## Execution log (2026-09-25)

- 29 components in `src/components/ui/`, exported from `@/components/ui`. The gallery is at `/dev/components` (link on the landing screen in dev builds).
- **BottomSheet is custom:** RN `Modal` + Reanimated + Gesture Handler (backdrop tap, drag down, Android back). `@gorhom/bottom-sheet` was not added: it keeps Expo Go compatibility and avoids a Reanimated 4 risk.
- **Icon map** (`Icon.tsx`) uses MaterialCommunityIcons. `satisfies Record<string, GlyphName>` makes an invalid glyph a type error.
- **Toasts:** `useUiStore` (Zustand) queues at most 3. Call `toast.success/error/info()` from anywhere. `ToastHost` is mounted in the root layout and announces each message to screen readers.
- Root layout now wraps `GestureHandlerRootView` → `SafeAreaProvider` → `ThemeProvider`.
- **React Compiler rules:** shared values use Reanimated 4's `.get()` / `.set()` (the compiler rejects `.value` writes in gestures). BottomSheet's open state is derived during render, and NumberStepper syncs its ref in an effect.
- Status labels are English fallbacks in `src/constants/statusLabels.ts`. Step 06 moves them to i18n through each status's `labelKey`.
- Haptics go through `src/utils/haptics.ts` with a global on/off switch for the step 12 setting.
- Tests: Button (press, disabled, busy), StatusTag (label for each of the 7 statuses), NumberStepper (steps, bounds, typed input, acceleration) and ChipGroup (single and multi select).
