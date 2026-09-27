# 08 — Domain Schema, Models & Validation

| | |
|---|---|
| Milestone | M0 Foundation |
| Depends on | 07 |
| Spec refs | FS §7–§29, §61, §65, §72 · UI §19–§26 · AD-04 → AD-09, AD-13, AD-17 |
| Output | Migration `m001_initial` with the full V1 schema, Zod schemas, and TypeScript domain types |

## Objective

Define the whole V1 data model up front, so features build on a stable, indexed, sync-ready schema. This is the most important design step. Review it carefully before moving on.

## Conventions (all tables)

```sql
id          TEXT PRIMARY KEY,          -- UUID v4
created_at  TEXT NOT NULL,             -- ISO UTC
updated_at  TEXT NOT NULL,             -- ISO UTC
deleted_at  TEXT                       -- soft delete; NULL = active
```

Booleans are `INTEGER 0/1`. Arrays and objects are `TEXT` JSON, validated by Zod on read. Enums are `TEXT` with a `CHECK` constraint.

## Entity map

```text
user_profile ─┬─ goals
              └─ app_settings (key/value)

equipment ──< exercise_equipment >── exercises ──< exercise_alternatives >── exercises

workout_templates ─┬─< workout_template_exercises >── exercises
                   └─< template_running_intervals

schedule_rules ──< scheduled_sessions >── workout_templates
                          │
                          └──< session_executions ─┬─< session_exercises ──< exercise_sets
                                                   └─< running_interval_logs

measurement_types ──< body_measurements
weight_entries
photo_categories ──< progress_photos
notification_schedules
```

## DDL (m001_initial)

