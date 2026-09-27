# 24 — History, Analytics, Streaks & Goals Progress

| | |
|---|---|
| Milestone | M2 Progress & insight |
| Depends on | 22, 23 |
| Spec refs | FS §31–§34, §71, §78 · UI §22, §23 · AD-16, AD-17 |
| Output | History with filters and detail (planned vs actual), analytics, personal records, the streak definition, goal progress, and the chart library integration |

## Objective

History must be trustworthy (FS §78). Analytics must be useful and honest: no fake precision (FS §32), and planned vs completed over a generic "fitness score" (FS §33).

## Part A — Chart library spike (AD-16)

- [x] In one hour, try `victory-native` (Skia) with the current SDK: a line chart with a glow stroke, gradient area, touch tooltip and 365 points. If it builds and runs smoothly on Android, adopt it. Otherwise use `react-native-gifted-charts`.
- [x] Wrap the chosen library in `src/components/charts/{LineChart,BarChart,Sparkline}.tsx` so it can be swapped later. Replace the step 22 SVG sparkline.
- [x] Charts follow the theme: accent line, muted grid, tabular labels, and accessible summaries ("Weight decreased from 76.1 to 74.6 kg over 4 weeks").

## Part B — Analytics domain (`src/domain/analytics/`, `src/domain/streaks/`, `src/domain/goals/`)

### Definitions (document them in the code and show them in-app through ⓘ info sheets)

| Metric | Definition |
|---|---|
| Planned (period) | Scheduled sessions in the period with `type ≠ rest` and `status ≠ cancelled` |
| Completed | Those with `status ∈ {completed, modified}`, plus **ad-hoc** executions (counted separately as "extra") |
| Completion rate | completed_planned / planned. Shown only when planned > 0 |
| Per-type breakdown | Gym 3/3 · Running 1/2 · Abs 2/3 (FS §33) |
| Training time | Σ `active_seconds` of completed and partial executions |
| Muscle-group frequency | Count of exercise sets done per primary muscle (and secondary at 0.5), per week |
| Running | Total distance (entered, or estimated and labelled), total duration, average speed, per-interval history |
| **Streak** | Count of consecutive **satisfied** days, walking back from today. If today still has pending sessions, start from yesterday. A day is *satisfied* when every non-rest planned session is completed/modified, **or** it is a planned rest day, **or** it had an ad-hoc workout. A day with nothing planned and nothing done is **neutral**: it neither counts nor breaks the streak. A day with a missed or skipped planned session **breaks** it. |
| Longest streak | Maximum over all history |
| Personal records | Per exercise: heaviest weight (for reps ≥ 1), best estimated 1RM (Epley, labelled "estimated"), most reps at a given weight, longest duration hold; per running: longest duration, highest average speed |
| Rescheduling | Count of moved sessions and the average shift (from `reschedule_count` and `original_date`) |

- [x] Pure functions over plain rows. SQL aggregations only where performance needs them (weekly counts), with indexed queries.
- [x] Unit tests for every definition, especially streak edge cases (rest days, empty days, today pending, a timezone change).

### Goals progress
- [x] `goalProgress(goal, data)` → `{ current, start, target, fraction, remaining, status }` per type (step 12 table).
- [x] **Estimate** (FS §34, §80): only for weight/measurement goals with a sufficient trend (from step 22). "At your recorded trend of −0.4 kg/week, you'd reach 70.0 kg in approximately 11–12 weeks. This is an estimate." Show a range, not a date, and hide it when the trend points away from the target.
- [x] Auto-suggest "Mark achieved?" when the target is reached. The app never changes the goal status on its own.

## Part C — History (Progress → History segment, `history/index`)

```text
[All] [Gym] [Running] [Abs] [Home] [Rest] [Body] [Photos]
SEP 24
 ✓ Upper Body      Gym · 54 min · modified ⓜ
 ✓ Six Pack        Abs · 12 min
SEP 23
 ✓ Interval Run    22 min · 3.1 km (est.) · partial
SEP 22
 ☕ Rest (planned)
SEP 21
 ! Leg Day         missed           [Log it] [Skip]
 ⚖ Weight 74.6 kg
```

- [x] A unified timeline merging executions, planned rest days, missed/skipped sessions, weight entries, measurement sessions and photos, grouped by day. Cursor-paginated (FS §62).
- [x] Filters as in FS §31 and UI §22, plus a search box (FS §73).
- [x] **Execution detail** (`history/[executionId]`, FS §71): title, date, duration, outcome badge, exercises with sets (planned vs actual per set, differences highlighted with icons), substitutions ("Cable Fly → Dumbbell Fly · no equipment"), running interval table (planned vs actual), notes, effort, PRs achieved. Actions: edit notes, correct a set (logged as an edit; the original `completed_at` is kept), delete (confirm; hard delete only through a double confirm).
- [x] History renders from `planned_snapshot` plus logs, never from the current template (invariant 5).

## Part D — Analytics screens

