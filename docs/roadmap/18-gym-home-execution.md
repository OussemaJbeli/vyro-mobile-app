# 18 — Gym & Home/Abs Execution UI

| | |
|---|---|
| Milestone | M1 Core training loop |
| Depends on | 17 |
| Spec refs | FS §17, §18, §21, §76 · UI §12, §16, §42 · Touch token `execution: 64` |
| Output | A fullscreen, one-hand strength execution screen with set logging, rest timer, work timer, substitution and finish flow |

## Objective

During training, interaction must be minimal (FS §76): **What exercise? What set? What weight/reps? Rest? Next?** In the common case, one tap per set.

## Screen anatomy (`execute/[executionId]`)

```text
┌──────────────────────────────────────┐
│ ✕  Upper Body            12:41  ⏸   │  ← elapsed (tabular), pause
│ ████████░░░░░░░  Exercise 2 / 6      │
│                                      │
│ BENCH PRESS                    ⇄ swap│
│ Set 2 / 4          Last time 60×10   │
│                                      │
│   WEIGHT               REPS          │
│  [ −  60 kg  + ]    [ −  10  + ]     │  ← huge steppers, prefilled
│                                      │
│  ● ● ○ ○   (set dots: done/current)  │
│                                      │
│ [        ✓ COMPLETE SET        ]     │  ← 64 px primary
│                                      │
│ NEXT  Incline DB Press · 3×10        │
└──────────────────────────────────────┘
REST overlay (auto after a set):
        REST   01:32   (progress ring)
   [ −15s ]  [ Skip ]  [ +15s ]
   Next: Set 3 · 60 kg × 10
```

## Tasks

- [x] **Prefill logic:** weight/reps = planned target → otherwise last actual for this exercise (from history) → otherwise defaults. Show "Last time 60×10" as a hint (the query runs once at start and is cached).
- [x] **Steppers:** tap ±increment (settings: 2.5 kg / 5 lb), long-press accelerates, tap the value for a numeric keypad. No typing is required in the common path.
- [x] **Complete Set** → haptic success, set dot fills, rest overlay starts (if configured), and the screen reader announces "Set 2 done. Rest 90 seconds."
- [x] **Rest overlay:** progress ring, −15 s / Skip / +15 s, next-set preview, 3-2-1 countdown beeps (setting), end with a haptic plus notification when backgrounded. Tap outside to minimize to a top pill so the user can adjust the next set while resting.
- [x] **Duration exercises** (plank 45 s): big timer with Start → counts down → auto-completes the set with the actual duration; an early Stop records the actual.
- [x] **Reps-only exercises** (crunches): no weight stepper.
- [x] **Exercise overview sheet** (swipe up or tap "2 / 6"): full list with status icons, jump to any exercise, reorder the remaining ones, skip an exercise, add an exercise.
- [x] **Swap ⇄** opens the alternatives from step 13 (available ones first, with the reason). Choosing one dispatches `SUBSTITUTE_EXERCISE` with an optional reason ("Machine busy", "No equipment", "Pain/discomfort", "Preference").
- [x] **Edit a logged set:** tap a filled set dot → edit sheet.
- [x] **Notes:** an optional note per exercise and per session, never required.
- [x] **Pause/Exit sheet** (✕ or hardware back): Resume · Finish now · Save & exit (stays active, FAB shows Continue) · Discard workout (double confirm; keeps nothing only if zero sets were logged, otherwise abandons with the data kept).
- [x] **Finish flow** → `execute/complete/[id]`: summary (duration, sets, volume = Σ reps × kg, PR badges — computed in step 24, placeholder now), **planned vs actual** diff list ("Bench Press: planned 4×10 @ 60 → actual 4×10 @ 62.5"), perceived effort 1–10 (optional chips), notes, then Save. Then return to the Start sequence (step 20) or Home.
- [x] **Home/Abs mode:** same screen, but when the template is in circuit mode, show "Round 2 / 3" and advance through exercises before sets. Timers are more prominent.
- [x] Keep the screen awake. Lock orientation to portrait. Large text scaling is capped on the steppers so they don't overflow.

## Acceptance criteria

- [x] A full Upper Body session is completable with **one tap per set** when using planned values.
- [x] Rest continues correctly while the phone is locked, a notification fires at rest end, and on return the overlay shows the correct remaining time or "Rest over".
- [x] Swapping Cable Fly → Dumbbell Fly mid-workout shows up in the completion diff and in the DB `planned_exercise_id`.
- [x] Every control is at least 64 px on the main execution surface, and TalkBack can complete a set.

## Execution log

**2026-09-26 — Done.**

- **Screen** `execute/[executionId]` → `components/execution/StrengthExecution.tsx` (thin route).
  - Top bar: ✕, title with active elapsed time (tabular), and ⏸.
  - Progress bar with "Exercise 2 / 6" or "Round 2 / 3". Tapping it opens the overview.
  - Exercise name + ⇄ Swap, "Set 2 / 4", "Last time 60 kg × 10".
  - Labelled xl steppers (64 dp, long-press accelerates, tap to type) and set dots.
  - 64 dp **Complete set**, and a "Next: Barbell Row · 4×10" footer + Note.
  - Every control on the main surface is ≥ 64 dp. Text scaling is capped through the `timer`/`metric` variants.
