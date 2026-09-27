# 17 — Execution Engine (Domain Core)

| | |
|---|---|
| Milestone | M1 Core training loop |
| Depends on | 16 |
| Spec refs | FS §14, §17, §18, §20, §61, §76, §78 · UI §11, §12, §42 · AD-07, AD-10, AD-11 |
| Output | A pure, deterministic execution reducer for strength and running sessions, timestamp-based timers, persistence, crash-safe resume and outcome derivation |

## Objective

This is the heart of VYRO. When the user trains, nothing may be lost: not a set, not a timer, not an interval. Backgrounding, screen lock, a phone call or an OS kill must all resume exactly (UI §12). The original plan must survive untouched next to the actual result (FS §14).

**No UI in this step** beyond a dev harness. Steps 18–19 build the screens on top.

## Lifecycle

```text
          start(snapshot)
 (none) ─────────────────► ACTIVE ◄──────┐
                             │  pause     │ resume
                             ▼            │
                           PAUSED ────────┘
                             │
          finish / finishEarly│               abandon
                             ▼                   ▼
                         COMPLETED           ABANDONED
```

Strength sub-phases inside ACTIVE: `READY → WORKING(set) → RESTING → WORKING(next) … → EXERCISE_DONE → … → ALL_DONE`.
Running sub-phases: `COUNTDOWN(3s) → INTERVAL(i) → INTERVAL(i+1) … → ALL_DONE`.

## Runtime state (persisted in `session_executions.runtime_state`)

```ts
type RuntimeState = {
  schemaVersion: 1;
  kind: 'strength' | 'running';
  lifecycle: 'active' | 'paused' | 'completed' | 'abandoned';
  startedAt: IsoInstant;
  pausedAt: IsoInstant | null;
  accumulatedPauseMs: number;
  // strength
  cursor?: { exerciseIdx: number; setIdx: number };
  phase?: 'ready' | 'working' | 'resting' | 'all_done';
  rest?: { startedAt: IsoInstant; durationMs: number; extendedMs: number } | null;
  workTimer?: { startedAt: IsoInstant; targetMs: number } | null;   // duration-tracked exercises
  // running
  interval?: { index: number; startedAt: IsoInstant; plannedMs: number; adjustedMs: number;
               speedKmh: number | null; inclinePct: number | null };
};
```

**Clock rule (AD-10):** elapsed = `now − startedAt − accumulatedPauseMs (− currentPauseSpan)`. Remaining rest = `rest.startedAt + durationMs + extendedMs − now`. UI ticking only triggers re-renders; it never mutates state. The reducer receives `now` as an input, so tests control time completely.

## Events (reducer input)

| Event | Effect |
|---|---|
| `START` | Snapshot → state; create `session_exercises` + planned `exercise_sets` rows, or `running_interval_logs` rows as `pending` |
| `COMPLETE_SET { reps?, weightKg?, durationSec? }` | Mark set done with actuals (defaults = planned, so one tap in the common case, FS §76); start rest if configured and auto-rest is on |
| `EDIT_SET { setId, … }` | Correct an already-logged set |
| `SKIP_SET`, `ADD_SET` (`is_extra`), `SKIP_EXERCISE` | Recorded explicitly, never deleted |
| `SUBSTITUTE_EXERCISE { exerciseId, reason }` | Replace the pending exercise; `planned_exercise_id` keeps the original |
| `REORDER_REMAINING` / `JUMP_TO_EXERCISE` | Change the cursor without losing logs |
| `REST_SKIP`, `REST_ADJUST { ±15s }` | Timers are always optional and editable (FS §18) |
| `START_WORK_TIMER` / `STOP_WORK_TIMER` | Duration exercises (plank 45 s), with auto-complete at target |
| `INTERVAL_NEXT` (skip), `INTERVAL_REPEAT`, `INTERVAL_ADJUST_SPEED`, `INTERVAL_ADJUST_INCLINE`, `INTERVAL_ADJUST_DURATION` | Running controls (FS §20) |
| `TICK { now }` | Running only: auto-advance when an interval's time is up (log actual duration, start the next) |
| `PAUSE`, `RESUME` | Pause span accounting |
| `FINISH` / `FINISH_EARLY` | Close open sets/intervals as skipped or partial, then compute the outcome |
| `ABANDON` | Keep all logged data, `status='abandoned'`; the scheduled session goes back to `planned` (or stays for a retry) |