- [x] **Progress → Overview** gains: This week planned vs completed (ring plus per-type breakdown), streak (current/longest), goals summary cards (FS §34 style: 74.6 → 70.0, bar, 4.6 kg remaining), latest PRs.
- [x] **Analytics** screen (`analytics`), sectioned (FS §32): Training (sessions/week bar chart for 12 weeks, completion rate line, muscle frequency horizontal bars, total time), Running (distance and duration per week, average speed trend, per-template interval history), Body (weight and measurement trends), Consistency (streaks, planned vs completed calendar heatmap, rescheduling stats).
- [x] Period selector (4W · 12W · 6M · 1Y). Empty and insufficient-data states on every chart.
- [x] Exercise detail (from step 13) now shows personal stats: last performed, best set, estimated 1RM trend, and volume per session.
- [x] Template detail (step 14) shows times completed and the last performed date.

## Acceptance criteria

- [x] A modified session shows both planned and actual values in history, and editing the template afterwards does not change that history.
- [x] Rest days never break the streak. A missed workout does. Tests cover this.
- [x] A week with 8 planned and 6 completed shows 75 % with the per-type breakdown (FS §33).
- [x] Goal estimates appear only with sufficient data and are always labelled as estimates.
- [x] History scrolls smoothly with 500+ entries.

## Execution log

**2026-09-26 — Done.** M2 is complete.

- **Part A, charts (AD-16 updated)**:
  - No Skia spike. Instead there are in-house SVG/View charts: `components/charts/LineChart` (gaps for nulls), `BarChart`, `HBarChart`, and `Sparkline` (moved from body). Each has an accessible summary.
  - Why: zero new native modules (Expo Go and builds stay simple), and the wrappers keep a later `victory-native` swap local.
- **Part B, domain** (pure, tested, definitions documented in code and in-app via ⓘ sheets):
  - `streaks/streak.ts`: day states satisfied/broken/neutral/pending; `streaks` returns current + longest; `streakCalendar` feeds the heatmap. Rest and empty days never break the streak, a missed or skipped session does, and a pending today starts from yesterday. Local dates are timezone-safe.
  - `analytics/metrics.ts`: `plannedStats` (planned, completed, extra ad-hoc, rate only when planned > 0, per-type breakdown), `weekly`, `weeklyRate`, `muscleFrequency` (1 per set for the primary muscle, 0.5 per secondary), `runningTotals`, `reschedulingStats`. The test shows **8 planned / 6 completed = 75 %** with the breakdown.
  - `analytics/records.ts`: heaviest, **estimated** 1RM (Epley), most reps, longest hold, running longest/fastest, and `setIn` per execution for PR badges. The first session is a baseline, not a record.
  - `goals/progress.ts`: `goalProgress` per type (start → target fraction, remaining, reached) and `estimateWeeks` (a range, only toward the target, ≤ 3 years). "Mark achieved?" is only ever suggested, never automatic.
  - `weekly.ts` keeps the Home counts. The provisional streak was removed (Home now uses the real one).
- **Repo**: `doneSets` (sets + muscles, filters), `templateStats`, `finishedBetween`, `correctSet` (keeps `completed_at`), `setOutcome` (recomputed through the engine, invariant 3), `deleteExecution` (hard delete, session back to planned), `measurements.between`. Hooks: `useDoneSets`, `useTemplateStats`, `useFinishedBetween`, `useMeasurementsBetween`.
- **Part C, History**:
  - Progress → History segment and `/history`: a unified day-grouped timeline of workouts (duration, distance, outcome/abandoned), planned rest, missed/skipped sessions (**Log it** → retro log, **Skip**), weights, measurement sessions and photos. Filters All/Gym/Running/Abs/Home/Rest/Body/Photos, search, and "Load earlier" in 30-day windows.
  - `/history/[executionId]`: rendered from the snapshot rows, never the live template (invariant 5). Outcome, duration/distance/effort, PRs set, per-set planned → actual with difference icons, swaps with reason, interval table, notes (edit), **Correct set** (outcome recomputed), and delete with a double confirm.
  - Search and Today complete now open this detail.
- **Part D, Analytics**:
  - Overview gains: **This week** ring + per-type breakdown + extra + time, **Streak** current/longest, **Goals** cards (start → current → target, bar, remaining, labelled estimate, Mark achieved), **Latest PRs**, and an Analytics button.
  - `/analytics` with 4W/12W/6M/1Y:
    - **Training**: sessions/week bars, completion rate line, muscle-group bars, total time.
    - **Running**: totals, distance/week bars, average speed.
    - **Body**: weight trend, measurements link.
    - **Consistency**: streaks, satisfied/missed day heatmap, rescheduling stats.
    - Every section has an insufficient-data state and ⓘ definitions.
  - Exercise detail **Your stats**: last performed, best set, estimated 1RM trend, volume per session. Template detail: "Completed N times · last date".
  - Home streak uses the final definition.
- **Tests (+8)**: streak states and edge cases, planned/completed 75 %, muscle/running/rescheduling, records, goal progress/estimates, DB doneSets/correction/delete. I also fixed a pre-existing flaky logger test (a timestamp could contain "80"). Total 284, `pnpm check` green.
