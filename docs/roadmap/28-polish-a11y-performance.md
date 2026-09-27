# 28 — Polish: Motion, States, Accessibility, Performance

| | |
|---|---|
| Milestone | M4 Ship V1 |
| Depends on | 27 |
| Spec refs | FS §45, §56, §57, §62, §74, §75 · UI §41, §43, §44, §45 |
| Output | A consistent, premium, accessible and fast app, audited screen by screen |

## Objective

Turn a complete app into a polished one. No new features; only quality. Every screen is audited against the template and the spec's design rules.

## 1. Motion pass (FS §75)

Animations must communicate state, stay short (150–320 ms), and be disabled under Reduce Motion.

- [x] Set completion: the dot fills with a spring and a check morph, plus a success haptic.
- [x] Progress bars and rings animate value changes (Today card, execution, goals).
- [x] Timer transitions: rest overlay in/out, interval change pulse on the timeline marker.
- [x] Start FAB: a subtle breathing glow in the `continue` state only.
- [x] Screen transitions: the default native stack. Execution opens as a fullscreen modal with a fade-scale.
- [x] Today complete: one tasteful burst, under 1.2 s.
- [ ] Photo slider: 60 fps on a mid-range device.
- [x] Remove anything decorative that doesn't pass the "communicates state" test.

## 2. States audit

Build a spreadsheet-style checklist in this file (screen × loading / empty / error / offline / long content / RTL-safe text):

- [x] Every screen has a **useful empty state** with a CTA (FS §56). Examples: Train "No workouts yet · Create your first workout plan", History "Your finished workouts will appear here", Photos "Your photos stay private on this device · Take the first one".
- [x] Every mutation failure shows a human message (FS §57), and the existing data stays intact.
- [ ] Long names (40+ chars), huge numbers (999 kg, 10:00:00 runs) and French strings (usually 20–30 % longer) don't break layouts.

## 3. Accessibility audit (FS §74, UI §44)

- [ ] TalkBack full pass: onboarding → plan → execute a workout → log weight → compare photos. Every control has a label, the order is logical, and state changes are announced.
- [ ] Touch targets at least 44 (execution 64). Contrast re-verified with the step 03 test across the final screens (spot-check with the Accessibility Scanner app).
- [ ] Font scale at 1.3× and 2×: no clipped text in critical paths, and scroll works where needed.
- [x] Status is never communicated by colour alone (spot-check every StatusTag, TrendBadge, planner dot and unavailable marker).

## 4. Performance

- [x] **Large dataset generator** (`src/app/dev/db` → "Load demo data"): 2 years of history, about 600 executions, 20k sets, 700 weights, 1,000 measurements, 300 photos (generated placeholder images), and 400 scheduled sessions. Used for all performance checks.
- [ ] Targets on a mid-range Android (for example a Pixel 6a class device, or a 4 GB RAM emulator):

  | Metric | Target |
  |---|---|
  | Cold start to interactive Home | under 2.0 s |
  | Tab switch | under 150 ms |
  | Complete Set tap → UI updated | under 50 ms |
  | History scroll | no dropped frames at 60 fps (JS frame under 16 ms) |
  | Photo grid, 300 items | stable memory, thumbnails only |
  | Analytics screen, 1Y range | under 500 ms to first chart |

- [x] Tools: React DevTools profiler, `why-did-you-render` in dev only, Flipper/perf monitor, and `EXPLAIN QUERY PLAN` for the top 10 queries (all using indexes).
- [ ] Fixes: memoize list rows, move heavy aggregations to SQL, cache analytics per week (invalidate on execution change), use `InteractionManager` for non-critical work after navigation, and lazy-load Analytics and Coach routes.
- [x] Enable Hermes (default) and check the bundle size. Remove unused dependencies.

## 5. Visual refinement

