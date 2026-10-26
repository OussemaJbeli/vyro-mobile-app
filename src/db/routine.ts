/**
 * Applies the owner's routine (docs/plan/pro_plan.md): removes every other workout, syncs the
 * Push / Pull / Legs workouts, starts the completion-based cycle (src/db/cycle.ts) and
 * switches speeds to mph (distance stays km). History is untouched. Guarded by
 * `routine_version`.
 */
import { readCycleState, startCycle } from './cycle';

import { type Database, type Db } from './client';
import { tables, toRow } from './mappers';
import { nowIso } from './repositories/base';
import { profileRepo } from './repositories/profile';
import { routineExercises, routineTemplates } from './seed/data/routine';
import { seedData } from './seed/data/content';
import { seedId } from './seed/ids';

/**
 * v2: fixed Monday–Sunday week, old workouts removed. v3: re-apply (v1/v2 could abort on
 * a started planned session). v4: rules start on this week's Monday, so the whole current
 * week is filled, not only the days from today. v5: the week from docs/plan/weak.md
 * (per-day times, gym right after the run). v6 (1.2.0): Push / Pull / Legs with new runs
 * (docs/after_1_week_using/new_program.md), no six-pack, run before the gym. v7: exercise
 * swaps (lying chest press, incline/decline bench, preacher curl, leaning lateral raise); from
 * v7 the routine workouts are re-synced from the program on every apply. v8 (1.3.0): exercises
 * from docs/plan/pro_plan.md and the completion-based cycle (Push → Pull → Legs → Rest, a missed
 * day repeats) instead of weekly rules; the week starts on Sunday. v9: pro_plan.md starting
 * weights; a program update keeps the current cycle position.
 */
export const ROUTINE_VERSION = 9;

async function optedOut(db: Db): Promise<boolean> {
  const row = await db.get<{ value: string }>(
    "SELECT value FROM app_settings WHERE key = 'routine_opt_out'",
  );
  return row ? JSON.parse(row.value) === true : false;
}

async function customRules(db: Db): Promise<number> {
  const row = await db.get<{ n: number }>(
    'SELECT COUNT(*) AS n FROM schedule_rules WHERE deleted_at IS NULL AND active = 1',
  );
  return row?.n ?? 0;
}

async function plannedAhead(db: Db, today: string): Promise<number> {
  const row = await db.get<{ n: number }>(
    "SELECT COUNT(*) AS n FROM scheduled_sessions WHERE deleted_at IS NULL AND scheduled_date BETWEEN ? AND date(?, '+7 day')",
    [today, today],
  );
  return row?.n ?? 0;
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
  // The user chose their own plan in onboarding: never overwrite it — unless that plan has
  // no active rule and nothing is planned ahead (an empty plan helps nobody).
  if (
    !force &&
    (await optedOut(db)) &&
    ((await customRules(db)) > 0 || (await plannedAhead(db, today)) > 0)
  ) {
    return false;
  }
  // Self-healing: an up-to-date routine is applied again when its cycle is missing or the
  // plan ahead is empty (nothing planned in the next 7 days).
  if (
    !force &&
    (await routineVersion(db)) >= ROUTINE_VERSION &&
    (await readCycleState(db)) &&
    (await plannedAhead(db, today)) > 0
  ) {
    return false;
  }
  // The plan is rewritten from today: past days keep what happened.
  const from = today;
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

    await syncRoutineTemplates(tx, at);

    // Keep where you are in the cycle on a program update; start it only the first time.
    if (force || !(await readCycleState(tx))) await startCycle(tx, today);

    // The week starts on Sunday (the cycle starts there too).
    await profileRepo(tx).upsert({ speedUnit: 'mph', distanceUnit: 'km', weekStartsOn: 0 });
    await tx.run(
      "INSERT INTO app_settings (key, value, updated_at) VALUES ('routine_version', ?, ?) " +
        'ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
      [JSON.stringify(ROUTINE_VERSION), at],
    );
    await tx.run(
      "INSERT INTO app_settings (key, value, updated_at) VALUES ('routine_applied_at', ?, ?) " +
        'ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
      [JSON.stringify(at), at],
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
 * The routine workouts follow the program (seeding never overwrites rows): their header and
 * exercises/intervals are rewritten from the seed. Past sessions keep their own snapshots.
 */
async function syncRoutineTemplates(tx: Db, at: string): Promise<void> {
  const restOf = new Map(
    [...seedData.exercises, ...routineExercises].map((e) => [e.slug, e.defaultRestSeconds]),
  );
  for (const tpl of routineTemplates) {
    const templateId = seedId.template(tpl.key);
    await tx.run(
      'UPDATE workout_templates SET name = ?, description = ?, duration_minutes = ?, difficulty = ?, updated_at = ? WHERE id = ?',
      [tpl.name, tpl.description, tpl.durationMinutes, tpl.difficulty, at, templateId],
    );
    await tx.run('DELETE FROM workout_template_exercises WHERE template_id = ?', [templateId]);
    await tx.run('DELETE FROM template_running_intervals WHERE template_id = ?', [templateId]);
    const base = (id: string) => ({ id, createdAt: at, updatedAt: at, deletedAt: null });
    const insert = async (table: string, row: Record<string, unknown>) => {
      const cols = Object.keys(row);
      await tx.run(
        'INSERT INTO ' +
          table +
          ' (' +
          cols.join(', ') +
          ') VALUES (' +
          cols.map(() => '?').join(', ') +
          ')',
        Object.values(row) as never[],
      );
    };
    for (const [i, item] of (tpl.exercises ?? []).entries()) {
      await insert(
        tables.templateExercises.table,
        toRow(tables.templateExercises, {
          ...base(seedId.templateExercise(tpl.key, i)),
          templateId,
          exerciseId: seedId.exercise(item.exercise),
          orderIndex: i,
          sets: item.sets,
          targetReps: item.targetReps ?? null,
          targetDurationSeconds: item.targetDurationSeconds ?? null,
          targetWeightKg: item.targetWeightKg ?? null,
          restSeconds: item.restSeconds ?? restOf.get(item.exercise) ?? null,
          supersetGroup: null,
          notes: item.notes ?? null,
        }),
      );
    }
    for (const [i, iv] of (tpl.intervals ?? []).entries()) {
      await insert(
        tables.templateIntervals.table,
        toRow(tables.templateIntervals, {
          ...base(seedId.templateInterval(tpl.key, i)),
          templateId,
          orderIndex: i,
          kind: iv.kind,
          durationSeconds: iv.durationSeconds,
          speedKmh: iv.speedKmh,
          inclinePercent: iv.inclinePercent,
          label: iv.label,
        }),
      );
    }
  }
}
