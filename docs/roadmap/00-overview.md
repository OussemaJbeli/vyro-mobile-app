# 00 — VYRO Roadmap: Master Overview

> **VYRO — Train · Track · Evolve.** A private, offline-first personal training operating system.
> Core loop: **Plan → Adapt → Execute → Record → Analyze → Improve**.

This folder turns the two product specs into an ordered build path. You go from an empty folder to a release APK, and then to an optional AI layer. Execute the files **in numeric order**. Each file is one self-contained step with its own acceptance criteria. Progress is tracked in [tracking.md](tracking.md).

Source documents (the single source of truth for *what*; this roadmap is the *how* and *when*):

| Source | Role |
|---|---|
| [../plan/personal_training_app_full_spec.md](../plan/personal_training_app_full_spec.md) | Product, data, architecture (referenced as **FS §n**) |
| [../plan/personal_training_app_ui_sections_spec.md](../plan/personal_training_app_ui_sections_spec.md) | Navigation, sections, flows (referenced as **UI §n**) |
| [../template/template.png](../template/template.png) | Visual reference: 5 core screens, components, theme variants |
| [../template/big_logo.png](../template/big_logo.png) | Full lockup: V mark + "VYRO" wordmark + "TRAIN • TRACK • EVOLVE" |
| [../template/min_logo.png](../template/min_logo.png) | V mark only (on dark background), used for icon/small spaces |

---

## 1. Milestones at a glance

```text
M0  FOUNDATION         01 → 10   Empty folder → themed, navigable shell with a real database
M1  CORE TRAINING LOOP 11 → 21   Onboarding, library, builders, planner, execution, Start, Home
M2  PROGRESS & INSIGHT 22 → 24   Body, weight, measurements, private photos, history, analytics
M3  PLATFORM SERVICES  25 → 27   Notifications, app lock, backup/import
M4  SHIP V1            28 → 30   Polish, QA/offline certification, Android APK release
M5  AI LAYER (V1.1)    31 → 32   Provider abstraction, privacy-safe summaries, AI Coach
```

| # | Step | Milestone | Depends on |
|---|---|---|---|
| 01 | [Project bootstrap](01-project-bootstrap.md) | M0 | — |
| 02 | [Brand assets pipeline](02-brand-assets.md) | M0 | 01 |
| 03 | [Design tokens & theme engine](03-design-system-tokens.md) | M0 | 01, 02 |
| 04 | [UI component kit](04-ui-component-kit.md) | M0 | 03 |
| 05 | [Navigation shell & custom tab bar](05-navigation-shell.md) | M0 | 04 |
| 06 | [Core utilities: i18n, units, dates, errors, logging](06-core-utilities.md) | M0 | 01 |
| 07 | [Database engine & migrations](07-database-foundation.md) | M0 | 06 |
| 08 | [Domain schema, models & validation](08-domain-schema-models.md) | M0 | 07 |
| 09 | [Seed data](09-seed-data.md) | M0 | 08 |
| 10 | [Repositories, stores & data hooks](10-data-layer.md) | M0 | 08, 09 |
| 11 | [Splash & onboarding](11-splash-onboarding.md) | M1 | 05, 10 |
| 12 | [Profile, settings, goals & equipment](12-profile-settings-goals-equipment.md) | M1 | 11 |
| 13 | [Exercise library & alternatives](13-exercise-library.md) | M1 | 12 |
| 14 | [Train tab & workout builder](14-train-workout-builder.md) | M1 | 13 |
| 15 | [Running interval builder](15-running-builder.md) | M1 | 14 |
| 16 | [Plan tab: planner & scheduling engine](16-planner-scheduling.md) | M1 | 14, 15 |
| 17 | [Execution engine (domain core)](17-execution-engine.md) | M1 | 16 |
| 18 | [Gym & home/abs execution UI](18-gym-home-execution.md) | M1 | 17 |
| 19 | [Running execution UI](19-running-execution.md) | M1 | 17 |
| 20 | [Start tab: daily sequence & completion](20-start-daily-sequence.md) | M1 | 18, 19 |
| 21 | [Home: daily command center](21-home-dashboard.md) | M1 | 20 |
| 22 | [Body: weight & measurements](22-body-weight-measurements.md) | M2 | 21 |
| 23 | [Private progress photos & comparison](23-progress-photos.md) | M2 | 22 |
| 24 | [History, analytics, streaks & goals progress](24-history-analytics.md) | M2 | 22, 23 |
| 25 | [Local notifications](25-notifications.md) | M3 | 16, 22 |
| 26 | [App lock & privacy hardening](26-app-lock-privacy.md) | M3 | 23 |
| 27 | [Backup, export & import](27-backup-import-export.md) | M3 | 24 |
| 28 | [Polish: motion, states, accessibility, performance](28-polish-a11y-performance.md) | M4 | 27 |
| 29 | [QA & offline certification](29-qa-offline-certification.md) | M4 | 28 |
| 30 | [Android build & APK release](30-android-release.md) | M4 | 29 |
| 31 | [AI foundation (service, providers, privacy)](31-ai-foundation.md) | M5 | 30 |
| 32 | [AI Coach experiences](32-ai-coach.md) | M5 | 31 |

