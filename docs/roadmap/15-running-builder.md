# 15 — Running Interval Builder

| | |
|---|---|
| Milestone | M1 Core training loop |
| Depends on | 14 |
| Spec refs | FS §19, §69 · AD-06, AD-08 |
| Output | A dedicated interval builder with a live timeline preview, quick presets, and running template detail |

## Objective

Make structured treadmill plans explicit instead of mental (FS §88.4). Building a 6-interval plan should take under a minute.

## Builder (`running/new`, `running/[id]/edit`)

```text
Name  [ Interval Run 35 ]              Target distance (optional) [ 5.0 km ]

TIMELINE  ▁▂▅▂▇▁   (bar chart: width = duration, height = speed, colour by kind)
Total 35:00 · Est. distance 4.4 km · Avg 7.5 km/h

 1  Warmup    05:00   8.0 km/h   1 %    ⋮
 2  Run       10:00   9.7 km/h   1 %    ⋮
 3  Sprint    05:00  12.9 km/h   1 %    ⋮
 …
[ + Interval ]  [ + Repeat block ]  [ Presets ▾ ]
```

- [x] Interval editor sheet: kind (warmup/run/walk/sprint/recovery/cooldown), duration (mm:ss wheel), speed (unit-aware stepper, 0.1 step), incline %, label.
- [x] Row actions: duplicate, delete, move up/down, drag reorder (FS §69).
- [x] **Repeat block:** "repeat N× [run 2:00 @ 12 km/h, walk 1:00 @ 6 km/h]". It expands into concrete interval rows on save (the schema stays flat and simple), and the UI remembers the grouping through a `label` convention. Keeping the stored model flat means execution needs no special logic.
- [x] Live computed totals (FS §69 "Show total calculated duration"): total time, estimated distance = Σ(speed × duration), average speed.
- [x] `RunningTimeline` component (shared with step 19 and history): bars sized by duration, height by speed, accent intensity by kind, labelled current marker when used in execution.
- [x] Presets: "Easy 30", "Intervals 35 (FS §19)", "Pyramid", "HIIT 20 (1:1)", "5K prep". Applying a preset replaces or appends after a confirm.
- [x] Validation: at least one interval, each duration > 0, speed within 0–30 km/h.

## Domain helpers (`src/domain/running/`)

- [x] `totalDuration(intervals)`, `estimatedDistanceKm(intervals)`, `averageSpeed(intervals)`, `expandRepeatBlock(block)`, `timelineAt(intervals, elapsedSec) → { index, remainingInInterval }`. The last one is used by execution.
- [x] Unit tests including the FS §19 sample (35:00 total).

## Running detail (`running/[id]`)

- [x] Timeline, interval table, totals, Start now / Schedule / Edit / Duplicate, and last run stats (step 24).

## Acceptance criteria

- [x] Recreating the FS §19 example shows Total **35:00**.
- [x] Speeds entered in mph are stored in km/h and shown back in mph unchanged.
- [x] A repeat block of 6× (2:00 run / 1:00 walk) expands into 12 rows with correct totals.

## Execution log (2026-09-26)

- **Domain** (`src/domain/running/`): `totalDuration`, `estimatedDistanceKm` (Σ speed × time), `averageSpeed` (time-weighted), `maxSpeed`, `expandRepeatBlock` (flat rows labelled "3/6"), `timelineAt(intervals, elapsedSec)` → current index / elapsed / remaining / finished (for step 19), `formatMinSec`, `invalidIntervals` (time > 0, speed 0–30 km/h). Presets in `presets.ts`: Easy 30, Intervals 35 (FS §19, exact mph → km/h), Pyramid, HIIT 20 (1:1 via a repeat block), 5K prep.
- **RunningTimeline** (`src/components/running/`): SVG bars (width = duration, height = speed, brightness = effort by kind), optional `currentIndex` highlight and `progress` marker for execution, and an accessible summary label.
- **Builder** (`/running/new`, `/running/[id]/edit`): name, optional target distance (user unit → km), live timeline with Total / Est. distance / Avg speed. Interval rows (tap opens options: edit, duplicate, move up/down, delete). The interval editor has type chips, minutes + seconds steppers, speed in km/h or mph (0.1 steps), incline and label. **Repeat block** sheet (times, work, recovery) inserts flat rows. **Presets** sheet with a mini timeline per preset: it applies directly to an empty plan, otherwise offers Replace / Add after, and fills the name if empty. Validation highlights bad rows. Unsaved guard with `leave()`.
- **Speeds are stored unrounded in km/h**, so mph entries come back exactly (tested). Only a value the user edits gets snapped to 0.1 of their unit.
- **Detail** (`/running/[id]`): timeline, totals, target, description, Start Run (toast until step 19), Schedule, Edit, an interval table, history placeholder, Duplicate (opens the copy in the editor), Delete (archives when used in history).
- **Fixes from the web pass:** interval rows no longer nest a menu button inside a pressable row (invalid `<button>` in `<button>` on web); a label that only repeats the interval type is hidden ("Warmup · Warmup" → "Warmup"); the seed's redundant Warmup/Cooldown labels were removed for fresh installs.
- Reordering uses move up/down, as in step 14 (no drag library yet).
- **Tests:** FS §19 = 35:00 and its distance, 6× repeat → 12 rows / 18 min, timeline position, presets valid, builder model (validation, mph round trip, target conversion, reorder), interval titles, and a screen test (preset → 35:00 → save → 6 intervals, 9 mph sprint, guard off). Headless web in mph: seeded plan shows 5/6/8/6/9/5 mph and 3.8 mi; adding the default repeat block → 18 rows, 53:00; save returns to the detail with 18 intervals.