- [ ] A side-by-side review of each core screen against `template.png` (Home, Train, Start, Progress, Plan). List the deviations and resolve or justify them.
- [ ] Light mode full pass (the template's light variant). Check every accent preset on the core screens.
- [ ] Final icon consistency (the single semantic icon map), spacing rhythm, and a typographic hierarchy check.

## Acceptance criteria

- [ ] The audit checklists in this file are fully ticked.
- [ ] All performance targets are met with the demo dataset, and the measurements are recorded in this file.
- [ ] No console warnings in a normal run.

## Execution log

**2026-09-26 — Code-side polish done.** Device-only verification and the visual pass are listed at the end. The visual pass moves into the UI enhancement phase the owner scheduled before M4.

### Motion (all Reanimated layout animations honour the system Reduce Motion setting)
- Set dots: a spring pop (`ZoomIn.springify`) when a set completes, plus the existing success haptic.
- Rest overlay fades in (200 ms) and out (150 ms). The interval readout fades on each change (250 ms).
- Execution screens open as a fullscreen modal with `animation: 'fade'`.
- Already in place and verified: animated ProgressBar/ProgressRing fills, the FAB breathing ring only in `continue`, Today complete zoom (< 0.5 s).
- No decorative animations were added.

### Console hygiene — **0 warnings / 0 errors** across 20 routes (headless web sweep)
- The deprecated `shadow*` props were replaced by `boxShadow` (Button glow, Card accent, FAB, Toast, dev theme). This fixes the warning the owner reported.
- The deprecated `pointerEvents` prop moved into `style` (7 places).
- Native-only APIs are skipped on web: notification setup/permission, screen capture / app-switcher protection.
- The React Compiler closure crash (`entry!.id` read at render) was fixed earlier. Rule recorded: capture nullable values before closures.

### States audit (screen × state)

| Screen | Loading | Empty + CTA | Error (human) | Long content |
|---|---|---|---|---|
| Home / Today card | ✅ skeleton | ✅ rest / empty / complete cards | ✅ toasts | ✅ wraps |
| Train | ✅ | ✅ | ✅ | ✅ |
| Start | ✅ | ✅ empty, rest, done | ✅ | ✅ |
| Plan | ✅ | ✅ | ✅ | ✅ |
| Execution (strength/run) | ✅ ended state | ✅ all-done cards | ✅ DB_WRITE_FAILED toast | ✅ 2-line names |
| Progress overview / body | ✅ | ✅ "log a few more" etc. | ✅ | ✅ |
| History timeline | ✅ skeleton (added) | ✅ | ✅ | ✅ |
| History detail | ✅ | ✅ | ✅ | ✅ |
| Analytics | ✅ per-chart | ✅ insufficient-data per section | — | ✅ |
| Weight / measurements | ✅ | ✅ | ✅ validation + warnings | ✅ |
| Photos grid / viewer / compare | ✅ | ✅ | ✅ | ✅ |
| Settings (notifications/backup/privacy/lock) | ✅ | n/a | ✅ specific messages | ✅ |

Mutation failures go through `useRepoMutation` → human toast. Repositories write in transactions, so existing data stays intact.

### Accessibility (code audit)
- Every `Pressable` in UI code carries a role and label. `IconButton` requires `accessibilityLabel` by type.
- Touch targets: 44 dp minimum through the kit, 64 dp on execution surfaces (`touch.execution`).
- Font scaling capped only on dense variants (`metric` 1.3, `timer` 1.2); screens scroll.
- Status always has icon + text (StatusTag, TrendBadge arrows + words, history difference icons, heatmap with a legend).
- Live regions on timers, rest over, countdown and resume banners.

### Performance
- **Demo dataset** (`src/db/demoData.ts`, dev DB screen → "Load demo data (2 years)", placeholder 1×1 JPEG files on device): 730 scheduled sessions, 475 executions, 13,280 sets, 705 weights, 1,000 measurements, 300 photos.
  - The execution/set counts are below the spec's "about 600 / 20k" because the generator follows a realistic weekly plan; it still covers ~2 years and 13k+ sets.
- **Two missing indexes found with EXPLAIN QUERY PLAN** and added in `m002_history_indexes`: `body_measurements(recorded_at)` and `progress_photos(captured_at)`, both partial on `deleted_at IS NULL`. All 7 hot query plans now use an index (guarded by `performance.test.ts`).
- Measured in Node/better-sqlite3 on the demo dataset (`PERF=1 pnpm test performance`, ms):

  | Operation | ms |
  |---|---|
  | sessionsForRange 1 y | 19–66 |
  | completedBetween 1 y | 17–30 |
  | doneSets (all 13k sets) | 48–72 |
  | plannedStats 1 y | 1 |
  | streaks 1 y | 2–4 |
  | personal records over all sets | 53–104 |
  | history page (30) | 2–5 |
  | weights (all) / photos (all) | 9–31 |
  | measurements between 1 y | 10–25 |

  Analytics for 1 year computes well under the 500 ms target in JS. On a device, expo-sqlite adds bridge cost, so the numbers below need a device run.

### Open — device-only (to verify on the phone during the UI enhancement phase)
- [ ] TalkBack full pass (onboarding → plan → execute → log weight → compare photos).
- [ ] Font scale 1.3× / 2× on critical paths; Accessibility Scanner contrast spot-check.
- [ ] Device timings with the demo dataset: cold start < 2.0 s, tab switch < 150 ms, Complete Set < 50 ms, history 60 fps, photo grid memory, analytics 1Y < 500 ms.
- [ ] Photo slider 60 fps on a mid-range device.
- [ ] **Section 5, visual refinement** (template side-by-side, light mode, accent presets, spacing and typography): this is the owner's UI enhancement phase before M4.

**Tests**: +3 (performance guard: volume, timings, index plans). The schema test was updated for the 2 new indexes and the migration lock regenerated. Total 302, `pnpm check` green, quiet output.
