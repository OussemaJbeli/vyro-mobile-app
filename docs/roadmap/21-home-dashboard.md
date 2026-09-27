# 21 — Home: Daily Command Center

| | |
|---|---|
| Milestone | M1 Core training loop |
| Depends on | 20 |
| Spec refs | FS §30, §54, §55, §56 · UI §2–§9, §40 · Template screen 1 "HOME — Daily Overview" |
| Output | The Home screen that answers "What do I need to know and do today?" in one glance |

## Objective

Home is the most important screen (UI §2). Priority order is strict (UI §40): date → today's status → today's activities → resumable activity → quick actions → weekly status → streak → upcoming → small insight. Analytics must never push today's activities down.

## Layout (template screen 1)

```text
Good evening, Alex 👋                    [🔍] [avatar]
Wednesday, 24 Sep
┌ TODAY (hero card, mountain bg, accent border) ─┐
│ Today                                          │
│ 3 activities                                   │
│ [🏃] Running  30 min · Intervals  ✓ Completed  │
│ [🏋] Gym      Upper Body · 55 min ◉ Next       │
│ [🔥] Six Pack Abs · 12 min        ○ Pending    │
│ 1 / 3 completed ███░░░░░░  33 %                │
└────────────────────────────────────────────────┘
(if in progress) ┌ Continue · Upper Body · Bench Press · Set 2 / 4  [Continue] ┐
Quick Actions
 (+)Workout  (🏃)Running  (⚖)Weight  (📏)Measure  (📷)Photo
This Week
  4 Gym   2 Runs   3 Abs   4h 18m Training
🔥 7 day streak   ▓▓▓▓▓░░ 5/7
Upcoming
 Tomorrow · Running · 30 min · 18:00           ›
(small insight) Weight 74.6 kg · ↓ 0.4 kg this week   ›
```

## Tasks

### Header
- [x] Greeting by time of day (morning/afternoon/evening/night), the optional name, the localized date. Search opens a global search sheet (exercises, workouts, history via simple local `LIKE`, FS §73). The avatar opens Settings.

### Today card
- [x] `TodayStatusCard` states: **training** (the list plus progress), **rest** (Recovery Day card, UI §5, with next activity and "View schedule"), **empty** ("Nothing planned today", with Plan / Quick start), **complete** (all done ✓, total time).
- [x] Row tap goes to session detail. Each status shows icon + text (UI §4).
- [x] A `ContinueBanner` appears only when an execution is active.

### Quick actions (UI §7, FS §55)
- [x] **Workout** → sheet: Start empty · Start from template · Log past workout.
- [x] **Running** → sheet: Start a running template · Log a run.
- [x] **Weight** → quick weight sheet (a big stepper prefilled with the last value and Save; one tap to log the same weight ± 0.1). The sheet ships in step 22. Until then, the action is hidden behind a flag.
- [x] **Measure** → step 22. **Photo** → step 23. Both are shown once those steps land.
- [x] Compact circular `IconTile`s in one row (horizontal scroll on narrow screens).

### This Week (UI §8)
- [x] `WeeklySummary`: counts of completed Gym / Runs / Abs+Home and total training time for the current week (the user's week start). Tapping it opens Progress → Training.
- [x] Completion line: "5 / 6 planned activities completed" (planned excludes rest and cancelled).

### Streak (UI §9)
- [x] `StreakCard` uses the step 24 definition. Until then, compute a provisional streak from completed executions. Subtle styling.

### Upcoming
- [x] The next non-rest session after today (or the next 2).

### Small insight
- [x] One line: latest weight with the weekly trend (step 22), or "Next goal milestone". Nothing else. The AI insight slot is reserved for step 32.

### Behaviour
- [x] Pull to refresh. Automatic refresh at midnight, and on returning to foreground if the date changed (a "new day" boundary).
- [x] Skeletons while loading. Cold-start target: Home interactive in under 1.5 s on a mid-range Android with 6 months of data.
- [x] All cards are separate memoized components subscribed to narrow queries.

## Acceptance criteria

- [x] Home matches template screen 1 in structure and feel.
- [x] Rest day, empty, training, in-progress and complete states are all reachable and correct (dev date override helps test this).
- [x] Completing a set in execution and returning Home updates the Today card and progress without a manual refresh.
- [x] **M1 exit check:** a new user can onboard → see a plan → press Start → complete Upper Body → see Home update → see tomorrow's plan. This is the FS §92 typical day, minus the progress views.

## Execution log

**2026-09-26 — Done.** M1 is complete.

- **Home** (`(tabs)/home.tsx` composes memoized cards from `components/home/HomeCards.tsx`, each on narrow queries):
  - **Header**: greeting by time of day with the profile name, localized date, 🔍 → `SearchSheet` (local exercises / workouts / history), avatar → Settings.
  - **`TodayStatusCard`**: training (ordered list, "Next" tag, rows → session detail, "1 / 3 completed" progress with %), rest (Recovery Day + View schedule), empty (Plan / Quick start), complete ("All done today ✓", total time). It shares `useStartState` with the Start tab, so the FAB, Start and Home can't disagree.
  - **`ContinueBanner`**: only while a workout is active ("Continue · Upper Body", "Set 2 / 4 · Continue").
  - **`QuickActions`**: Workout sheet (Start empty · Start from a workout · Log past workout), Running sheet (Start a running plan · Log a run). Weight / Measure / Photo sit behind `featureFlags.weightLog/measurements/photos` until steps 22–23.
  - **`WeeklySummary`**: Gym / Runs / Abs & home / training time for the user's week, "5 / 6 planned activities completed", → Progress. Pure `domain/progress/weekly.weekSummary`.
  - **Streak**: `provisionalStreak` (consecutive days with a completed activity; rest days neutral) plus "n/7 active days". Step 24 replaces the definition.
  - **Upcoming**: the next 2 non-rest sessions ("Tomorrow · 30 min · 18:00").
  - **Small insight**: latest weight + weekly trend (appears once weights exist, step 22).
- **Behaviour**:
  - Pull to refresh invalidates all queries. `DayRollover` now also fires at midnight while the app stays open, as well as on foreground after a date change.
  - Skeleton while loading.
  - Execution transitions invalidate `sessions`/`execution`, so Home updates without a manual refresh.
- **Retroactive log** (deferred from step 17): `/log/new` (`RetroLogForm`), reachable from "Log past workout", "Log a run" and the planner's "Mark complete" on a session.
  - Pick a workout, date/time and duration, then per-set done + reps/weight/duration (or per-interval done + duration/speed), prefilled with the plan.
  - The pure `retroLog` replays the actuals through the same reducer, so outcome/invariants match a live workout. `executionRepo.logRetroactive` commits in one transaction (`is_retroactive = 1`) and opens the completion screen.
- **Quick start linking** (from step 17): the completion screen offers "Link to today's planned “Gym”?" for unlinked workouts when a planned same-type session exists today. `executionRepo.linkToSession` updates the session status (invariant 3).
- **Tests (+4)**: `weekly.test.ts` (summary, streak), `retro.test.ts` (strength and running replay). Total 265, `pnpm check` green.