```sql
CREATE TABLE user_profile (
  id TEXT PRIMARY KEY, name TEXT, height_cm REAL, date_of_birth TEXT,
  weight_unit TEXT NOT NULL DEFAULT 'kg' CHECK (weight_unit IN ('kg','lb')),
  length_unit TEXT NOT NULL DEFAULT 'cm' CHECK (length_unit IN ('cm','in')),
  distance_unit TEXT NOT NULL DEFAULT 'km' CHECK (distance_unit IN ('km','mi')),
  speed_unit TEXT NOT NULL DEFAULT 'kmh' CHECK (speed_unit IN ('kmh','mph')),
  week_starts_on INTEGER NOT NULL DEFAULT 1,           -- 0=Sun, 1=Mon
  onboarding_completed_at TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
);

CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);

CREATE TABLE goals (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('weight','measurement','consistency','running','frequency','muscle','custom')),
  title TEXT NOT NULL, target_value REAL, unit TEXT, start_value REAL,
  measurement_type_id TEXT REFERENCES measurement_types(id),
  start_date TEXT NOT NULL, target_date TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','achieved','abandoned')),
  achieved_at TEXT, notes TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
);

CREATE TABLE equipment (
  id TEXT PRIMARY KEY, slug TEXT UNIQUE, name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('free_weights','machines','cardio','bodyweight','accessories','other')),
  available INTEGER NOT NULL DEFAULT 1, is_custom INTEGER NOT NULL DEFAULT 0, notes TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
);

CREATE TABLE exercises (
  id TEXT PRIMARY KEY, slug TEXT UNIQUE, name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('chest','back','shoulders','arms','legs','core','full_body','cardio','mobility')),
  primary_muscle TEXT NOT NULL, secondary_muscles TEXT NOT NULL DEFAULT '[]',
  tracking TEXT NOT NULL CHECK (tracking IN ('weight_reps','reps','duration','distance_duration')),
  instructions TEXT, default_sets INTEGER, default_reps INTEGER,
  default_duration_seconds INTEGER, default_rest_seconds INTEGER,
  difficulty TEXT CHECK (difficulty IN ('beginner','intermediate','advanced')),
  is_custom INTEGER NOT NULL DEFAULT 0, archived_at TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
);

CREATE TABLE exercise_equipment (            -- ALL listed equipment is required; no rows = bodyweight
  exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  equipment_id TEXT NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  PRIMARY KEY (exercise_id, equipment_id)
);

CREATE TABLE exercise_alternatives (         -- directional; priority 1 = best
  exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  alternative_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  priority INTEGER NOT NULL DEFAULT 1, note TEXT,
  PRIMARY KEY (exercise_id, alternative_id), CHECK (exercise_id <> alternative_id)
);

CREATE TABLE workout_templates (
  id TEXT PRIMARY KEY, name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('gym','running','home','abs','recovery','other')),
  description TEXT, duration_minutes INTEGER, difficulty TEXT, cover_key TEXT,
  distance_target_km REAL,                    -- running only (AD-08)
  is_seed INTEGER NOT NULL DEFAULT 0, archived_at TEXT, notes TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
);

CREATE TABLE workout_template_exercises (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL REFERENCES exercises(id),
  order_index INTEGER NOT NULL, sets INTEGER NOT NULL DEFAULT 3,
  target_reps INTEGER, target_duration_seconds INTEGER, target_weight_kg REAL,
  rest_seconds INTEGER, superset_group TEXT, notes TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
);

CREATE TABLE template_running_intervals (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('warmup','run','walk','sprint','recovery','cooldown')),
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds > 0),
  speed_kmh REAL, incline_percent REAL, label TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
);

CREATE TABLE schedule_rules (
  id TEXT PRIMARY KEY, template_id TEXT REFERENCES workout_templates(id),
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('gym','running','home','abs','recovery','rest','other')),
  freq TEXT NOT NULL CHECK (freq IN ('daily','weekly','monthly','custom')),
  interval INTEGER NOT NULL DEFAULT 1,        -- every N days/weeks/months
  by_weekday TEXT,                            -- JSON [1,3,5] (ISO: 1=Mon..7=Sun)
  by_month_day INTEGER,
  start_date TEXT NOT NULL, end_date TEXT, start_time TEXT, duration_minutes INTEGER,
  reminder_offset_minutes INTEGER, active INTEGER NOT NULL DEFAULT 1,
  materialized_until TEXT,                    -- last LocalDate generated
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
);

CREATE TABLE scheduled_sessions (
  id TEXT PRIMARY KEY,
  rule_id TEXT REFERENCES schedule_rules(id),
  template_id TEXT REFERENCES workout_templates(id),
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('gym','running','home','abs','recovery','rest','other')),
  scheduled_date TEXT NOT NULL, start_time TEXT, end_time TEXT, duration_minutes INTEGER,
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned','in_progress','completed','modified','skipped','cancelled')),
  original_date TEXT NOT NULL,                -- first planned date (never changes)
  original_start_time TEXT,
  reschedule_count INTEGER NOT NULL DEFAULT 0,
  is_exception INTEGER NOT NULL DEFAULT 0,    -- edited occurrence of a rule
  order_in_day INTEGER NOT NULL DEFAULT 0,
  reminder_offset_minutes INTEGER, skip_reason TEXT, notes TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT,
  UNIQUE (rule_id, original_date)             -- idempotent materialization
);

CREATE TABLE session_executions (
  id TEXT PRIMARY KEY,
  scheduled_session_id TEXT REFERENCES scheduled_sessions(id),   -- NULL = ad-hoc / quick start
  template_id TEXT REFERENCES workout_templates(id),
  type TEXT NOT NULL, title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('in_progress','completed','abandoned')),
  outcome TEXT CHECK (outcome IN ('as_planned','modified','partial')),
  started_at TEXT NOT NULL, ended_at TEXT,
  active_seconds INTEGER, paused_seconds INTEGER,
  planned_snapshot TEXT NOT NULL,             -- JSON: full plan at start (AD-07)
  runtime_state TEXT,                         -- JSON: resume pointer + timers (AD-10)
  is_retroactive INTEGER NOT NULL DEFAULT 0,  -- logged after the fact
  perceived_effort INTEGER CHECK (perceived_effort BETWEEN 1 AND 10),
  distance_km REAL, notes TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
);

CREATE TABLE session_exercises (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL REFERENCES session_executions(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL REFERENCES exercises(id),
  planned_exercise_id TEXT REFERENCES exercises(id),   -- differs when substituted
  order_index INTEGER NOT NULL,
  planned_sets INTEGER, planned_reps INTEGER, planned_duration_seconds INTEGER,
  planned_weight_kg REAL, planned_rest_seconds INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','done','skipped')),
  substitution_reason TEXT, notes TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
);

CREATE TABLE exercise_sets (
  id TEXT PRIMARY KEY,
  session_exercise_id TEXT NOT NULL REFERENCES session_exercises(id) ON DELETE CASCADE,
  set_index INTEGER NOT NULL,
  planned_reps INTEGER, planned_weight_kg REAL, planned_duration_seconds INTEGER,
  actual_reps INTEGER, actual_weight_kg REAL, actual_duration_seconds INTEGER,
  rest_taken_seconds INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','skipped')),
  is_extra INTEGER NOT NULL DEFAULT 0,        -- set added beyond plan
  completed_at TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
);

CREATE TABLE running_interval_logs (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL REFERENCES session_executions(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL, kind TEXT NOT NULL, label TEXT,
  planned_duration_seconds INTEGER, planned_speed_kmh REAL, planned_incline_percent REAL,
  actual_duration_seconds INTEGER, actual_speed_kmh REAL, actual_incline_percent REAL,
  status TEXT NOT NULL CHECK (status IN ('pending','done','partial','skipped')),
  is_repeat INTEGER NOT NULL DEFAULT 0, started_at TEXT, ended_at TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
);

CREATE TABLE weight_entries (
  id TEXT PRIMARY KEY, value_kg REAL NOT NULL CHECK (value_kg > 0 AND value_kg < 500),
  unit_entered TEXT NOT NULL, recorded_at TEXT NOT NULL, notes TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
);

CREATE TABLE measurement_types (
  id TEXT PRIMARY KEY, slug TEXT UNIQUE, name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('length','percent','other')),
  unit_other TEXT, order_index INTEGER NOT NULL DEFAULT 0,
  is_custom INTEGER NOT NULL DEFAULT 0, archived_at TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
);

CREATE TABLE body_measurements (
  id TEXT PRIMARY KEY,
  measurement_type_id TEXT NOT NULL REFERENCES measurement_types(id),
  value REAL NOT NULL,                         -- canonical: cm for length, % for percent
  unit_entered TEXT NOT NULL, recorded_at TEXT NOT NULL, notes TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
);

CREATE TABLE photo_categories (
  slug TEXT PRIMARY KEY,                       -- 'body', 'body.front', 'hair.top', 'beard.left'
  parent_slug TEXT REFERENCES photo_categories(slug), order_index INTEGER NOT NULL
);

CREATE TABLE progress_photos (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL REFERENCES photo_categories(slug),
  sub_category TEXT REFERENCES photo_categories(slug),
  file_path TEXT NOT NULL,                     -- RELATIVE to private root (AD-13)
  thumb_path TEXT NOT NULL, width INTEGER, height INTEGER, bytes INTEGER,
  captured_at TEXT NOT NULL, weight_entry_id TEXT REFERENCES weight_entries(id), notes TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
);

CREATE TABLE notification_schedules (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('session','weight','measurement','photo','weekly_summary','rest_timer')),
  target_id TEXT, os_notification_id TEXT NOT NULL, fire_at TEXT NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
);
```

