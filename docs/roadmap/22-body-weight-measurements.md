# 22 — Body: Weight & Measurements

| | |
|---|---|
| Milestone | M2 Progress & insight |
| Depends on | 21 |
| Spec refs | FS §23–§26, §32, §57 · UI §17–§19 · Template screen 4 "PROGRESS — Track & Analyse" (Weight card, Body Measurements) |
| Output | The Progress tab shell with an Overview segment, the Body segment, weight logging and trends, measurements, and Home quick actions for weight and measure |

## Objective

Track the body independently of workouts (FS §23), and avoid misleading conclusions from single readings (FS §24).

## Trend maths (`src/domain/progress/trend.ts`, pure)

- **Smoothed weight:** an exponentially weighted moving average (α ≈ 0.25 per day, gap-aware), or a 7-day rolling mean. Pick one, document it, and test it.
- **"This week" change** = smoothed value now − smoothed value 7 days ago. It is shown only if there are at least 3 entries in the last 14 days. Otherwise show "Log a few more weigh-ins to see a trend".
- **Rate:** a linear regression slope over the last 28 days (kg/week), with an `insufficient` flag when there are fewer than 4 points or the span is under 10 days.
- **BMI** = kg / m². Only with a height. Label it "BMI" and nothing more. No health judgement text (FS §44).
- Never extrapolate a target date here. That is step 24 (goals), and only as a labelled estimate.

## Progress tab structure (UI §18)

`SegmentedControl`: **Overview · Body · Photos · History**. Photos arrives in step 23 and History in step 24. Show both segments now with a "Coming soon" empty state.

### Overview (built now; more cards added in 23–24)
```text
Weight                                   ›
74.6 kg      ↓ 0.4 kg this week
(line chart: raw dots + smoothed line, 4 weeks)
Weekly Stats   4 Gym · 2 Runs · 3 Abs · 4h 18m
Body Measurements
 Height 180 cm ›   BMI 22.8 ›   Body Fat 12.4 % ›   (body fat only if logged)
```

### Body segment
- [x] Height (from profile), current weight, and a list of measurement types with their latest value, change since the previous entry, and the date. Tap a type for its detail.

## Screens

### Weight (`body/weight`)
- [x] Chart with a range selector (1M · 3M · 6M · 1Y · All). It shows raw points and the smoothed trend line. Use a simple SVG sparkline now; step 24 swaps in the chosen chart library (AD-16).
- [x] Stats: current (latest), previous, change, 28-day rate (or "not enough data"), lowest and highest in the range.
- [x] Paginated list of entries (date, value, note), with swipe to edit or delete (confirm).
- [x] "+ Log weight" opens the **quick weight sheet**: a big stepper prefilled with the last value, unit-aware, date/time (default now, editable for back-dating), and a note. Validation: 25–300 kg equivalent. A warning (not a block) appears when the entry is more than 5 % away from the last one: "That's 4.1 kg from your last entry. Save anyway?"

### Measurements (`body/measurements`, `body/measurement/[typeId]`)
- [x] Grid of types with the latest values. "+ Log measurements" opens a **multi-entry form**: all active types in one scroll, each optional. It saves every filled field in one transaction with the same `recorded_at` (a "measurement session").
- [x] Type detail: chart, history list, change since first entry and since last entry.
- [x] Manage types: add custom (name, kind length/percent/other, unit), reorder, archive (history is kept).

### Home wiring
- [x] Enable the **Weight** and **Measure** quick actions from step 21. Replace the Home small insight with the real weight trend.

## Tasks

- [x] Domain trend functions with tests (a noisy synthetic series, gaps, one outlier, a unit switch).
- [x] Components: `WeightCard`, `TrendBadge` (↓/↑ arrow + text, never colour only; "down" is not judged as good or bad; a neutral tone unless it matches the goal direction from step 12), `MeasurementCard`, `QuickWeightSheet`, `MeasurementForm`.
- [x] Notes on every entry (FS §72).

## Acceptance criteria

- [x] Logging weight from Home takes at most 2 taps when the value equals the last one.
- [x] Trend text only appears with sufficient data. Tests prove it.
- [x] Switching kg ↔ lb re-renders every chart and value correctly.
- [x] A custom measurement "Forearm" can be created, logged and charted.

## Execution log

**2026-09-26 — Done.**

- **Trend maths** `domain/progress/trend.ts` (pure, documented):
  - Smoothing is a **gap-aware EWMA**, α = 0.25/day (reading weight = 1 − 0.75^Δdays).
  - `weeklyChange` = smoothed now − smoothed 7 days ago; null unless there are ≥ 3 readings in 14 days.
  - `rate28` is a least-squares slope in kg/week, `insufficient` when there are < 4 points or the span is < 10 days.
  - `bmi` (height required, no judgement). `changes` gives the change since previous/first.
  - `trend.test.ts` covers a noisy series, an outlier, a long gap, insufficient data and unit invariance (canonical kg).
- **Progress tab** (`components/progress/ProgressScreen.tsx`): Overview · Body · Photos · History segments. History shows "Coming soon" until step 24; Photos is supplied by step 23.
  - **Overview**: `WeightCard` (latest value, `TrendBadge` or "Log a few more weigh-ins…", 4-week sparkline with raw dots + smoothed line, Log weight), a Weekly Stats line, and Body Measurements (Height → profile, BMI if height is set, Body fat only if logged, Log measurements).
  - **Body**: height, current weight with date, each measurement type with its latest value/date → detail, Manage measurements.
- **Weight** (`/body/weight`):
  - 1M/3M/6M/1Y/All range chart (simple SVG `Sparkline`, AD-16 swap in step 24).
  - Stats: current, previous, change, 28-day rate or "Not enough data", lowest/highest in range.
  - Paginated entries ("Show more"). Tapping an entry edits it or deletes it with a confirmation; this replaces swipe gestures for simplicity and accessibility.
- **`QuickWeightSheet`**:
  - An xl stepper prefilled with the last value (unit-aware, step 0.1). Date/time default to now; back-dating is allowed but future dates are not.
  - Note field. Range 25–300 kg (in the user's unit).
  - A > 5 % difference asks "That's 4.1 kg from your last entry. Save anyway?".
  - Home → Weight → Save = **2 taps** for the same weight.
- **Measurements**:
  - `/body/measure` multi-entry form: every active type is optional and all entries are saved in one transaction with one `recorded_at`. Length is canonical cm, and `unit_entered` is recorded.
  - `/body/measurements`: latest values, reorder ↑↓, archive (history kept), **add custom** (name, kind length/percent/other, unit).
  - `/body/measurement/[typeId]`: chart, change since previous/first, history with edit/delete.
- **`TrendBadge`**: ↓/↑ + text, never colour alone. Neutral unless the change matches the active weight goal's direction.
- **Home**: the Weight (quick sheet) and Measure (form) quick actions are enabled. The small insight now uses the smoothed weekly change.
- New `progress` i18n namespace (EN/FR, keys for steps 22–23). **Tests +6** (total 271), `pnpm check` green.