The reducer returns `{ state, effects[] }`. Effects are **descriptions**, executed by a thin runner: `persistSet`, `persistIntervalLog`, `persistRuntimeState`, `scheduleRestNotification`, `cancelRestNotification`, `haptic('success')`, `sound('beep')`, `keepAwake(on|off)`. This keeps the reducer pure and testable.

## Persistence and resume

- [x] **Write-ahead rule:** every event that changes recorded data persists (in one transaction) *before* the UI shows it as saved. `runtime_state` is saved on every transition, and at most every 5 s during running ticks.
- [x] App start: `executionRepo.getActive()`. If one exists, `executionStore` rehydrates, and the Start FAB shows **Continue** (UI §10).
- [x] If the app was killed during a rest or an interval, time kept passing. On resume the reducer computes where the user *should* be. A running session that ran past several intervals while killed auto-advances with the logged actual durations, and the user sees a "Resumed — 2 intervals completed while away" banner. They can adjust (edit durations) before continuing.
- [x] **Stale sessions:** an active execution older than 12 h prompts "Finish, resume or discard?" on next open. Nothing is auto-deleted.
- [x] Only one active execution (invariant 1). Starting another prompts "Finish/abandon current first".
- [x] `expo-keep-awake` while ACTIVE (setting in step 12). Rest-end and interval-change local notifications are scheduled while backgrounded and cancelled on foreground or change.

## Outcome derivation (`deriveOutcome(snapshot, logs)`)

| Condition | Outcome | Scheduled session status |
|---|---|---|
| All planned sets/intervals done, no substitutions, reps within ±10 %, duration within ±15 % | `as_planned` | `completed` |
| Everything done but with substitutions, extra sets, changed load/speed or reps outside the tolerance | `modified` | `modified` |
| Some planned work skipped or finished early | `partial` | `modified` |

Completed-with-modifications is still a completion for streaks and completion rate (step 24). The difference stays visible in history.

## Ad-hoc, quick start and retroactive logging

- [x] **Quick start** *(engine + repo ready: `scheduledSessionId = null`; the "Link to today's planned?" prompt ships with the screens, steps 18–20)* from a template (Train "Start now"): execution with `scheduled_session_id = NULL`. On finish, offer "Link to today's planned Gym?" if a same-type planned session exists today.
- [x] **Retroactive log** *(repo `isRetroactive` + same outcome logic ready; the form ships in steps 18–20)* (from a missed or planned session, or "+ Workout" quick action): prefilled form with the planned values → the user edits actuals → saved with `is_retroactive = 1`, `started_at` = chosen time. The same outcome logic applies.
- [x] **Empty workout**: start with no template, add exercises on the fly; the snapshot is built as you go.

## Tasks

- [x] `src/domain/execution/{types,reducer,strength,running,outcome,time}.ts`.
- [x] `src/services/execution/runner.ts`: effects executor plus AppState listener (background/foreground) plus notification scheduling hooks.
- [x] `executionStore` (Zustand): holds `state`, `dispatch(event)`, and selectors (`currentExercise`, `restRemainingMs(now)`, `progress`).
- [x] `useNow(intervalMs)` hook: a 250 ms tick for timers while visible, paused when backgrounded.
- [x] Dev harness `src/app/dev/execution.tsx`: start a seed template, fire events, time-travel (+30 s, +5 min), inspect state and DB rows.

## Tests (at least 95 % coverage of `domain/execution`)

- [x] Happy path: Upper Body, all sets complete → `as_planned`.
- [x] Substitution plus extra set → `modified`, `planned_exercise_id` preserved.
- [x] Finish early after 3 of 6 exercises → `partial`, remaining marked skipped.
- [x] Pause 10 min during rest → the remaining rest is unchanged after resume.
- [x] Running FS §19 plan: TICK through every interval → six logs with correct actual durations; skipping interval 3 logs `skipped`; repeat inserts `is_repeat`; speed change logs `actual_speed_kmh`.
- [x] Kill/resume simulation: the state rebuilt from persisted rows and `runtime_state` equals the in-memory state.
- [x] Clock skew: `now` earlier than `startedAt` (device clock changed) clamps to 0 and never goes negative.

