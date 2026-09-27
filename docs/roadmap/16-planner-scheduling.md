# 16 — Plan Tab: Planner & Scheduling Engine

| | |
|---|---|
| Milestone | M1 Core training loop |
| Depends on | 14, 15 |
| Spec refs | FS §15, §16, §22, §36, §37, §79 · UI §24, §25, §26 · AD-05, AD-09, AD-17 · Template screen 5 "PLAN — Calendar & Schedule" |
| Output | Recurrence engine with materialization, conflict detection, the Plan tab (day/week/month), schedule form and session actions |

## Objective

Plan answers "What am I doing later?" (UI §24). The user stays in control: flexible moves, rest days as first-class, conflict warnings rather than blocks (FS §37).

## Part A — Scheduling engine (`src/domain/scheduling/`, pure)

### Recurrence
```ts
occurrences(rule: ScheduleRule, from: LocalDate, to: LocalDate): LocalDate[]
```
- `daily` every N days; `weekly` every N weeks on `by_weekday`; `monthly` on `by_month_day` (clamped to month end, 31 → 30/28); `custom` = weekly with an arbitrary weekday set and interval.
- Respects `start_date`, `end_date`, and the user's week start for "every 2 weeks" anchoring.

### Materialization (AD-09)
```ts
planMaterialization(rules, existingKeys: Set<`${ruleId}|${originalDate}`>, window): NewSession[]
```
- Window: today … today + 56 days. Run at app start, on resume after midnight, when the planner navigates past `materialized_until`, and after rule edits.
- Idempotent through `UNIQUE(rule_id, original_date)`.
- **Rule edits** apply to future, non-exception, still-`planned` occurrences only (delete and regenerate those). Past, completed, skipped or exception occurrences are never touched (FS §78).
- **Deleting a rule**: choose "only future" (default) or "cancel this and future". Past rows stay.

### Conflicts
```ts
detectConflicts(candidate, sameDaySessions): Conflict[]
```
- Kinds: `time_overlap` (both timed and overlapping), `same_type_same_day` (two gym sessions), `rest_day` (adding training on a planned rest day), `heavy_day` (more than 2 non-rest sessions or total above 150 min).
- The result is a warning with a human message: "Tuesday already contains Back + Running. Add Chest anyway?" (FS §37). Never blocking.

### Derived status
- `displayStatus(session, today)`: `missed` when `planned` and date < today (AD-17). Rest sessions in the past show **Rest ✓** (planned rest honoured), not missed.

### Tests
- [x] Every freq type, month-end clamping, DST weeks, and week-start variants.
- [x] Materialization idempotency; rule edit leaves completed/exception rows untouched.
- [x] Every conflict kind, and the missed vs rest derivation.

## Part B — Repository operations (extend `scheduleRepo`)

| Operation | Behaviour |
|---|---|
| `create(one-time)` | Row with `rule_id = NULL`, `original_date = scheduled_date` |
| `createRule` | Insert rule, then materialize |
| `move(id, date, time?)` | Update date/time, `reschedule_count += 1`, `is_exception = 1` if from a rule. Keep `original_*` |
| `duplicate(id, date)` | New one-time row copied from the source |
| `skip(id, reason?)` | `status = 'skipped'`, store `skip_reason`; later offer a reschedule (FS §79) |
| `cancel(id)` | `status = 'cancelled'` (removed from plan but auditable) |
| `setRestDay(date)` | Insert a `type='rest'` session; optionally move that day's sessions |
| `reorderDay(date, ids[])` | Update `order_in_day` |

## Part C — Plan tab UI (template screen 5)

```text
Plan                                               ›
September 2026                         [Day|Week|Month]
Mon Tue Wed Thu Fri Sat Sun
 21  22  23 (24) 25  26  27        ← dots: ● planned, ✓ done, ☕ rest, ! missed
Today · Wednesday, 24 Sep
18:00  [icon] Gym        Upper Body · 55 min      ›
20:00  [icon] Six Pack   Abs · 12 min              ›
Upcoming
Thu 25 Sep   ○ Rest Day                          ›
Fri 26 Sep   [icon] Running  30 min · Intervals  ›
                                   [ + Add Activity ]
```

- [x] **Week strip**: swipe between weeks, selected day filled with the accent (like "24" in the template), today outlined when not selected. Per-day markers use icons, not only colour.
- [x] **Day view**: timeline of the selected day with the actions below.
- [x] **Month view**: a grid with per-day activity markers. Tap a day to go to day view.
- [x] **Upcoming**: the next 7 days of sessions, including rest days.
- [x] Session row actions (swipe or long-press sheet): **Start** (today only), **Move** (date and time picker sheet with a conflict preview), **Duplicate**, **Skip**, **Mark complete (retroactive log)**, **Edit**, **Cancel**, **Delete** (one-time only).
- [x] **Quick reschedule**: "Tomorrow", "Next free day" (the first day without training), "Pick date". FS §16 quick reschedule.
- [ ] **Drag to another day** in week view where practical (FS §16). Long-press, drag onto a day chip, drop, conflict check, confirm. The action sheet "Move" is the accessible path.

