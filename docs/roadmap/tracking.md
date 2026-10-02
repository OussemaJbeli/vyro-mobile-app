# VYRO — Roadmap Tracking

Live status of every roadmap step. Update this file whenever a step changes state. The master plan is in [00-overview.md](00-overview.md).

## Status legend

| Status | Meaning |
|---|---|
| ⏸️ On hold | Not started yet, or paused. When paused, write the reason in Notes. |
| 🔄 In progress | Currently being executed. Only one step should be in progress at a time. |
| ✅ Done | All tasks done, verification and global gates passed. |

## Summary

| Milestone | Steps | Done | Status |
|---|---|---|---|
| M0 Foundation | 01–10 | 10 / 10 | ✅ Done |
| M1 Core training loop | 11–21 | 11 / 11 | ✅ Done |
| M2 Progress & insight | 22–24 | 3 / 3 | ✅ Done |
| M3 Platform services | 25–27 | 3 / 3 | ✅ Done |
| M4 Ship V1 | 28–30 | 1 / 3 | 🔄 In progress |
| M5 AI layer (V1.1) | 31–32 | 2 / 2 | ✅ Done |
| **Total** | **32** | **28 / 32** | **88 %** |

## Steps

| # | Step | Milestone | Status | Started | Completed | Notes |
|---|---|---|---|---|---|---|
| 00 | [Master overview](00-overview.md) | — | ✅ Done | 2026-09-24 | 2026-09-24 | Reference document, not executable |
| 01 | [Project bootstrap](01-project-bootstrap.md) | M0 | ✅ Done | 2026-09-24 | 2026-09-24 | Runs in Expo Go on the phone and on web (localhost:8081) |
| 02 | [Brand assets pipeline](02-brand-assets.md) | M0 | ✅ Done | 2026-09-24 | 2026-09-25 | Launcher icon and native splash to be checked on the first EAS build (AD-01) |
| 03 | [Design tokens & theme engine](03-design-system-tokens.md) | M0 | ✅ Done | 2026-09-25 | 2026-09-25 | |
| 04 | [UI component kit](04-ui-component-kit.md) | M0 | ✅ Done | 2026-09-25 | 2026-09-25 | |
| 05 | [Navigation shell & custom tab bar](05-navigation-shell.md) | M0 | ✅ Done | 2026-09-25 | 2026-09-25 | |
| 06 | [Core utilities: i18n, units, dates, errors, logging](06-core-utilities.md) | M0 | ✅ Done | 2026-09-25 | 2026-09-25 | |
| 07 | [Database engine & migrations](07-database-foundation.md) | M0 | ✅ Done | 2026-09-25 | 2026-09-25 | |
| 08 | [Domain schema, models & validation](08-domain-schema-models.md) | M0 | ✅ Done | 2026-09-25 | 2026-09-25 | |
| 09 | [Seed data](09-seed-data.md) | M0 | ✅ Done | 2026-09-25 | 2026-09-25 | |
| 10 | [Repositories, stores & data hooks](10-data-layer.md) | M0 | ✅ Done | 2026-09-25 | 2026-09-25 | |
| 11 | [Splash & onboarding](11-splash-onboarding.md) | M1 | ✅ Done | 2026-09-25 | 2026-09-25 | |
| 12 | [Profile, settings, goals & equipment](12-profile-settings-goals-equipment.md) | M1 | ✅ Done | 2026-09-25 | 2026-09-25 | |
| 13 | [Exercise library & alternatives](13-exercise-library.md) | M1 | ✅ Done | 2026-09-25 | 2026-09-26 | |
| 14 | [Train tab & workout builder](14-train-workout-builder.md) | M1 | ✅ Done | 2026-09-26 | 2026-09-26 | Reorder by move up/down (no drag); superset/circuit mode not built |
| 15 | [Running interval builder](15-running-builder.md) | M1 | ✅ Done | 2026-09-26 | 2026-09-26 | |
| 16 | [Plan tab: planner & scheduling engine](16-planner-scheduling.md) | M1 | ✅ Done | 2026-09-26 | 2026-09-26 | Move replaces drag-to-day |
| 17 | [Execution engine (domain core)](17-execution-engine.md) | M1 | ✅ Done | 2026-09-26 | 2026-09-26 | Pure reducer, write-ahead persistence, exact resume |
| 18 | [Gym & home/abs execution UI](18-gym-home-execution.md) | M1 | ✅ Done | 2026-09-26 | 2026-09-26 | One tap per set, rest overlay, swap, finish flow |
| 19 | [Running execution UI](19-running-execution.md) | M1 | ✅ Done | 2026-09-26 | 2026-09-26 | Countdown, cues, live adjust, background alarms |
| 20 | [Start tab: daily sequence & completion](20-start-daily-sequence.md) | M1 | ✅ Done | 2026-09-26 | 2026-09-26 | Start resolver, Today's Training, Today complete |
| 21 | [Home: daily command center](21-home-dashboard.md) | M1 | ✅ Done | 2026-09-26 | 2026-09-26 | Home cards, search, retro log, quick-start link |
| 22 | [Body: weight & measurements](22-body-weight-measurements.md) | M2 | ✅ Done | 2026-09-26 | 2026-09-26 | Trend maths, Progress Overview/Body, weight & measurements |
| 23 | [Private progress photos & comparison](23-progress-photos.md) | M2 | ✅ Done | 2026-09-26 | 2026-09-26 | Private storage, capture + ghost, gallery, viewer, compare |
| 24 | [History, analytics, streaks & goals progress](24-history-analytics.md) | M2 | ✅ Done | 2026-09-26 | 2026-09-26 | Streak definition, analytics, history + detail, goals, PRs |
| 25 | [Local notifications](25-notifications.md) | M3 | ✅ Done | 2026-09-26 | 2026-09-26 | Reconcile engine, categories, settings, deep links, actions |
| 26 | [App lock & privacy hardening](26-app-lock-privacy.md) | M3 | ✅ Done | 2026-09-26 | 2026-09-26 | PBKDF2 PIN, biometrics, LockGate, shield, FLAG_SECURE |
| 27 | [Backup, export & import](27-backup-import-export.md) | M3 | ✅ Done | 2026-09-26 | 2026-09-26 | Checksummed JSON/ZIP, validated preview, merge/replace |
| 28 | [Polish: motion, states, accessibility, performance](28-polish-a11y-performance.md) | M4 | ✅ Done | 2026-09-26 | 2026-09-26 | Code polish done; device checks + visual pass → UI phase |
| 29 | [QA & offline certification](29-qa-offline-certification.md) | M4 | 🔄 In progress | 2026-09-27 | — | e2e flows + QA report written; device/emulator runs pending |
| 30 | [Android build & APK release](30-android-release.md) | M4 | 🔄 In progress | 2026-09-27 | — | v1.0.0 config, permissions, BUILD.md, CHANGELOG, listing done; EAS build/sign/install pending |
| 31 | [AI foundation (service, providers, privacy)](31-ai-foundation.md) | M5 | ✅ Done | 2026-09-27 | 2026-09-27 | Gemini / OpenAI / Claude / mock; key in SecureStore; live key test on device pending |
| 32 | [AI Coach experiences](32-ai-coach.md) | M5 | ✅ Done | 2026-09-27 | 2026-09-27 | Coach, ✨ entry points, weekly insight, suggestion diff/apply/undo; chat answers are text (no suggestion cards) |

