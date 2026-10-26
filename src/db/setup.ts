/**
 * Setup file export/import (1.4.0, format in src/services/setup/format.ts). Import writes
 * live data only — profile, goals, equipment, custom exercises, workouts and the cycle days —
 * in one transaction. Past sessions, executions, weigh-in history and statistics are never
 * edited (a changed current weight is logged as a new weigh-in).
 */
import { type CyclePlan } from '@/domain/scheduling/cycle';
import { SETUP_FORMAT, SETUP_VERSION, type SetupFile } from '@/services/setup/format';
import { newId } from '@/utils/id';

import { type Database, type Db } from './client';
import { readCyclePlan, saveCyclePlan } from './cycle';
import { tables } from './mappers';
import { insertModel, nowIso, patchModel } from './repositories/base';
import { profileRepo } from './repositories/profile';
import { seedId, seedKey } from './seed/ids';

const MPH = 1.609344;
const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
/** Built-in rows export their stable key, your own rows their id. */
const keyOf = (id: string, slug?: string | null) => slug ?? seedKey(id) ?? id;

export async function exportSetup(db: Db): Promise<SetupFile> {
  const profile = await profileRepo(db).get();
  const mph = profile?.speedUnit === 'mph';
  const weight = await db.get<{ value_kg: number }>(
    'SELECT value_kg FROM weight_entries WHERE deleted_at IS NULL ORDER BY recorded_at DESC LIMIT 1',
  );
  const goals = await db.all<{
    type: string;
    title: string;
    target_value: number | null;
    unit: string | null;
    target_date: string | null;
  }>(
    "SELECT type, title, target_value, unit, target_date FROM goals WHERE deleted_at IS NULL AND status = 'active' ORDER BY created_at",
  );
  const equipment = await db.all<{
    id: string;
    slug: string | null;
    name: string;
    category: string;
    available: number;
  }>(
    'SELECT id, slug, name, category, available FROM equipment WHERE deleted_at IS NULL ORDER BY name',
  );
  const eqKey = new Map(equipment.map((e) => [e.id, keyOf(e.id, e.slug)]));
  const allExercises = await db.all<{ id: string; slug: string | null }>(
    'SELECT id, slug FROM exercises WHERE deleted_at IS NULL',
  );
  const exKey = new Map(allExercises.map((e) => [e.id, keyOf(e.id, e.slug)]));
  const custom = await db.all<{
    id: string;
    name: string;
    category: string;
    primary_muscle: string;
    secondary_muscles: string;
    tracking: string;
    default_sets: number | null;
    default_reps: number | null;
    default_duration_seconds: number | null;
    default_rest_seconds: number | null;
    difficulty: string | null;
    instructions: string | null;
  }>('SELECT * FROM exercises WHERE deleted_at IS NULL AND is_custom = 1 ORDER BY name');
  const links = await db.all<{ exercise_id: string; equipment_id: string }>(
    'SELECT exercise_id, equipment_id FROM exercise_equipment',
  );
  const templates = await db.all<{
    id: string;
    name: string;
    type: string;
    description: string | null;
    duration_minutes: number | null;
  }>(
    'SELECT id, name, type, description, duration_minutes FROM workout_templates WHERE deleted_at IS NULL AND archived_at IS NULL ORDER BY name',
  );
  const tplKey = new Map(templates.map((t) => [t.id, keyOf(t.id)]));
  const items = await db.all<{
    template_id: string;
    exercise_id: string;
    sets: number;
    target_reps: number | null;
    target_weight_kg: number | null;
    target_duration_seconds: number | null;
    rest_seconds: number | null;
    notes: string | null;
  }>('SELECT * FROM workout_template_exercises WHERE deleted_at IS NULL ORDER BY order_index');
  const intervals = await db.all<{
    template_id: string;
    kind: string;
    duration_seconds: number;
    speed_kmh: number | null;
    incline_percent: number | null;
    label: string | null;
  }>('SELECT * FROM template_running_intervals WHERE deleted_at IS NULL ORDER BY order_index');
  const plan = await readCyclePlan(db);

  return {
    format: SETUP_FORMAT,
    version: SETUP_VERSION,
    exportedAt: nowIso(),
    profile: {
      name: profile?.name ?? null,
      heightCm: profile?.heightCm ?? null,
      dateOfBirth: profile?.dateOfBirth ?? null,
      units: {
        weight: profile?.weightUnit ?? 'kg',
        length: profile?.lengthUnit ?? 'cm',
        distance: profile?.distanceUnit ?? 'km',
        speed: profile?.speedUnit ?? 'kmh',
      },
      weekStartsOn: profile?.weekStartsOn === 0 ? 0 : 1,
    },
    body: {
      weightKg: weight?.value_kg ?? null,
      goals: goals.map((g) => ({
        type: g.type as never,
        title: g.title,
        targetValue: g.target_value,
        unit: g.unit,
        targetDate: g.target_date,
      })),
    },
    equipment: equipment.map((e) => ({
      key: keyOf(e.id, e.slug),
      name: e.name,
      category: e.category as never,
      available: e.available === 1,
    })),
    exercises: custom.map((x) => ({
      key: x.id,
      name: x.name,
      category: x.category as never,
      primaryMuscle: x.primary_muscle,
      secondaryMuscles: JSON.parse(x.secondary_muscles || '[]') as string[],
      tracking: x.tracking as never,
      equipment: links
        .filter((l) => l.exercise_id === x.id)
        .map((l) => eqKey.get(l.equipment_id) ?? l.equipment_id),
      defaultSets: x.default_sets,
      defaultReps: x.default_reps,
      defaultDurationSeconds: x.default_duration_seconds,
      defaultRestSeconds: x.default_rest_seconds,
      difficulty: x.difficulty as never,
      instructions: (x.instructions ?? '').split('\n').filter(Boolean),
    })),
    workouts: templates.map((t) => ({
      key: tplKey.get(t.id)!,
      name: t.name,
      type: t.type as never,
      description: t.description,
      durationMinutes: t.duration_minutes,
      exercises: items
        .filter((i) => i.template_id === t.id)
        .map((i) => ({
          exercise: exKey.get(i.exercise_id) ?? i.exercise_id,
          sets: i.sets,
          reps: i.target_reps,
          weightKg: i.target_weight_kg,
          durationSeconds: i.target_duration_seconds,
          restSeconds: i.rest_seconds,
          notes: i.notes,
        })),
      intervals: intervals
        .filter((i) => i.template_id === t.id)
        .map((i) => ({
          kind: i.kind as never,
          seconds: i.duration_seconds,
          ...(i.speed_kmh === null
            ? {}
            : mph
              ? { speedMph: round(i.speed_kmh / MPH) }
              : { speedKmh: round(i.speed_kmh) }),
          inclinePercent: i.incline_percent,
          label: i.label,
        })),
    })),
    cycle: {
      days: plan.groups.map((g) => ({
        key: g.id,
        name: g.name,
        run: g.runTemplateId ? (tplKey.get(g.runTemplateId) ?? keyOf(g.runTemplateId)) : null,
        gym: g.gymTemplateId ? (tplKey.get(g.gymTemplateId) ?? keyOf(g.gymTemplateId)) : null,
      })),
    },
  };
}