- **Prefill** (pure `domain/execution/summary.prefill`): planned target → previous set this session → last time → exercise defaults.
  - Last time comes from `executionRepo.lastPerformance`: the top set of the most recent *completed* session. It is one query per workout (`useLastPerformance`).
  - Weights are in the user's unit (`useWeightInput`: setting step 2.5 kg, or 5 lb); the canonical kg logged is exactly what was shown.
- **Complete set**: haptic, the dot fills, auto-rest (setting), and a screen-reader announcement ("Set 2 done. Rest 90 seconds.").
- **Rest overlay**: ring, −15 s / Skip / +15 s, next-set preview. Tap outside minimizes it to a top pill. A TICK is dispatched when time is up.
  - "Rest over" toast + announcement, also after returning from the background.
  - 3-2-1 cues: haptic ticks + beeps (`expo-audio`, generated `assets/sounds/{tick,go}.wav` via `scripts/sounds/generate-beeps.mjs`, setting `training.countdownBeeps`).
  - **Background alarm**: `services/execution/alarms.ts` (expo-notifications DATE trigger) is plugged into the runner's `AlarmNotifier`. It is scheduled at `nextAlarmAt` when backgrounded and cancelled on return.
- **Duration exercises**: a big countdown with Start → auto-complete at target → early Stop logs the actual time. A manual duration stepper + "Complete set" covers users who skip the timer (FS §18 timers optional).
- **Reps-only**: no weight stepper.
- **Overview sheet**: status icons, jump, move remaining up/down, skip set/exercise, add set, add exercise (step 14 picker), **circuit mode** toggle, workout note.
- **Swap sheet**: `suggestAlternatives` (available first) + optional reason chips → `SUBSTITUTE_EXERCISE`. The DB keeps `planned_exercise_id`.
- **Edit set**: tap a filled dot → sheet → `EDIT_SET`.
- **Notes**: per exercise (`setExerciseNote`) and per workout (`setNotes`). `completeIn` no longer overwrites notes/effort that were not provided.
- **Pause/Exit sheet** (✕ or hardware back): Resume · Finish now · Save & exit (stays active) · Discard with a double confirmation.
  - `executionRepo.discard`: soft-deletes when nothing was logged, otherwise abandons with the data kept; the scheduled session goes back to `planned`.
  - ⏸ shows a Paused layer with Resume.
- **Finish** → `execute/complete/[id]` (`CompletionSummary`):
  - Outcome tag, then duration / sets / volume Σ reps×kg / exercises tiles, and a PR placeholder (step 24).
  - **Planned vs actual** list (`plannedVsActual`, e.g. "Planned 4×10 @ 60 kg → Actual 4 × 10/10/10/8 @ 60–62.5 kg", "Swapped from Cable Fly").
  - Optional effort 1–10 chips + notes → `saveReview` → Home. Step 20 will route to the Start sequence.
- **Home/Abs circuit mode**: engine `circuit` flag (runtime state, `SET_CIRCUIT`). It is on by default for `home`/`abs` sessions: after each set the cursor moves to the next exercise, shown as "Round n / N". Templates have no circuit field, so the session type decides and the user can toggle it.
- **Start wiring** (`useStartWorkout`): Train menu "Start now", workout detail, running detail and Plan session actions "Start" build the snapshot and start it.
  - With a workout already active, a "Workout in progress → Continue" dialog appears.
  - Running templates show "Live runs arrive in the next step" until step 19.
  - The **Start FAB shows Continue** ("Continue Upper Body workout") while a workout is active, and the Start tab press opens it.
- Portrait is already locked (`app.config.ts`); keep-awake comes from the step 17 runner.
- **Tests (+13, total 256)**:
  - `strength-execution.test.tsx`: the full Upper Body session with **exactly one tap per set** → as_planned → the scheduled session is `completed` → the review saves effort 7.
  - Cable Fly → Dumbbell Fly swap with a reason → rest overlay +15 s → pause 10 min (rest unchanged) → skip → finish → `planned_exercise_id` kept, `modified`, "Swapped from Cable Fly" in the diff, `paused_seconds = 600`.
  - Abs starts in circuit mode ("Round 1 / 3"), and the double-confirmed discard removes the empty workout.
  - `summary.test.ts`: circuit order, prefill priority, summary/volume, diff.
  - `execution-review.test.ts`: lastPerformance top set (abandoned sessions ignored), notes kept through finish, saveReview, discard both paths.
- **Smoke (web, headless; new fullscreen screen)**:
  - Workout detail → Start → Bench Press, Set 1 / 4, Exercise 1 / 6.
  - Complete set → rest overlay 1:29 with "Next: set 2" → Skip → Set 2 / 4.
  - Save & exit → FAB label "Continue Upper Body workout" → Continue reopens set 2.
  - Finish now → completion screen "Partially completed" with planned vs actual. Zero console errors.
  - The screenshot led to adding stepper labels.
- **Notes**:
  - `expo-audio` is bundled in Expo Go; its config plugin is only needed for recording, so it is not added.
  - Rest-end notifications need the notification permission (onboarding step 8). Without it they are silently skipped.
  - Verify the locked-phone alarm on the device (Expo Go supports local notifications).
