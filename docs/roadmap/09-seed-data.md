# 09 — Seed Data

| | |
|---|---|
| Milestone | M0 Foundation |
| Depends on | 08 |
| Spec refs | FS §10–§13, §19, §21, §26, §27, §51 · UI §20 |
| Output | A versioned, idempotent seed with equipment, exercises, alternatives, measurement types, photo categories and starter templates |

## Objective

The app must be useful on first launch (FS §51). The seed gives a curated library the user can edit or extend, plus starter workouts that mirror the template screens: Upper Body, Leg Day, Push, Pull, Abs, 30 min Run, Interval Run.

## Design

- Seed content lives in typed TS files under `src/db/seed/data/`. Stable **slugs** identify rows, so re-seeding never duplicates.
- A `seed_version` value in `app_settings`. The seeder runs when `seed_version < CURRENT_SEED_VERSION`, and **only inserts missing slugs**. It never overwrites user edits to seeded rows.
- Seed strings are English canonical names plus i18n keys (`exercise.bench_press.name`). The UI shows the translated name when the user has not renamed the row.

## Content

### Equipment (about 20)

| Category | Items |
|---|---|
| free_weights | Dumbbells, Barbell, EZ bar, Kettlebell, Weight plates |
| machines | Cable machine, Lat pulldown, Seated row, Leg press, Leg curl, Leg extension, Chest press, Pec deck, Smith machine |
| cardio | Treadmill, Stationary bike, Rowing machine |
| accessories | Flat bench, Adjustable bench, Pull-up bar, Resistance bands, Exercise mat, Ab wheel, Dip station |

Default `available`: all on. Onboarding step 6 lets the user untick what they do not have.

### Exercises (about 70, covering FS §51 and more)

| Category | Examples (slug → tracking) |
|---|---|
| chest | bench_press, incline_dumbbell_press, dumbbell_bench_press, chest_press_machine, cable_fly, dumbbell_fly, pec_deck, push_up, dips |
| back | pull_up, lat_pulldown, seated_row, barbell_row, dumbbell_row, deadlift, face_pull, band_row |
| shoulders | shoulder_press, dumbbell_shoulder_press, lateral_raise, cable_lateral_raise, rear_delt_fly, arnold_press, pike_push_up |
| arms | bicep_curl, hammer_curl, cable_curl, tricep_extension, tricep_pushdown, skull_crusher, bench_dip |
| legs | squat, goblet_squat, leg_press, lunge, bulgarian_split_squat, romanian_deadlift, leg_curl, leg_extension, calf_raise, glute_bridge, hip_thrust |
| core | crunch, leg_raise, hanging_leg_raise, plank (duration), side_plank (duration), bicycle_crunch, russian_twist, mountain_climber (duration), dead_bug, ab_wheel_rollout, flutter_kicks (duration), v_up |
| cardio | treadmill_run (distance_duration), jump_rope (duration), burpee, jumping_jacks (duration), rowing (distance_duration), bike (distance_duration) |
| mobility | hip_flexor_stretch, cat_cow, thoracic_rotation, hamstring_stretch, foam_roll (all duration) |
| full_body | kettlebell_swing, thruster, clean_and_press |

Each exercise includes the primary muscle, secondary muscles, required equipment slugs, sensible defaults (sets, reps or duration, rest), difficulty, and 2–4 short instruction steps.

### Alternatives (explicit mappings, FS §12, UI §16)

Examples, all directional with priority:

```text
bench_press          → dumbbell_bench_press(1), chest_press_machine(2), push_up(3)
cable_fly            → dumbbell_fly(1), pec_deck(2)
lat_pulldown         → pull_up(1), band_row(2), dumbbell_row(3)
seated_row           → dumbbell_row(1), barbell_row(2), band_row(3)
leg_press            → goblet_squat(1), squat(2), bulgarian_split_squat(3)
leg_curl             → romanian_deadlift(1), glute_bridge(2)
tricep_pushdown      → tricep_extension(1), bench_dip(2)
cable_lateral_raise  → lateral_raise(1)
hanging_leg_raise    → leg_raise(1)
treadmill_run        → bike(1), rowing(2), jump_rope(3)
```