Every step ends with a **working, runnable app**. No step leaves the app broken.

---

## 2. Architecture decisions (binding for all steps)

These decisions resolve gaps and ambiguities in the specs. Later steps assume them. Change one only by updating this section first.

| ID | Decision | Rationale |
|---|---|---|
| AD-01 | **Expo (SDK 57 at project start) + React Native + TypeScript strict + Expo Router.** Daily development runs in **Expo Go** over a tunnel (`pnpm go`). A cloud **development build** (EAS, no local Java) is made when a step needs native behaviour Expo Go cannot provide, and before the notification, app-lock and release steps (25, 26, 29, 30) are verified. | The owner has no local Java/Android toolchain. Expo Go gives instant on-phone iteration, and every library used through step 24 ships inside Expo Go. Notifications, screenshot blocking and final QA must be verified in a real build. |
| AD-02 | **pnpm** with `node-linker=hoisted` in `.npmrc`. | pnpm is installed on the machine. Metro and native autolinking need a hoisted `node_modules`. |
| AD-03 | **Raw SQL through `expo-sqlite` (async API)** with a hand-written migration runner and typed repositories. No ORM. | Matches FS §49–50, stays transparent, avoids extra build tooling. Zod validates every row crossing the boundary. |
| AD-04 | **IDs are UUID v4 strings** (`expo-crypto` `randomUUID`). Every table has `created_at`, `updated_at`, and `deleted_at` (soft delete) in ISO-8601 UTC. | Makes future sync possible (FS §65) and keeps history trustworthy (FS §61). |
| AD-05 | **Calendar values are local wall-clock:** `scheduled_date = 'YYYY-MM-DD'`, `start_time = 'HH:mm'`. **Instants are UTC ISO:** `started_at`, `recorded_at`, `completed_at`. | A 18:00 gym session must stay at 18:00 local even after a timezone change, and "today" must follow the user's local day. |
| AD-06 | **Canonical metric storage:** kg, cm, km, km/h, incline %. Each user entry also stores `unit_entered`. Conversion happens only at display/input. | Analytics never mix units. The original entry stays faithful. |
| AD-07 | **Planned vs actual is structural.** Starting a session snapshots the plan into `session_executions.planned_snapshot` and per-row `planned_*` columns. Actual values live in `actual_*` columns. Plans and templates are never mutated by execution. | FS §14, §61, §78. |
| AD-08 | **Running plans are workout templates of type `running`** with child rows in `template_running_intervals`. The spec's `running_workouts` table is merged into `workout_templates`. | One path for schedule → start → history. No parallel system. |
| AD-09 | **Recurring schedules = `schedule_rules` + materialized `scheduled_sessions`** in a rolling window (today − 0 … today + 8 weeks), topped up on app start and on planner navigation. Editing one occurrence detaches it as an exception. | Queryable by date with indexes. Supports daily/weekly/monthly/custom (UI §25). History stays stable. |
| AD-10 | **Timers are timestamp-based, never tick-counted.** State holds `startedAt`, `pausedAt`, `accumulatedPauseMs`. UI ticks only re-render. Active execution state is persisted to SQLite on every transition. | Survives backgrounding, app kill and screen lock (UI §12). |
| AD-11 | **Execution logic is a pure reducer** (`domain/execution`), fully unit-tested, with no React or SQL inside. | The most complex logic in the app must be deterministic and testable. |
| AD-12 | **Zustand per domain** for UI/session state. Persistent data is read through repository hooks with explicit invalidation keys. No giant global store. | FS §6 state guidance. |
| AD-13 | **Private photos live in `documentDirectory/vyro-private/photos/…`.** Only **relative** paths are stored in SQLite, with a generated thumbnail per photo. Nothing is written to the media library unless the user exports explicitly. | iOS container paths change between installs/updates. Thumbnails keep grids fast (FS §62). |
| AD-14 | **Theme = tokens + accent presets.** Default dark, background `#01070C`, primary `#7EFF00` ("Lime"). Presets: Lime, Blue, Purple, Orange, Red, Teal. Light mode uses a contrast-safe `primaryInk` for text on light surfaces. | Taken from the template sheet. Pure `#7EFF00` fails contrast as text on white. |
| AD-15 | **i18n from day one:** English + French via `i18next` + `expo-localization`. No hardcoded user-facing strings in components. | UI §36. Retrofitting i18n later is expensive. |
| AD-16 | **Charts (updated in step 24):** in-house `react-native-svg` charts behind `src/components/charts/{LineChart,BarChart,Sparkline}` with accessible summaries. `victory-native` (Skia) remains the upgrade path behind the same API if richer visuals are needed. | Zero extra native modules keeps Expo Go and dev builds simple; the wrapper API makes a later swap local. |
| AD-17 | **Status model:** `planned · in_progress · completed · modified · skipped · cancelled`. **"Missed"** is *derived* for display (planned + date in the past + not started), never stored. **Rest** is a session with `type='rest'`. | Rest ≠ skipped (FS §22). The past is never rewritten automatically. |
| AD-18 | **AI is a separate module** (`services/ai`) behind `AIService`. It is feature-flagged off until step 31. Core code has zero imports from it. | FS §39–43. |
| AD-19 | **Package id `ca.evoxai.vyro`**, app name **VYRO**, URL scheme `vyro`. | Confirm or change in step 01. It is hard to change after the first release. |

