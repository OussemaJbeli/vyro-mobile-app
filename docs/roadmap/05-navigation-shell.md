# 05 — Navigation Shell & Custom Tab Bar

| | |
|---|---|
| Milestone | M0 Foundation |
| Depends on | 04 |
| Spec refs | FS §53, §67 · UI §1, §10, §46, §48 · Template bottom bar |
| Output | Full route map with placeholder screens, a custom tab bar with the central Start FAB, and the root provider stack |

## Objective

Lay down the complete information architecture (UI §46) as real routes, so later steps only fill in screens. Build the signature bottom bar: **Home · Train · [▶ START] · Progress · Plan**, with a raised glowing lime FAB in the centre.

## Route map (Expo Router, routes live in `src/app/` since SDK 57)

```text
src/app/
├── _layout.tsx                    Root stack + providers
├── index.tsx                      Redirect: onboarding done? → (tabs)/home : (onboarding)/welcome
├── (onboarding)/_layout.tsx, welcome.tsx, [step].tsx
├── (tabs)/_layout.tsx             Custom tab bar
│   ├── home.tsx
│   ├── train.tsx
│   ├── start.tsx                  Daily sequence (step 20)
│   ├── progress.tsx               Segments: overview | body | photos | history
│   └── plan.tsx
├── workout/new.tsx, [id]/index.tsx, [id]/edit.tsx
├── running/new.tsx, [id]/index.tsx, [id]/edit.tsx
├── exercise/index.tsx, [id].tsx, new.tsx
├── equipment.tsx
├── session/new.tsx, [id].tsx      Schedule form, scheduled session detail
├── execute/[executionId].tsx      Fullscreen execution (gym/home/abs)
├── execute/run/[executionId].tsx  Fullscreen running execution
├── execute/complete/[executionId].tsx
├── body/weight.tsx, measurements.tsx, measurement/[typeId].tsx
├── photos/index.tsx, [category].tsx, capture.tsx, compare.tsx, viewer/[id].tsx
├── history/index.tsx, [executionId].tsx
├── analytics.tsx
├── goals/index.tsx, [id].tsx
├── settings/index.tsx, profile.tsx, units.tsx, appearance.tsx, language.tsx,
│   notifications.tsx, privacy.tsx, app-lock.tsx, backup.tsx, ai.tsx, about.tsx
├── coach/index.tsx                AI Coach (behind feature flag, step 32)
├── lock.tsx                       Lock screen (step 26)
└── dev/_layout.tsx, components.tsx, theme.tsx, db.tsx   (__DEV__ only)
```

Presentation rules:

- **Execution screens** (`execute/*`) are `fullScreenModal` with gestures disabled, so a swipe cannot abandon a set. Leaving goes through an explicit "Pause / Exit" sheet.
- **Forms** (`workout/new`, `session/new`, quick weight…) use `modal` or a bottom sheet.
- **Settings** is a stack pushed from the Home header avatar (UI §31). It is not a tab.

## Tasks

### 1. Root layout

Provider order, outermost first:

```text
GestureHandlerRootView
└─ SafeAreaProvider
   └─ ErrorBoundary (human fallback + "Restart")
      └─ DatabaseProvider (step 07; placeholder now)
         └─ I18nProvider (step 06)
            └─ ThemeProvider (step 03)
               └─ BottomSheetModalProvider
                  └─ LockGate (step 26; pass-through now)
                     └─ Stack
```

- [x] Keep the native splash visible until fonts, DB migrations and settings are ready (`SplashScreen.preventAutoHideAsync`).

### 2. Custom tab bar (`src/components/ui/TabBar.tsx`)

- [x] Four icon+label tabs plus a centre slot. Active tab = accent icon + label, inactive = muted.
- [x] **StartFab:** 64 px circle, `primary` fill, `onPrimary` play icon, accent glow halo, raised about 18 px above the bar. It receives a `startState` prop:
  - `start` → ▶ "Start"
  - `continue` → ▶ with a small pulse ring, label "Continue"
  - `done` → ✓ "Today complete" (dimmed fill)
  - `rest` → ☕ "Rest day" (still opens Start)

  The real state comes from step 20. For now use a dev toggle.
- [x] Respect the bottom safe-area inset and hide the bar when the keyboard opens.
- [x] Accessibility: every tab has role `tab` with a selected state. The FAB label reflects its state ("Continue Upper Body workout").
- [x] Haptic tick on tab change.

### 3. Placeholder screens

- [x] Every route renders `ScreenContainer` + `Header` + an `EmptyState` saying "Coming in step NN". The whole map is navigable from day one.
- [x] Home header placeholder: greeting, date, search icon, avatar button → `settings/index`.

### 4. Deep links

- [x] The `vyro://` scheme works for `vyro://execute/<id>`, `vyro://session/<id>` and `vyro://body/weight`. Notifications use these in step 25.

## Acceptance criteria

- [x] All routes are reachable. Back behaviour is correct, and Android hardware back never exits in the middle of an execution flow.
- [x] The tab bar visually matches the template (centre glowing FAB, four labelled icons).
- [x] The FAB renders all four states through the dev toggle.
- [x] No white flash between screens in dark mode.

## Pitfalls

- Expo Router tab `href: null` hides routes from the bar. Do not use tabs for settings pages.
- Put typed route helpers in `src/constants/routes.ts`. Avoid scattering string paths.

## Execution log (2026-09-25)

- All 50 routes from the route map exist under `src/app/`. Unbuilt screens use `PlaceholderScreen`, which names the step that builds them.
- Tabs use `expo-router/js-tabs` (plain `Tabs` from `expo-router` is deprecated in SDK 57), with a custom `TabBar` in `src/components/ui/TabBar.tsx`.
- **Start FAB:** 64 dp lime circle, raised above the bar, with a glow. The `continue` state adds a breathing ring (static under Reduce Motion). Its state lives in `useStartStore`. The Home dev panel toggles `start / continue / done / rest`, and step 20 replaces that with real data. **No visible label under the FAB**, as in the template. The state is in its accessibility label ("Continue Upper Body workout").
- Presentation: forms (`workout/new`, `running/new`, `exercise/new`, `session/new`) are modals. `execute/*` and `lock` are `fullScreenModal` with gestures off. `ExecutionShell` turns the Android back button and ✕ into a Pause/Exit sheet.
- Root provider order: GestureHandlerRootView → SafeAreaProvider → ErrorBoundary → ThemeProvider → LockGate → Stack + ToastHost. The DB (step 07) and i18n (step 06) providers slot in after ErrorBoundary. The ErrorBoundary fallback uses plain RN components, because it sits outside the theme.
- `/` redirects to `/home` until onboarding exists (step 11). The dev routes redirect to Home in release builds.
- `src/constants/routes.ts` holds typed route helpers. `src/constants/featureFlags.ts` hides the AI settings section.
- Deep links (`vyro://execute/<id>`, `vyro://session/<id>`, `vyro://body/weight`) work through the `vyro` scheme and file-based routes.
- Smoke-tested once in headless Chromium: every tab, the Start FAB and the Settings push work, with zero console errors. The removed landing test was replaced by these routes.