## Update rules

1. When starting a step, set it to 🔄 In progress and fill **Started** (YYYY-MM-DD).
2. When finishing, set it to ✅ Done, fill **Completed**, and update the Summary counts.
3. When pausing, set it to ⏸️ On hold and explain why in **Notes**.
4. A milestone is ✅ Done only when all its steps are done. It is 🔄 In progress when any step in it has started.
5. Add one line per state change to the changelog below.

## Changelog

| Date | Step | Change |
|---|---|---|
| 2026-09-24 | — | Roadmap created: 32 executable steps across 6 milestones. |
| 2026-09-24 | 01 | Started. |
| 2026-09-24 | 01 | Project scaffolded on Expo SDK 57; all gates pass. Waiting on the Android dev build (no Android toolchain or EAS login here). |
| 2026-09-24 | 01 | EAS project linked. Daily development switched to Expo Go over a tunnel (AD-01 updated). |
| 2026-09-24 | 01 | Done. Owner confirmed the app runs in Expo Go and on web. |
| 2026-09-24 | 02 | Started. |
| 2026-09-25 | 02 | Done. Vector mark, recolourable logo, icon/splash/adaptive assets, Inter fonts. Icon/splash device check deferred to the first EAS build. |
| 2026-09-25 | 03 | Started. |
| 2026-09-25 | 03 | Done. Tokens, dark/light schemes, 6 accents, contrast guard, ThemeProvider, makeStyles. |
| 2026-09-25 | 04 | Started. |
| 2026-09-25 | 04 | Done. 29 themed, accessible components + gallery; custom bottom sheet; toast queue. |
| 2026-09-25 | 05 | Started. |
| 2026-09-25 | 05 | Done. Full route map, custom tab bar with Start FAB, settings hub, guarded execution screens. |
| 2026-09-25 | 06 | Started. |
| 2026-09-25 | 06 | Done. EN/FR i18n with typed keys, units, local dates, AppError, redacting logger. |
| 2026-09-25 | 07 | Started. |
| 2026-09-25 | 07 | Done. SQLite client, transactional migrations with checksum lock, safety copies, startup gate, dev DB screen. |
| 2026-09-25 | 08 | Started. |
| 2026-09-25 | 08 | Done. Full V1 schema (22 tables, 15 indexes), Zod models, row mappers, DDL/model parity tests. |
| 2026-09-25 | 09 | Started. |
| 2026-09-25 | 09 | Done. 68 exercises, 26 equipment, 36 alternative sets, 10 templates, measurement and photo categories; EN/FR names. |
| 2026-09-25 | 10 | Started. |
| 2026-09-25 | 10 | Done. Repositories with invariants, TanStack Query hooks, persisted settings. **Milestone M0 Foundation complete.** |
| 2026-09-25 | 11 | Started. |
| 2026-09-25 | 11 | Done. Animated splash, welcome, 9-step resumable setup, starter weekly plan, one-transaction commit. |
| 2026-09-25 | 12 | Started. |
| 2026-09-25 | 12 | Done. Settings hub, profile/units/appearance/language/training/about, goals CRUD + lifecycle, equipment with presets and impact hints, redo setup. |
| 2026-09-25 | 13 | Started. |
| 2026-09-26 | 13 | Done. Alternative engine, searchable library, exercise detail, custom exercise form; fixed post-save navigation guard bug. |
| 2026-09-26 | 14 | Started. |
| 2026-09-26 | 14 | Done. Train tab, workout detail, builder with live duration estimate, cover photos, alternatives swap. |
| 2026-09-26 | 15 | Started. |
| 2026-09-26 | 15 | Done. Interval builder with timeline, totals, presets and repeat blocks; running detail. |
| 2026-09-26 | 16 | Started. |
| 2026-09-26 | 16 | Done. Recurrence + materialization engine, conflicts, Plan tab (day/week/month), schedule form, session actions and detail. |
| 2026-09-26 | 17 | Started. |
| 2026-09-26 | 17 | Done: execution reducer (strength + running), runtime state, applyTransition, runner, store, useNow, dev harness; 243 tests. |
| 2026-09-26 | 18 | Started. |
| 2026-09-26 | 18 | Done: strength execution screen, rest overlay + cues + background alarm, swap/overview/edit/notes, exit & discard, completion summary, start wiring + Continue FAB; 256 tests. |
| 2026-09-26 | 19 | Done: running execution screen, countdown, voice/beep cues, background interval alarms, distance, running completion, landscape. |
| 2026-09-26 | 20 | Done: start-state resolver + FAB sync, Today's Training screen, pre-start swaps, rest/empty/quick start, sequencing, Today complete. |
| 2026-09-26 | 21 | Done: Home command center, global search, retroactive log, quick-start linking, midnight rollover. M1 complete. |
| 2026-09-26 | 22 | Done: trend maths, Progress tab Overview/Body, weight screen + quick sheet, measurements (form, detail, custom types), Home quick actions. |
| 2026-09-26 | 23 | Done: private photo storage service, capture with timer/grid/ghost, gallery + recently deleted, viewer, compare (side-by-side/slider), Home photo action. |
| 2026-09-26 | 24 | Done: in-house charts (AD-16 updated), streak/analytics/records/goals domain, unified history + detail with corrections, analytics screen, overview cards, exercise/template stats. M2 complete. |
| 2026-09-26 | 25 | Done: pure reconcile engine + tests, sync service, channels/actions, notification settings, deep links, per-session override. |
| 2026-09-26 | 26 | Done: PIN hashing + backoff policy, lock service, real LockGate + privacy shield, screenshot blocking, App lock & Privacy settings, onboarding PIN setup. |
| 2026-09-26 | 27 | Done: backup format + checksum, export JSON/ZIP with share, validated import (upgrade, Zod, FK), merge/replace with safety copy, monthly reminder. M3 complete. |
| 2026-09-26 | 28 | Done (code side): motion, 0 console warnings (boxShadow, pointerEvents, web guards), states/a11y audit, demo dataset, 2 indexes (m002), perf guard. Device checks + visual refinement moved to the UI enhancement phase. |
| 2026-09-26 | UI phase | Assets: ASSETS.md rewritten (template analysis, prompt column, exact paths); accent-tinted mountain layers (MountainBackdrop, transparent placeholders); workout cover editor on detail screens; exercise media (m003 `exercise_media`: images, GIFs, video links; library thumbnails, workout 'How to do it', backups). |
| 2026-09-26 | UI phase | Owner mountains integrated (WebP bases, alpha rim masks, accent tint + screen blend). Layout matched to template.png: Home (header mountains, activity rows, action tiles, week mini-stats), Train (row cards), Start (list + image hero), Progress (chips, area chart, Weekly Stats, Body Measurements), Plan (month row, bare week strip, time/date rows), Welcome (dark + light). Dev "Load template scenario" for side-by-side checks. |
| 2026-09-26 | UI phase | Enhancements: glass/3D accent fill (GlassFill) on primary buttons, selected chips and FAB; tab bar with rounded top + active pill; per-activity colour/icon (Settings → Activities, `activity.styles`); Home: Developer panel moved to Settings → Developer tools (dev only), fancier This Week cards, tappable Quick Action tiles; m004 (`equipment.icon_key/image_path`, `photo_categories.name`): equipment icon/picture editor (+ backups), Photos: Take photo / Upload buttons, custom photo groups, per-group Add. |
| 2026-09-26 | UI phase | Owner routine (docs/default programs): seed v2 adds 5 equipment, 8 exercises, 12 templates (3 gym days, 3 abs, 6 runs in mph); `applyRoutine` runs once after onboarding: archives other workouts, replaces the plan with a shared 3-on / 1-off cycle (abs 12:10, run 16:30, gym 17:05, 8-day running rotation), mph + km. Drop-in image folders `assets/images/{workouts,exercises,equipment}` via `require.context`; ASSETS.md prompts rewritten (accent-neutral style). |
| 2026-09-26 | UI phase | Pictures everywhere: shared picker (`services/media/storedImage.ts`: private file on the phone, resized data URI on web); covers, equipment and exercise media now work on web; tappable cover with "Change cover" badge; profile picture (`profile.avatar` setting, Profile screen, Home + Settings avatars); progress photos on web via IndexedDB (`webFs.ts`). |
| 2026-09-26 | UI phase | Routine v2: fixed Monday–Sunday week (Thu rest, Sunday run 14:00 + gym 14:45), non-routine workouts removed. Less accent in backgrounds (`primarySoft` token, softer borderAccent/glow). Execution redesign from docs/template/running.png: shared `execution/parts.tsx` (GlowRing, PillButton, RoundButton, BigMetric, MetricCard, NextCard, PhaseStrip) used by running, strength/abs and the rest overlay. |
| 2026-09-27 | UI phase | Routine v3: fix apply aborting on a started planned session (FK), re-applies once. Workout screens: optional faint backgrounds `assets/images/execution/{running,gym,abs}.webp` (ExecutionBackdrop via ScreenContainer `background`), exercise picture card in gym/abs (app image → bundled exercise image). |
| 2026-09-27 | UI phase | Routine v4: rules start on this week's Monday and a fresh apply materializes from there (full current week); self-heals when no active rule is left; applied for any existing profile. Plan and Home rows show the workout cover (SessionVisual) when one exists. |
| 2026-09-27 | UI phase | Routine v5: week from docs/plan/weak.md (per-day times, gym = run end + 5 min), materialization orders a day by start time. Plan: Week / Month views; day score (excellent ≥ 85 %, good ≥ 50 %, bad) from logged sets/intervals (`schedule.workForRange`, `domain/planner/progress.ts`), coloured day rings, month status card, per-activity progress (%, Not done). |
| 2026-09-27 | 29–30 | Code side: 9 Maestro flows + subflow (`e2e/flows`, not run yet), `qa-report.md` (automated coverage, device matrix, certification), `qa-issues.md`. Release config: version 1.0.0, blocked legacy storage/audio permissions, `docs/BUILD.md`, `CHANGELOG.md`, `docs/store-listing.md`. Pending: emulator/device runs, EAS preview/production builds, signing backup, v1.0.0 tag. |
| 2026-09-27 | 31 | Done: `services/ai` (AIService prepare→run, Gemini generateContent, OpenAI Responses, Claude Messages with structured output + refusal fallbacks, mock), 30 s/90 s timeouts, one retry, human errors, pure summarizer with whitelist tests, prompts with safety wording, Zod Insight + one repair retry, m005 AI tables (cache by payload hash, excluded from backups), suggestion preview/apply via repositories (move, rest day, replace exercise), expo-network offline check, Settings → AI assistant (provider, masked SecureStore key, model, test, tone, notes opt-in, consent + payload preview, history delete), Profile link. AI off by default (`ai.enabled`). |
| 2026-09-27 | 32 | Done: AI Coach (`/coach`: local week facts, 5 report actions, adapt-workout with constraints, recent reports, chat threads with delete), ✨ entry points hidden when AI is off (Home weekly insight + Ask your coach, Progress, workout detail, running detail, Plan, swap sheet "More ideas", Settings), suggestion cards with exact before/after diff, conflict warnings, Apply + Undo toast, Ignore, auto-expiry of stale suggestions, prompts folder with golden tests, wording guard, token usage display, a11y labels. Roadmap code complete; steps 29–30 device/emulator runs and the EAS build remain. |
| 2026-09-27 | UI phase | Fixes: ListRow splits into pressable area + trailing control when both exist (no nested buttons: chat threads, photo groups); Home header mountains full width (light veil instead of the left fade); default profile picture `assets/images/avatar/avatar.png` (Avatar `fallbackSource`) until the user picks one. |
| 2026-09-27 | UI phase | Exercise demos: expo-video loops (`assets/videos/exercises`, `bundledVideo`) on the exercise screen and in gym/abs execution; personal-use importer `scripts/lyfta/scrape.mjs` → 104/106 covers + videos (git-ignored) and `scripts/lyfta/data/exercises.json`; seed v3 adds 30 extra exercises + 6 equipment for later. |
| 2026-09-27 | UI phase | Execution: demo video keeps looping for the whole workout (resumes after screen lock/background) and also plays in the rest overlay (the upcoming exercise), with a smaller ring. |
| 2026-09-27 | 1.1.0 | Welcome screen per docs/template/1000026522.png (home_bg art, features, CTA); onboarding multi-goal (`goals[]`), VYRO week default in step 7 (`plan: vyro|custom`, `routine_opt_out`), PBKDF2 1k rounds with yielding + spinner + background rehash of old PINs, taller Home hero. Version 1.1.0. |
| 2026-09-27 | 1.1.0 | Home hero panel + ui.png cards (pill StatusLabel, SectionHeader icon/chevron, ActionTile card), 3×15 gym standard (seed + one-time `gym_reps_v1`), weight delta vs last session, `pruneSampleWorkouts` on start, CAMERA permission restored (image-picker `cameraPermission: false` stripped it), BottomSheet lifts above the keyboard. |
| 2026-09-27 | 1.1.0 | Home header mountains anchored low (image ratio, sunk 80 dp): the peaks rise ~50 dp above the Today card instead of filling from the top. |
| 2026-10-02 | 1.2.0 | Routine v6: Push/Pull/Legs (gym_push/pull/legs) + runs (run_real_speed, run_tempo_endurance, run_easy_16), run before gym, fixed week, no abs; starting weights (seed `targetWeightKg`), prefill = last lifted over plan, `routine_applied_at` limits "last time" to the current program; 3 new exercises + Lyfta media; 3×15 override removed; self-healing video load (replaceAsync on error/timeout); seed v4. |
| 2026-10-02 | 1.2.0 | Routine v7: Push = lying chest press, incline + decline bench, pec deck, DB press, lateral raise (dumbbell video), cable leaning lateral raise (image only), pushdown, overhead extension; Pull preacher curl; `syncRoutineTemplates` rewrites routine workouts on apply; scraper `pages` / `imageOnly`; seed v5. |