export type SetupImportResult = {
  equipment: number;
  exercises: number;
  workouts: number;
  goals: number;
  weightLogged: boolean;
  cycleDays: number;
};

/** Resolves a key to an existing row id: built-in key (seed id or slug) first, then the id. */
async function resolve(
  db: Db,
  table: 'equipment' | 'exercises' | 'workout_templates',
  key: string,
  seed: (k: string) => string,
): Promise<string | null> {
  for (const id of [seed(key), key]) {
    if (await db.get('SELECT id FROM ' + table + ' WHERE id = ? AND deleted_at IS NULL', [id]))
      return id;
  }
  if (table !== 'workout_templates') {
    const row = await db.get<{ id: string }>(
      'SELECT id FROM ' + table + ' WHERE slug = ? AND deleted_at IS NULL',
      [key],
    );
    if (row) return row.id;
  }
  return null;
}

export async function importSetup(
  db: Database,
  file: SetupFile,
  today: string,
): Promise<SetupImportResult> {
  const result: SetupImportResult = {
    equipment: 0,
    exercises: 0,
    workouts: 0,
    goals: 0,
    weightLogged: false,
    cycleDays: 0,
  };
  const templateIds = new Map<string, string>();

  await db.tx(async (tx) => {
    const at = nowIso();
    if (file.profile) {
      const p = file.profile;
      await profileRepo(tx).upsert({
        ...(p.name !== undefined ? { name: p.name?.trim() || null } : {}),
        ...(p.heightCm !== undefined ? { heightCm: p.heightCm } : {}),
        ...(p.dateOfBirth !== undefined ? { dateOfBirth: p.dateOfBirth } : {}),
        ...(p.units
          ? {
              weightUnit: p.units.weight,
              lengthUnit: p.units.length,
              distanceUnit: p.units.distance,
              speedUnit: p.units.speed,
            }
          : {}),
        ...(p.weekStartsOn !== undefined ? { weekStartsOn: p.weekStartsOn } : {}),
      });
    }

    const kg = file.body?.weightKg;
    const latest = await tx.get<{ value_kg: number }>(
      'SELECT value_kg FROM weight_entries WHERE deleted_at IS NULL ORDER BY recorded_at DESC LIMIT 1',
    );
    if (kg != null && (!latest || Math.abs(latest.value_kg - kg) > 0.05)) {
      await insertModel(tx, tables.weightEntries, {
        valueKg: kg,
        unitEntered: 'kg',
        recordedAt: at,
        notes: 'From setup file',
      });
      result.weightLogged = true;
    }
    for (const g of file.body?.goals ?? []) {
      const found = await tx.get<{ id: string }>(
        "SELECT id FROM goals WHERE deleted_at IS NULL AND status = 'active' AND type = ? AND title = ?",
        [g.type, g.title],
      );
      const patch = {
        targetValue: g.targetValue ?? null,
        unit: g.unit ?? null,
        targetDate: g.targetDate ?? null,
      };
      if (found) await patchModel(tx, tables.goals, found.id, patch);
      else
        await insertModel(tx, tables.goals, {
          type: g.type,
          title: g.title,
          ...patch,
          startValue: g.type === 'weight' ? (kg ?? latest?.value_kg ?? null) : null,
          measurementTypeId: null,
          startDate: today,
          status: 'active',
          achievedAt: null,
          notes: null,
        });
      result.goals += 1;
    }

    const eqIds = new Map<string, string>();
    for (const e of file.equipment ?? []) {
      const id = await resolve(tx, 'equipment', e.key, seedId.equipment);
      if (id) {
        await patchModel(tx, tables.equipment, id, { available: e.available });
        eqIds.set(e.key, id);
      } else {
        const row = await insertModel(tx, tables.equipment, {
          slug: null,
          name: e.name,
          category: e.category ?? 'other',
          available: e.available,
          isCustom: true,
          notes: null,
          iconKey: null,
          imagePath: null,
        });
        eqIds.set(e.key, row.id);
      }
      result.equipment += 1;
    }
    const equipmentId = async (key: string) =>
      eqIds.get(key) ?? (await resolve(tx, 'equipment', key, seedId.equipment));

    const exIds = new Map<string, string>();
    for (const x of file.exercises ?? []) {
      const fields = {
        name: x.name,
        category: x.category,
        primaryMuscle: x.primaryMuscle,
        secondaryMuscles: x.secondaryMuscles,
        tracking: x.tracking,
        instructions: x.instructions.join('\n') || null,
        defaultSets: x.defaultSets ?? null,
        defaultReps: x.defaultReps ?? null,
        defaultDurationSeconds: x.defaultDurationSeconds ?? null,
        defaultRestSeconds: x.defaultRestSeconds ?? null,
        difficulty: x.difficulty ?? null,
      };
      let id = await resolve(tx, 'exercises', x.key, seedId.exercise);
      if (id) await patchModel(tx, tables.exercises, id, fields);
      else {
        id = (
          await insertModel(tx, tables.exercises, {
            ...fields,
            slug: null,
            isCustom: true,
            archivedAt: null,
          })
        ).id;
      }
      await tx.run('DELETE FROM exercise_equipment WHERE exercise_id = ?', [id]);
      for (const k of x.equipment) {
        const eq = await equipmentId(k);
        if (eq) {
          await tx.run(
            'INSERT OR IGNORE INTO exercise_equipment (exercise_id, equipment_id) VALUES (?, ?)',
            [id, eq],
          );
        }
      }
      exIds.set(x.key, id);
      result.exercises += 1;
    }
    const exerciseId = async (key: string) =>
      exIds.get(key) ?? (await resolve(tx, 'exercises', key, seedId.exercise));

    for (const w of file.workouts ?? []) {
      const header = {
        name: w.name,
        type: w.type,
        description: w.description ?? null,
        durationMinutes: w.durationMinutes ?? null,
      };
      let id = await resolve(tx, 'workout_templates', w.key, seedId.template);
      if (id) await patchModel(tx, tables.workoutTemplates, id, { ...header, archivedAt: null });
      else {
        id = (
          await insertModel(tx, tables.workoutTemplates, {
            ...header,
            difficulty: null,
            coverKey: null,
            distanceTargetKm: null,
            isSeed: false,
            archivedAt: null,
            notes: null,
          })
        ).id;
      }
      // Children are replaced wholesale (past sessions keep their own frozen copies).
      await tx.run('DELETE FROM workout_template_exercises WHERE template_id = ?', [id]);
      await tx.run('DELETE FROM template_running_intervals WHERE template_id = ?', [id]);
      for (const [i, e] of w.exercises.entries()) {
        const ex = await exerciseId(e.exercise);
        if (!ex) throw new Error(`Unknown exercise "${e.exercise}" in workout "${w.name}"`);
        await insertModel(tx, tables.templateExercises, {
          templateId: id,
          exerciseId: ex,
          orderIndex: i,
          sets: e.sets,
          targetReps: e.reps ?? null,
          targetDurationSeconds: e.durationSeconds ?? null,
          targetWeightKg: e.weightKg ?? null,
          restSeconds: e.restSeconds ?? null,
          supersetGroup: null,
          notes: e.notes ?? null,
        });
      }
      for (const [i, iv] of w.intervals.entries()) {
        const kmh = iv.speedKmh ?? (iv.speedMph != null ? iv.speedMph * MPH : null);
        await insertModel(tx, tables.templateIntervals, {
          templateId: id,
          orderIndex: i,
          kind: iv.kind,
          durationSeconds: iv.seconds,
          speedKmh: kmh === null ? null : round(kmh, 4),
          inclinePercent: iv.inclinePercent ?? null,
          label: iv.label ?? null,
        });
      }
      templateIds.set(w.key, id);
      result.workouts += 1;
    }
  });

  // Cycle days last (they point at the workouts above), then the plan ahead is redrawn.
  if (file.cycle) {
    const tpl = async (key: string | null | undefined) =>
      key
        ? (templateIds.get(key) ?? (await resolve(db, 'workout_templates', key, seedId.template)))
        : null;
    const plan: CyclePlan = { groups: [] };
    for (const d of file.cycle.days) {
      plan.groups.push({
        id: d.key || newId(),
        name: d.name,
        runTemplateId: await tpl(d.run),
        gymTemplateId: await tpl(d.gym),
      });
    }
    await saveCyclePlan(db, plan, today);
    result.cycleDays = plan.groups.length;
  }
  return result;
}
