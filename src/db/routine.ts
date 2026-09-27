/**
 * Applies the owner's routine once (docs/default programs): removes every other workout,
 * replaces the plan with the fixed week (docs/plan/weak.md) and switches speeds to
 * mph (distance stays km). History is untouched. Guarded by `routine_version`.
 */
import { weekStart } from '@/domain/scheduling/recurrence';

import { type Database, type Db } from './client';
import { tables } from './mappers';
import { insertModel, nowIso } from './repositories/base';
import { profileRepo } from './repositories/profile';
import { GYM_REPS, GYM_SETS, routineTemplates, routineWeek } from './seed/data/routine';
import { seedId } from './seed/ids';

/**
 * v2: fixed Monday–Sunday week, old workouts removed. v3: re-apply (v1/v2 could abort on
 * a started planned session). v4: rules start on this week's Monday, so the whole current
 * week is filled, not only the days from today. v5: the week from docs/plan/weak.md
 * (per-day times, gym right after the run).
 */
export const ROUTINE_VERSION = 5;

/** Active rules left: 0 means the plan is empty and the routine must come back. */
async function activeRules(db: Db): Promise<number> {
  const row = await db.get<{ n: number }>(
    'SELECT COUNT(*) AS n FROM schedule_rules WHERE deleted_at IS NULL AND active = 1',
  );
  return row?.n ?? 0;
}

async function optedOut(db: Db): Promise<boolean> {
  const row = await db.get<{ value: string }>(
    "SELECT value FROM app_settings WHERE key = 'routine_opt_out'",
  );
  return row ? JSON.parse(row.value) === true : false;
}

async function routineVersion(db: Db): Promise<number> {
  const row = await db.get<{ value: string }>(
    "SELECT value FROM app_settings WHERE key = 'routine_version'",
  );
  return row ? Number(JSON.parse(row.value)) || 0 : 0;
}

export async function applyRoutine(
  db: Database,
  { today, force = false }: { today: string; force?: boolean },
): Promise<boolean> {
  // The user chose their own plan (or none) in onboarding: never overwrite it.
  if (!force && (await optedOut(db))) return false;
  // Self-healing: an up-to-date routine with no active rule (plan emptied) is re-applied.
  if (!force && (await routineVersion(db)) >= ROUTINE_VERSION && (await activeRules(db)) > 0) {
    return false;
  }
  const from = weekStart(today, 1);
  const byKey = new Map(routineTemplates.map((t) => [t.key, t]));
  const keep = routineTemplates.map((t) => seedId.template(t.key));

  await db.tx(async (tx) => {
    const at = nowIso();
    // Clean view: only the routine exists (other workouts are removed; history keeps its
    // frozen snapshots).
    const ids = keep.map(() => '?').join(', ');
    await tx.run(
      'UPDATE workout_templates SET deleted_at = ?, updated_at = ? ' +
        'WHERE deleted_at IS NULL AND id NOT IN (' +
        ids +
        ')',
      [at, at, ...keep],
    );
    await tx.run(
      'UPDATE workout_templates SET archived_at = NULL, updated_at = ? WHERE id IN (' + ids + ')',
      [at, ...keep],
    );
    // Replace the plan: old rules go, untouched future plan goes (done/skipped stay).
    await tx.run(
      'UPDATE schedule_rules SET deleted_at = ?, updated_at = ? WHERE deleted_at IS NULL',
      [at, at],
    );
    // A planned session that was started once (then discarded) is referenced by its
    // execution: hide it instead of deleting it, or the foreign key aborts everything.
    await tx.run(
      'UPDATE scheduled_sessions SET deleted_at = ?, updated_at = ? ' +
        "WHERE status = 'planned' AND scheduled_date >= ? AND deleted_at IS NULL " +
        'AND id IN (SELECT scheduled_session_id FROM session_executions WHERE scheduled_session_id IS NOT NULL)',
      [at, at, from],
    );
    await tx.run(
      "DELETE FROM scheduled_sessions WHERE status = 'planned' AND scheduled_date >= ? " +
        'AND id NOT IN (SELECT scheduled_session_id FROM session_executions WHERE scheduled_session_id IS NOT NULL)',
      [from],
    );

    for (const { key, days, time } of routineWeek) {
      const tpl = key ? byKey.get(key) : undefined;
      await insertModel(tx, tables.scheduleRules, {
        templateId: key ? seedId.template(key) : null,
        title: tpl?.name ?? 'Rest',
        type: tpl?.type ?? 'rest',
        freq: 'weekly',
        interval: 1,
        byWeekday: days,
        byMonthDay: null,
        startDate: from,
        endDate: null,
        startTime: time,
        durationMinutes: tpl?.durationMinutes ?? null,
        reminderOffsetMinutes: tpl ? 15 : null,
        active: true,
        materializedUntil: null,
      });
    }

    await profileRepo(tx).upsert({ speedUnit: 'mph', distanceUnit: 'km' });
    await tx.run(
      "INSERT INTO app_settings (key, value, updated_at) VALUES ('routine_version', ?, ?) " +
        'ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
      [JSON.stringify(ROUTINE_VERSION), at],
    );
    await tx.run(
      "INSERT INTO app_settings (key, value, updated_at) VALUES ('routine_opt_out', 'false', ?) " +
        'ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
      [at],
    );
  });
  return true;
}

/**
 * Seeded sample workouts that are not part of the routine (Upper Body, Leg Day, Push…):
 * removed on every start, so a fresh install or a re-seed never brings them back. Your
 * own workouts, and seeded ones a plan still uses (custom days), are kept.
 */
export async function pruneSampleWorkouts(db: Database): Promise<number> {
  const keep = routineTemplates.map((t) => seedId.template(t.key));
  const at = nowIso();
  const r = await db.run(
    'UPDATE workout_templates SET deleted_at = ?, updated_at = ? ' +
      'WHERE is_seed = 1 AND deleted_at IS NULL AND id NOT IN (' +
      keep.map(() => '?').join(', ') +
      ') AND id NOT IN (SELECT template_id FROM schedule_rules WHERE deleted_at IS NULL AND active = 1 AND template_id IS NOT NULL)',
    [at, at, ...keep],
  );
  return r.changes;
}

/**
 * One-time (1.1.0): gym routine workouts already saved on the phone move to 3 × 15, the
 * new seed values. Later edits by the user are kept (guarded by `gym_reps_v1`).
 */
export async function applyGymRepsStandard(db: Database): Promise<boolean> {
  const done = await db.get<{ value: string }>(
    "SELECT value FROM app_settings WHERE key = 'gym_reps_v1'",
  );
  if (done) return false;
  const gym = routineTemplates.filter((t) => t.type === 'gym').map((t) => seedId.template(t.key));
  const at = nowIso();
  await db.tx(async (tx) => {
    await tx.run(
      'UPDATE workout_template_exercises SET sets = ?, target_reps = ?, updated_at = ? ' +
        'WHERE template_id IN (' +
        gym.map(() => '?').join(', ') +
        ') AND target_reps IS NOT NULL',
      [GYM_SETS, GYM_REPS, at, ...gym],
    );
    await tx.run(
      "INSERT INTO app_settings (key, value, updated_at) VALUES ('gym_reps_v1', 'true', ?)",
      [at],
    );
  });
  return true;
}
