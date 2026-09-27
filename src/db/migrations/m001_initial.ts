import { type Migration } from './types';

/**
 * Full V1 schema (roadmap step 08). See src/db/SCHEMA.md for the entity map and invariants.
 * Conventions: TEXT UUID ids, ISO UTC created_at/updated_at, soft delete via deleted_at,
 * booleans as INTEGER 0/1, JSON as TEXT, enums as TEXT + CHECK.
 */
export const m001_initial: Migration = {
  id: 1,
  name: 'initial',
  statements: [
    `
      CREATE TABLE user_profile (
        id TEXT PRIMARY KEY, name TEXT, height_cm REAL, date_of_birth TEXT,
        weight_unit TEXT NOT NULL DEFAULT 'kg' CHECK (weight_unit IN ('kg','lb')),
        length_unit TEXT NOT NULL DEFAULT 'cm' CHECK (length_unit IN ('cm','in')),
        distance_unit TEXT NOT NULL DEFAULT 'km' CHECK (distance_unit IN ('km','mi')),
        speed_unit TEXT NOT NULL DEFAULT 'kmh' CHECK (speed_unit IN ('kmh','mph')),
        week_starts_on INTEGER NOT NULL DEFAULT 1,           -- 0=Sun, 1=Mon
        onboarding_completed_at TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
      )
    `,
    `
      CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)
    `,
    `
      CREATE TABLE measurement_types (
        id TEXT PRIMARY KEY, slug TEXT UNIQUE, name TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('length','percent','other')),
        unit_other TEXT, order_index INTEGER NOT NULL DEFAULT 0,
        is_custom INTEGER NOT NULL DEFAULT 0, archived_at TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
      )
    `,
    `
      CREATE TABLE goals (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL CHECK (type IN ('weight','measurement','consistency','running','frequency','muscle','custom')),
        title TEXT NOT NULL, target_value REAL, unit TEXT, start_value REAL,
        measurement_type_id TEXT REFERENCES measurement_types(id),
        start_date TEXT NOT NULL, target_date TEXT,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','achieved','abandoned')),
        achieved_at TEXT, notes TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
      )
    `,
    `
      CREATE TABLE equipment (
        id TEXT PRIMARY KEY, slug TEXT UNIQUE, name TEXT NOT NULL,
        category TEXT NOT NULL CHECK (category IN ('free_weights','machines','cardio','bodyweight','accessories','other')),
        available INTEGER NOT NULL DEFAULT 1, is_custom INTEGER NOT NULL DEFAULT 0, notes TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
      )
    `,
    `
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
      )
    `,
    `
      CREATE TABLE exercise_equipment (            -- ALL listed equipment is required; no rows = bodyweight
        exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
        equipment_id TEXT NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
        PRIMARY KEY (exercise_id, equipment_id)
      )
    `,
    `
      CREATE TABLE exercise_alternatives (         -- directional; priority 1 = best
        exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
        alternative_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
        priority INTEGER NOT NULL DEFAULT 1, note TEXT,
        PRIMARY KEY (exercise_id, alternative_id), CHECK (exercise_id <> alternative_id)
      )
    `,
    `
      CREATE TABLE workout_templates (
        id TEXT PRIMARY KEY, name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('gym','running','home','abs','recovery','other')),
        description TEXT, duration_minutes INTEGER, difficulty TEXT, cover_key TEXT,
        distance_target_km REAL,                    -- running only (AD-08)
        is_seed INTEGER NOT NULL DEFAULT 0, archived_at TEXT, notes TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
      )
    `,
    `
      CREATE TABLE workout_template_exercises (
        id TEXT PRIMARY KEY,
        template_id TEXT NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
        exercise_id TEXT NOT NULL REFERENCES exercises(id),
        order_index INTEGER NOT NULL, sets INTEGER NOT NULL DEFAULT 3,
        target_reps INTEGER, target_duration_seconds INTEGER, target_weight_kg REAL,
        rest_seconds INTEGER, superset_group TEXT, notes TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
      )
    `,
    `
      CREATE TABLE template_running_intervals (
        id TEXT PRIMARY KEY,
        template_id TEXT NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
        order_index INTEGER NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('warmup','run','walk','sprint','recovery','cooldown')),
        duration_seconds INTEGER NOT NULL CHECK (duration_seconds > 0),
        speed_kmh REAL, incline_percent REAL, label TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
      )
    `,
    `
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
      )
    `,
    `
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
      )
    `,
    `
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
      )
    `,
    `
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
      )
    `,
    `
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
      )
    `,
    `
      CREATE TABLE running_interval_logs (
        id TEXT PRIMARY KEY,
        execution_id TEXT NOT NULL REFERENCES session_executions(id) ON DELETE CASCADE,
        order_index INTEGER NOT NULL, kind TEXT NOT NULL, label TEXT,
        planned_duration_seconds INTEGER, planned_speed_kmh REAL, planned_incline_percent REAL,
        actual_duration_seconds INTEGER, actual_speed_kmh REAL, actual_incline_percent REAL,
        status TEXT NOT NULL CHECK (status IN ('pending','done','partial','skipped')),
        is_repeat INTEGER NOT NULL DEFAULT 0, started_at TEXT, ended_at TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
      )
    `,
    `
      CREATE TABLE weight_entries (
        id TEXT PRIMARY KEY, value_kg REAL NOT NULL CHECK (value_kg > 0 AND value_kg < 500),
        unit_entered TEXT NOT NULL, recorded_at TEXT NOT NULL, notes TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
      )
    `,
    `
      CREATE TABLE body_measurements (
        id TEXT PRIMARY KEY,
        measurement_type_id TEXT NOT NULL REFERENCES measurement_types(id),
        value REAL NOT NULL,                         -- canonical: cm for length, % for percent
        unit_entered TEXT NOT NULL, recorded_at TEXT NOT NULL, notes TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
      )
    `,
    `
      CREATE TABLE photo_categories (
        slug TEXT PRIMARY KEY,                       -- 'body', 'body.front', 'hair.top', 'beard.left'
        parent_slug TEXT REFERENCES photo_categories(slug), order_index INTEGER NOT NULL
      )
    `,
    `
      CREATE TABLE progress_photos (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL REFERENCES photo_categories(slug),
        sub_category TEXT REFERENCES photo_categories(slug),
        file_path TEXT NOT NULL,                     -- RELATIVE to private root (AD-13)
        thumb_path TEXT NOT NULL, width INTEGER, height INTEGER, bytes INTEGER,
        captured_at TEXT NOT NULL, weight_entry_id TEXT REFERENCES weight_entries(id), notes TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
      )
    `,
    `
      CREATE TABLE notification_schedules (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL CHECK (kind IN ('session','weight','measurement','photo','weekly_summary','rest_timer')),
        target_id TEXT, os_notification_id TEXT NOT NULL, fire_at TEXT NOT NULL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
      )
    `,
    `
      CREATE INDEX idx_sessions_date        ON scheduled_sessions(scheduled_date, status) WHERE deleted_at IS NULL
    `,
    `
      CREATE INDEX idx_sessions_rule        ON scheduled_sessions(rule_id)
    `,
    `
      CREATE INDEX idx_exec_started         ON session_executions(started_at)
    `,
    `
      CREATE INDEX idx_exec_status          ON session_executions(status)
    `,
    `
      CREATE INDEX idx_exec_session         ON session_executions(scheduled_session_id)
    `,
    `
      CREATE INDEX idx_sessex_exec          ON session_exercises(execution_id, order_index)
    `,
    `
      CREATE INDEX idx_sets_sessex          ON exercise_sets(session_exercise_id, set_index)
    `,
    `
      CREATE INDEX idx_sets_exercise_pr     ON session_exercises(exercise_id)
    `,
    `
      CREATE INDEX idx_runlogs_exec         ON running_interval_logs(execution_id, order_index)
    `,
    `
      CREATE INDEX idx_weight_recorded      ON weight_entries(recorded_at) WHERE deleted_at IS NULL
    `,
    `
      CREATE INDEX idx_measure_type_date    ON body_measurements(measurement_type_id, recorded_at)
    `,
    `
      CREATE INDEX idx_photos_cat_date      ON progress_photos(category, sub_category, captured_at)
    `,
    `
      CREATE INDEX idx_tpl_ex_template      ON workout_template_exercises(template_id, order_index)
    `,
    `
      CREATE INDEX idx_tpl_run_template     ON template_running_intervals(template_id, order_index)
    `,
    `
      CREATE INDEX idx_exercises_category   ON exercises(category) WHERE deleted_at IS NULL
    `,
  ],
};