---

## 3. Target project structure

```text
vyro/
├── src/
│   ├── app/                      # Expo Router routes (SDK 57 default; thin: compose screens, no logic)
│   │   ├── _layout.tsx           # Providers: DB, theme, i18n, lock gate, error boundary
│   │   ├── (onboarding)/         # welcome + setup steps
│   │   ├── (tabs)/               # home, train, start, progress, plan
│   │   ├── workout/ running/ exercise/ session/ execute/ body/ photos/ history/ settings/ coach/
│   │   └── dev/                  # component gallery & debug tools (excluded from release)
│   ├── components/{ui,brand,workout,running,planner,execution,progress,dashboard,ai}/
│   ├── db/{client.ts, migrations/, repositories/, seed/}
│   ├── domain/{workouts,running,scheduling,execution,progress,analytics,goals,streaks}/
│   ├── store/                    # zustand stores per domain
│   ├── services/{notifications,photos,backup,security,ai}/
│   ├── hooks/  i18n/  theme/  utils/  types/  constants/
├── assets/{brand,images,fonts}/
├── docs/{plan,template,roadmap}/
└── e2e/                          # Maestro flows
```

**Rule of layers** (enforced by lint in step 01):

```text
src/app/ (routes) → components/ → hooks/ + store/ → domain/ + services/ → db/repositories → db/client
```

A layer may import only from layers to its right. `domain/` is pure TypeScript with no React, SQL or Expo imports.

---

## 4. How to execute a step

1. Open [tracking.md](tracking.md) and set the step to **🔄 In progress** with today's date.
2. Read the step file fully. Read the referenced spec sections (FS §n, UI §n).
3. Implement the tasks in order. Tick the checkboxes in the step file as you go.
4. Run the step's **Verification** section. All acceptance criteria must pass.
5. Run the global gates:

   ```bash
   pnpm typecheck && pnpm lint && pnpm test
   ```

6. Set the step to **✅ Done** in tracking.md, fill the completion date, and add a line to the changelog.
7. If something blocks you, set **⏸️ On hold**, write the reason in the Notes column, and continue with the next unblocked step if its dependencies allow it.

Suggested prompt for an AI agent executing a step:

```text
Execute docs/roadmap/NN-<name>.md.
Read docs/roadmap/00-overview.md (architecture decisions) and the step file first.
Update docs/roadmap/tracking.md to "In progress", implement every task,
run the verification and the global gates, tick the checkboxes,
then set the step to "Done" and add a changelog line. Do not start the next step.
```

---

## 5. Global Definition of Done (applies to every step)

- [ ] TypeScript strict passes with zero errors. No `any` without a written justification comment.
- [ ] Lint passes, including the layer rule and the no-hardcoded-color rule.
- [ ] Unit tests for all new domain logic pass.
- [ ] No hardcoded user-facing strings. Every string goes through i18n with EN and FR keys.
- [ ] No hardcoded colors, spacing or radii in components. Everything uses theme tokens.
- [ ] Every new screen has loading, empty and error states.
- [ ] Every interactive element has an accessibility label and a touch target of at least 44×44.
- [ ] The feature works in airplane mode.
- [ ] No sensitive values (weights, measurements, photo paths, API keys) appear in logs.
- [ ] The app launches on the Android dev build after the change.

---

## 6. V1 Definition of Done (from FS §83)

V1 ships at the end of step 30 when all 25 criteria of FS §83 are verified. Step 29 holds the certification checklist that maps each criterion to a test.