Every machine or cable exercise must have at least one alternative that needs only dumbbells or bodyweight. A seed test enforces this.

### Measurement types

chest, waist, hips, neck, arm_left, arm_right, thigh_left, thigh_right, calf, body_fat (percent). All non-custom and reorderable.

### Photo categories (UI §20 is the more detailed list; use it)

```text
body  → body.front, body.side, body.back
hair  → hair.front, hair.top, hair.side
beard → beard.front, beard.left, beard.right, beard.other
```

### Starter templates (`is_seed = 1`)

| Name | Type | Content |
|---|---|---|
| Upper Body | gym | bench_press 4×10, barbell_row 4×10, shoulder_press 3×10, lat_pulldown 3×12, bicep_curl 3×12, tricep_pushdown 3×12 (55 min) |
| Leg Day | gym | squat 4×8, romanian_deadlift 3×10, leg_press 3×12, lunge 3×10, leg_curl 3×12, calf_raise 4×15, plank 3×45 s (60 min) |
| Push | gym | 5 exercises (50 min) |
| Pull | gym | 5 exercises (50 min) |
| Full Body | gym | 6 exercises (60 min) |
| Abs (Six Pack) | abs | crunch 3×20, leg_raise 3×15, plank 3×45 s, bicycle_crunch 3×20 (12 min) |
| Home Workout | home | push_up, goblet_squat, lunge, pike_push_up, glute_bridge, plank (30 min) |
| 30 min Run | running | 5′ warmup 8 km/h → 20′ run 10 km/h → 5′ cooldown 6 km/h |
| Interval Run 35 | running | FS §19 plan: 5@5 mph, 10@6, 5@8, 5@6, 5@9, 5@5 mph cooldown (stored as km/h) |
| Recovery | recovery | Mobility flow, 5 exercises (20 min) |

## Tasks

- [x] Write data files and a `seed.ts` runner inside one transaction.
- [x] Idempotency test: run the seed twice and row counts stay unchanged.
- [x] User-edit test: rename a seeded exercise, bump the seed version, re-seed, and the rename persists.
- [x] Integrity tests: every alternative and equipment slug resolves, every template exercise exists, and interval durations add up to the template duration.
- [x] Add EN and FR i18n keys for all seeded names.

## Acceptance criteria

- [x] A fresh install contains the full library, visible in the dev DB screen counts.
- [x] All seed tests pass.

## Execution log (2026-09-25)

- Content: **26 equipment** (added jump rope and foam roller, which the exercises need), **68 exercises**, **36 alternative mappings**, 10 measurement types, 13 photo categories, **10 starter templates** (8 exercise templates + "30 min Run" + "Interval Run 35" from FS §19, 5→6→8→6→9→5 mph stored as km/h).
- Files: `src/db/seed/data/content.ts` (data), `types.ts`, `ids.ts`, `seed.ts`. It runs at startup after migrations (`DatabaseProvider`).
- **Stable seed ids** (`seed-ex-bench_press`, `seed-tpl-upper_body`, …) instead of random UUIDs, combined with `INSERT OR IGNORE`. Templates have no slug column and users can rename them, so this is what makes re-seeding idempotent and never overwrites edits. The ids are also identical across devices, which helps future sync.
- `seed_version` in `app_settings` (current 1). Re-running at the same version is skipped, and a higher version inserts only missing rows. It all runs in one transaction, and an invalid row rolls everything back.
- Rows are validated through the step 08 mappers before insert.
- **i18n:** new `seed` namespace (EN + FR) with the names of equipment, exercises, measurements, photo categories and templates, keyed by slug. `seedKey(id)` gives the key for a seeded row. The UI shows the translated name while the user hasn't renamed the row (step 13). Exercise instructions are English only for V1.
- Known limitation: a junction row (exercise equipment or alternative) that the user hard-deletes comes back on the next seed-version bump. Repositories use soft delete for user-facing rows, so this only affects mapping edits (step 13 decides how edits are stored).
- Tests: fresh install counts, idempotency (same version and bumped), user rename and availability survive a bump, full rollback on an invalid row, reference integrity, every machine/cable exercise has a dumbbells-only or bodyweight alternative, running totals equal the template duration, targets match tracking type, names exist for every seeded row.