### Indexes

```sql
CREATE INDEX idx_sessions_date        ON scheduled_sessions(scheduled_date, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_sessions_rule        ON scheduled_sessions(rule_id);
CREATE INDEX idx_exec_started         ON session_executions(started_at);
CREATE INDEX idx_exec_status          ON session_executions(status);
CREATE INDEX idx_exec_session         ON session_executions(scheduled_session_id);
CREATE INDEX idx_sessex_exec          ON session_exercises(execution_id, order_index);
CREATE INDEX idx_sets_sessex          ON exercise_sets(session_exercise_id, set_index);
CREATE INDEX idx_sets_exercise_pr     ON session_exercises(exercise_id);
CREATE INDEX idx_runlogs_exec         ON running_interval_logs(execution_id, order_index);
CREATE INDEX idx_weight_recorded      ON weight_entries(recorded_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_measure_type_date    ON body_measurements(measurement_type_id, recorded_at);
CREATE INDEX idx_photos_cat_date      ON progress_photos(category, sub_category, captured_at);
CREATE INDEX idx_tpl_ex_template      ON workout_template_exercises(template_id, order_index);
CREATE INDEX idx_tpl_run_template     ON template_running_intervals(template_id, order_index);
CREATE INDEX idx_exercises_category   ON exercises(category) WHERE deleted_at IS NULL;
```