## Part D — Schedule form (`session/new`, UI §25)

```text
WHAT?   (○ Gym ○ Running ○ Six Pack ○ Rest ○ Other) → template picker filtered by type
WHEN?   Date · Time (optional) · Duration (prefilled from template)
REPEAT? Never · Daily · Weekly · Monthly · Custom (every N weeks)
DAYS    Mon Tue Wed Thu Fri Sat Sun (weekly/custom)
ENDS    Never · On date · After N times
REMIND  None · 5 · 15 · 30 · 60 min before (wired in step 25)
```

- [x] A conflict warning is shown inline before save.
- [x] Prefill from context: from a workout's "Schedule" button, or from a tapped day in the planner.

## Part E — Session detail (`session/[id]`)

- [x] Planned info, linked template preview, status tag with history (moved from Mon → Tue, rescheduled 1×), notes, and actions. For completed sessions it links to the execution detail (step 24).

## Acceptance criteria

- [x] Onboarding rules from step 11 now materialize, and Plan shows 8 weeks ahead.
- [x] Moving Monday's Chest to Tuesday (with Back + Running already there) shows the FS §37 warning and then succeeds.
- [x] Editing a weekly rule's time changes future planned occurrences only.
- [x] A past planned rest day shows as rest, and a past planned workout shows as missed with a "Log it / Skip" prompt.
- [x] `src/domain/scheduling` has at least 90 % coverage.

## Execution log (2026-09-26)

- **Engine** (`src/domain/scheduling/`): `recurrence.ts`: `occurrences()` for daily / weekly / monthly (clamped to month end) / custom (every N weeks, anchored on the start week, respects the week start), `planMaterialization()`, `endDateAfterCount()`, and UTC-noon calendar helpers (DST-proof). `conflicts.ts`: `detectConflicts()` (time_overlap, same_type_same_day, rest_day, heavy_day > 2 sessions or > 150 min; warnings only), `displayStatus()` (derived **missed**, planned rest = **rest**), `nextFreeDay()`. **Domain coverage: 100 % lines**, and the 90 % domain gate is now enabled in `jest.config.js`.
- **Storage** (`scheduleRepo`): `materialize(today)` fills today → +56 days and never recreates moved, skipped or deleted occurrences (existing keys include soft-deleted rows). `ensureMaterialized(until)` extends the window when the planner looks further. `createRule` materializes at once. `updateRule` hard-deletes only future planned non-exception occurrences and regenerates them, leaving completed and exception rows untouched. `deleteRule(from)` deletes from today, or ends the day before a future date. Also `setRestDay`, and move/duplicate/skip/cancel/restore from step 10.
- **When it runs:** startup task (bootstrap), right after onboarding (the starter plan appears immediately), `DayRollover` (on foreground with a new date: materialize, refresh, move the planner to today), and planner range queries.
- **Plan tab** (template screen 5): month subtitle, Day/Week/Month, week strip with prev/next (selected filled, today outlined, **icon markers**: dot = planned, ✓ = done, ☕ = rest, ! = missed) or month grid, the selected day's sessions (rest-day and empty cards), Upcoming (next 7 days, rest included), "Today" shortcut, pinned **Add Activity** (prefills the selected date). Planned rows show no tag (clean, as in the template); real states do.
- **Session actions** (`useSessionActions`): Start (today; toast until step 17), **Move** (date picker sheet + time + live conflict preview, then "Move anyway"), quick **Tomorrow** / **Next free day**, Duplicate (to a chosen day/time), Skip, Mark complete (past; toast until step 17), Restore (skipped/cancelled), Details, Cancel, Delete (one-time) or **Stop repeating from here** (rule occurrences).
- **Schedule form** (`/session/new?templateId=&date=`): What (type chips → that type's workouts, or a custom title), When (date sheet, optional time, duration prefilled from the workout), Repeat (never, daily every N days, weekly, monthly on the date's day, custom every N weeks), Days, Ends (never / on a date / after N times → end date computed), Reminder (stored; delivered in step 25), inline conflict warning. Unsaved guard.
- **Session detail** (`/session/[id]`): planned date and time, status, "Originally …" and "Rescheduled n times", repeating note, skip reason, link to the workout, notes, and the actions sheet.
- **Deviations:** drag-to-another-day is not built; **Move** is the path, and it also shows conflicts. Date and time use in-app sheets (month grid, hour/15-min steppers), so no native date-picker dependency is needed and it works in Expo Go.
- **Tests:** recurrence (all frequencies, month-end clamp, every-2-weeks anchoring, start/end/inactive, DST), materialization plan, conflicts (the FS §37 example gives time overlap + same type + heavy day), display status, next free day, and repository tests for materialization (8 weeks, idempotent, window extension, never recreating moved/skipped/deleted, rule edits keep completed/exception rows, stop from a date, rest day). Headless web: weekly Upper Body scheduled, Push on the same Wednesday shows "Overlaps Upper Body at 18:00. This day already has Upper Body.", month view 35 days, skip works. Zero errors.