## Acceptance criteria

- [x] In the dev harness, force-killing the app mid-rest and reopening restores the exact exercise, set and remaining rest.
- [x] The DB after a session contains the untouched `planned_snapshot` plus actual rows, and a correct outcome and scheduled-session status.

## Execution log

**2026-09-26 — Done.**

- **Pure engine** `src/domain/execution/`: `types`, `time` (active clock excluding pauses, clamped at 0 for clock skew, `isStale` 12 h), `internal` (copy-on-write `Draft`), `strength`, `running`, `outcome`, `reducer`, `hydrate`, `snapshot`.
  - Every event carries `now`. Clock-derived work (rest expiry, timed-set auto-complete, interval auto-advance) is *settled* before each event, so a TICK after a kill lands exactly where the user should be. Auto-advance uses `timelineAt` over the remaining intervals, and `caughtUp` feeds the "Resumed — N intervals completed while away" banner.
  - The transition returns `{ state, changes, effects, caughtUp }`. `changes` are row writes and `effects` are haptic/keep-awake. The same state reference is returned when nothing changed, so there is nothing to persist.
  - Alarms are **derived** (`nextAlarmAt(state, now)`) instead of emitted, so notification scheduling can never drift from state.
  - `deriveOutcome`: reps ±10 %, duration ±15 %; substitutions, extras, added exercises, repeats, load/speed/incline changes → `modified`; any planned skip/partial, or nothing done → `partial`.
  - `buildSnapshot(template, lookup)` freezes a template (AD-07).
- **Runtime state** (`runtimeStateSchema`, epoch ms) holds only what the rows do not: lifecycle, cursor, phase, rest, work timer, current interval, per-exercise tracking and adjusted interval targets. `hydrate(rows, …)` + `toRuntime(state)` round-trip exactly, and an unreadable runtime state falls back to a fresh one.
- **Write-ahead persistence**: `executionRepo.applyTransition(id, changes, runtime)` commits the row changes and the runtime state in one transaction. Completion and abandon go through the same transaction (shared `completeIn`/`abandonIn`, invariant 3 kept).
- **Runner** `src/services/execution/runner.ts`: `resume`, `start`, `commit`, `runEffects` (haptics, `expo-keep-awake` honouring `training.keepAwake`), and `watchAppState`. Going to background schedules `nextAlarmAt` through an `AlarmNotifier` hook (no-op until step 25); coming back cancels it and TICKs.
- **Store** `executionStore`: serialized `dispatch` (reduce → persist → publish → effects), `start`, `caughtUp`, selectors (`selectCurrentExercise`, `selectRestRemainingMs`, `selectProgress`), `engineNow` + `timeTravel` for the harness. Bootstrap binds the runner, resumes the active execution and TICKs once.
- **`useNow(250)`**: re-render clock, stopped in the background.
- **Dev harness** `/dev/execution` (Home dev panel → Execution): start Upper Body or Interval run 35, fire every event, +30 s/+5 min time travel, live `runtime_state`.
- **Tests (+26, total 243)**:
  - `domain/execution/__tests__/engine.test.ts` covers the happy path → as_planned, substitution + extra → modified, finish early → partial, pause 10 min during rest, rest adjust/skip, timed sets, skip/jump/reorder/edit, empty workout, abandon, the FS §19 TICK run, catch-up after a kill, skip → skipped, repeat/speed → modified, duration edits, finish mid-run, clock skew, round-trip, stale flag, tolerances and the snapshot.
  - `db/__tests__/execution-engine.test.ts`: against real SQLite, a kill mid-rest rebuilds a state equal to memory; the plan snapshot stays untouched; the scheduled session becomes `modified`; running edits and catch-up survive a kill; the empty workout persists.
  - Coverage of `domain/execution`: 99.7 % lines / 96.6 % statements.
- **Smoke (web, headless; justified by the startup-path change)**: start → complete set → page reload restores the same set with rest still counting (1:29 → 1:24) → +5 min ends the rest → abandon. Zero console errors.
- **Left to the UI steps**: the 3 s running countdown and beeps (`training.countdownBeeps`) and the stale "Finish, resume or discard?" prompt (`isStale` ready) belong to the screens in steps 18–19. Notification delivery comes in step 25.