### Invariants (enforced in repositories and tested)

1. Only **one** `session_executions` row with `status='in_progress'` exists at a time.
2. A `scheduled_sessions` row of `type='rest'` never gets an execution.
3. Completing an execution sets the linked scheduled session to `completed` (outcome `as_planned`) or `modified` (outcome `modified` or `partial`). The planned date, time and snapshot stay untouched.
4. Rescheduling changes `scheduled_date`/`start_time`, increments `reschedule_count`, and keeps `original_date`.
5. Deleting a template **archives** it if any execution references it. History must still render from `planned_snapshot` even if the template is later edited.

## Tasks

- [x] Write `m001_initial.ts` with the DDL and indexes above (tables in dependency order).
- [x] `src/types/domain.ts`: TypeScript types for every entity (camelCase), with enums as string-literal unions.
- [x] `src/db/schemas/*.ts`: Zod schemas for **row → model** (parse JSON columns, coerce booleans) and **input** schemas for create/update (reused by React Hook Form).
- [x] `PlannedSnapshot` Zod schema: template id, name, type and exercises[], or intervals[] with all targets, plus `schemaVersion: 1`.
- [x] `RuntimeState` Zod schema (the engine defines it fully in step 17; a placeholder with `schemaVersion` now).
- [x] Mapper tests: every row type round-trips row → model → row.
- [x] Put an ER diagram (Mermaid) in `src/db/SCHEMA.md` and keep it updated with every migration.

## Acceptance criteria

- [x] A fresh install creates every table and index. `PRAGMA foreign_key_check` returns nothing.
- [x] Zod rejects invalid enums, negative durations and malformed JSON with a `VALIDATION` AppError.
- [x] `SCHEMA.md` matches the DDL.

## Pitfalls

- SQLite `CHECK` constraints on existing tables cannot be changed without a table rebuild. Choose enums carefully now.
- SQLite accepts a foreign key that points to a table created later in the same migration, because FKs are checked on insert. Still, create tables in dependency order (move `measurement_types` above `goals`) so the DDL reads top-down.

## Execution log (2026-09-25)

- `m001_initial` holds 37 statements (22 tables + 15 indexes), generated from the DDL above. `measurement_types` is moved above `goals` so the DDL reads in dependency order. m001 is unreleased, so its lock entry was regenerated.
- **Where things live (small deviation):** Zod model schemas and types are in `src/types/domain.ts` (enums in `src/types/enums.ts`), not `src/db/schemas`. That way `src/domain` and the forms can use them without importing the db layer, which lint forbids. Row mapping is in `src/db/mappers.ts`.
- **Mappers:** a registry of 21 tables (`app_settings` is key/value, handled by the settings repository in step 10). `fromRow` converts snake_case → camelCase, 0/1 → boolean and JSON text → objects, then validates with Zod. `toRow` does the reverse (full or `partial`). Any failure is `AppError('VALIDATION')`.
- `inputSchemas(schema)` derives create inputs (without id/timestamps/deleted_at) and partial update inputs, for repositories and React Hook Form.
- `plannedSnapshotSchema` (schemaVersion 1, exercises[] and intervals[] with all targets) is final. `runtimeStateSchema` is a loose placeholder (`schemaVersion: 1`) that the step 17 engine completes.
- Photo `file_path` / `thumb_path` must be relative (validated).
- **Tests** (`src/db/__tests__/schema.test.ts`): every table and index exists; `foreign_key_check` is empty; **each model's fields equal its SQL columns** (catches DDL/type drift); every table round-trips model → SQL → model; plus invalid enum, negative duration, absolute path, malformed JSON, SQL CHECK and `UNIQUE(rule_id, original_date)` cases.
- ER diagram (Mermaid) and invariants are in `src/db/SCHEMA.md`. Invariants 1–5 are enforced by the repositories in step 10.
