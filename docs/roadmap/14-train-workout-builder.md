# 14 — Train Tab & Workout Builder

| | |
|---|---|
| Milestone | M1 Core training loop |
| Depends on | 13 |
| Spec refs | FS §13, §21, §68 · UI §13, §14, §48 · Template screen 2 "TRAIN — Workouts Library" |
| Output | The Train tab, workout detail, and a builder for gym / home / abs / recovery / other templates |

## Objective

Train answers "What workouts and exercises can I do?" (UI §13). Creating workouts belongs here; scheduling belongs to Plan (UI §48).

## Train tab (template screen 2)

```text
Train                                          [🔍]
[All] [Gym] [Running] [Six Pack] [Other]        ← chips (Six Pack = abs + home)
MY WORKOUTS
[cover] Upper Body   Gym · 55 min · 6 exercises   ›
[cover] Leg Day      Gym · 60 min · 7 exercises   ›
[cover] 30min Run    Running · 30 min · Intervals ›
…
LIBRARY   Exercise library ›   Equipment ›   Archived ›
                              [ + Create Workout ]   ← primary pill, sticky above tab bar
```

- [x] Row subtitle is computed: type · estimated duration · exercise or interval count.
- [x] Rows show a **⚠ "2 unavailable"** tag when an exercise needs missing equipment.
- [x] Search filters by name. Long-press a row for a context menu: Start now, Schedule, Duplicate, Edit, Archive.
- [x] "Create Workout" opens a type chooser sheet: Gym · Home · Six Pack/Abs · Running (→ step 15 builder) · Recovery · Other.

## Workout detail (`workout/[id]`)

- [x] Hero with `CoverArt`, name, type, duration, difficulty, description.
- [x] Exercise list with sets × reps / duration, rest and notes, plus availability and a "swap" hint.
- [x] Primary: **Start now** (ad-hoc execution; wired in step 17, disabled with a tooltip until then). Secondary: **Schedule** (→ `session/new?templateId=` from step 16), **Edit**, **Duplicate**.
- [x] "Last performed" and "times completed" placeholders, filled in step 24.

## Builder (`workout/new`, `workout/[id]/edit`)

Planning screens may be detailed (FS §77).

- [x] Header fields: name, type, description, difficulty, cover picker (bundled covers, plus a local photo from `expo-image-picker` copied into private storage).
- [x] **Estimated duration** is auto-computed from sets × (reps × ~3 s or duration) + rests + ~60 s per exercise transition. The user can override it.
- [x] Exercise list:
  - "+ Add exercise" opens the library picker in multi-select, filtered by "available" by default.
  - Each item: sets, reps **or** duration (depends on `tracking`), target weight (optional, unit-aware), rest, notes.
  - **Drag to reorder** (`react-native-draggable-flatlist` or a Reanimated-based list; verify SDK compatibility). Fallback: move up/down buttons for accessibility (always present in the item menu).
  - Per-item menu: duplicate, replace (opens alternatives), superset with next (optional `superset_group`), remove.
  - Per-set overrides (for example a pyramid of 12/10/8) with an "advanced" toggle, stored as a JSON array in notes v1 or as separate rows. **Decision:** keep uniform sets in V1 and record the pyramid idea in `IDEAS.md`. It is not in the spec, so do not over-build.
- [x] Validation: a name is required, at least one exercise, and reps or duration is set for each.
- [x] Unsaved changes guard on back.
- [x] Save runs in one transaction and replaces child rows. **Editing a template never changes past executions** (they use `planned_snapshot`).

## Home / Abs specifics (FS §21)

- [x] Same builder, but defaults favour duration and bodyweight, and the weight field is hidden unless the exercise tracks weight.
- [ ] A "Circuit mode" flag (rounds × exercise list, rest between rounds) is stored in template notes metadata for step 18 to honour. It is optional; implement only if cheap.

## Acceptance criteria

- [x] The Train tab visually matches template screen 2 (chips, rows with covers, sticky Create CTA).
- [x] The user can create, edit, reorder, duplicate and archive a gym workout and an abs workout.
- [x] Deleting a template used in history archives it instead, with an explanation.
- [x] The duration estimate updates live while editing.

## Execution log (2026-09-26)

- **Train tab** (template screen 2): search toggle, chips All/Gym/Running/Six Pack (abs + home)/Other, "My Workouts" with CoverArt, the subtitle "Gym · 55 min · 6 exercises" (runs: "· Intervals"), a compact "⚠ n" unavailable badge (full wording for screen readers), and a long-press menu (Start now → toast until step 17, Schedule → `/session/new?templateId=`, Duplicate, Edit, Archive, Delete). Library shortcuts: Exercise library, Equipment, Archived (sheet with Restore). The pinned "Create Workout" opens a type chooser (Gym, Home, Six Pack/Abs, Running → step 15 builder, Recovery, Other).
- **Workout detail** (`/workout/[id]`): hero with cover, subtitle and difficulty, description, Start Workout (toast until step 17), Schedule, Edit, and exercises with targets (sets × reps/time, weight in the user's unit, rest), an unavailable note and a tap to the exercise's alternatives. A history placeholder (step 24), Duplicate (opens the copy in the builder) and Delete (`templates.remove` archives when history references it, with an explaining toast).
- **Builder** (`/workout/new?type=`, `/workout/[id]/edit`): name, type, description, difficulty, cover (Automatic or **Choose photo**: copied into private storage `vyro-private/covers/`, stored as `photo:<relative path>`, native only), a live **duration estimate** (`src/domain/workouts/duration.ts`: ≈3 s/rep or set time + rest between sets + 60 s per exercise) with an optional manual override, and exercise cards (sets, reps or time by tracking, weight only for weight×reps in kg/lb, rest, notes). Each card's menu: move up/down, duplicate, replace (alternatives engine), remove. Validation: name, ≥1 exercise, targets per item. Unsaved guard with `leave()` after save. Saving replaces child rows in one transaction.
- **Deviations (recorded):** reordering uses move up/down (the accessible path) instead of drag-and-drop, because the drag list libraries aren't confirmed compatible with RN 0.86 + Reanimated 4. Superset grouping and circuit mode (optional in the spec) are not built. Sets stay uniform per exercise, as decided in the roadmap.
- `templates.summaries()` gives exercise ids per template and interval counts, and `useTemplateLabel()` shows translated names for seeded templates.
- **Tests:** duration estimate, builder model (defaults, validation, lb→kg conversion, estimate vs override, move), template summaries, a picker sheet test (search + multi-select), and a full builder screen test (name → picker → save → template stored, guard off at redirect). Jest now loads Gesture Handler's official `jestSetup`. Screen tests call Testing Library 14's async `fireEvent` without `act()` wrappers.
- Headless web pass: 10 workouts, Running filter → 2, cable machine off → Upper Body flagged, create a gym workout through the type sheet with picker search ("squat" → 3), live estimate, save → detail. Zero errors. The screenshot review led to the compact badge and FAB clearance fixes.
