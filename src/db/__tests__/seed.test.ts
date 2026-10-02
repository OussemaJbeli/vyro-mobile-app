import en from '@/i18n/locales/en/seed.json';

import { openDatabase, type Database } from '../client';
import { migrations } from '../migrations';
import { runMigrations } from '../migrations/runner';
import { seedData } from '../seed/data/content';
import { seedId, seedKey } from '../seed/ids';
import { getSeedVersion, seedDatabase } from '../seed/seed';
import { applyRoutine, pruneSampleWorkouts } from '../routine';
import { scheduleRepo } from '../repositories/schedule';
import { openNodeDriver } from '../testing/nodeDriver';

const COUNTED = [
  'equipment',
  'exercises',
  'exercise_equipment',
  'exercise_alternatives',
  'measurement_types',
  'photo_categories',
  'workout_templates',
  'workout_template_exercises',
  'template_running_intervals',
] as const;

async function counts(db: Database) {
  const out: Record<string, number> = {};
  for (const t of COUNTED) {
    out[t] = (await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM ' + t))!.n;
  }
  return out;
}

let db: Database;
beforeEach(async () => {
  db = await openDatabase(openNodeDriver());
  await runMigrations(db, migrations);
});
afterEach(() => db.driver.close());

describe('seed', () => {
  it('fills a fresh install with the full library', async () => {
    const report = await seedDatabase(db);
    expect(report.ran).toBe(true);
    const c = await counts(db);
    expect(c.equipment).toBe(seedData.equipment.length);
    expect(c.exercises).toBeGreaterThanOrEqual(65);
    expect(c.workout_templates).toBe(seedData.templates.length);
    expect(c.measurement_types).toBe(10);
    expect(c.photo_categories).toBe(13);
    expect(await getSeedVersion(db)).toBe(5);
    expect(await db.all('PRAGMA foreign_key_check')).toEqual([]);
  });

  it('is idempotent', async () => {
    await seedDatabase(db);
    const first = await counts(db);
    await seedDatabase(db); // same version: skipped
    await seedDatabase(db, { version: 2 }); // forced re-run: inserts nothing new
    expect(await counts(db)).toEqual(first);
  });

  it('keeps user edits to seeded rows when the seed version is bumped', async () => {
    await seedDatabase(db);
    await db.run("UPDATE exercises SET name = 'My Bench' WHERE slug = 'bench_press'");
    await db.run("UPDATE equipment SET available = 0 WHERE slug = 'cable_machine'");
    const report = await seedDatabase(db, { version: 6 });
    expect(report).toMatchObject({ ran: true, inserted: 0 });
    expect(await db.get("SELECT name FROM exercises WHERE slug = 'bench_press'")).toEqual({
      name: 'My Bench',
    });
    expect(await db.get("SELECT available FROM equipment WHERE slug = 'cable_machine'")).toEqual({
      available: 0,
    });
  });

  it('rolls back completely if any seed row is invalid', async () => {
    const broken = {
      ...seedData,
      exercises: [
        ...seedData.exercises,
        { ...seedData.exercises[0]!, slug: 'x', category: 'nope' as never },
      ],
    };
    await expect(seedDatabase(db, { data: broken })).rejects.toMatchObject({ code: 'VALIDATION' });
    expect((await counts(db)).exercises).toBe(0);
    expect(await getSeedVersion(db)).toBe(0);
  });
});

describe('seed content integrity', () => {
  const exercises = new Map(seedData.exercises.map((e) => [e.slug, e]));
  const equipment = new Map(seedData.equipment.map((e) => [e.slug, e]));

  it('uses unique slugs and resolvable references', () => {
    expect(exercises.size).toBe(seedData.exercises.length);
    expect(equipment.size).toBe(seedData.equipment.length);
    for (const x of seedData.exercises)
      x.equipment.forEach((e) => expect(equipment.has(e)).toBe(true));
    for (const [slug, alts] of Object.entries(seedData.alternatives)) {
      expect(exercises.has(slug)).toBe(true);
      alts.forEach((a) => {
        expect(exercises.has(a)).toBe(true);
        expect(a).not.toBe(slug);
      });
    }
    for (const t of seedData.templates) {
      (t.exercises ?? []).forEach((i) => expect(exercises.has(i.exercise)).toBe(true));
    }
  });

  it('gives every machine or cable exercise a dumbbell-or-bodyweight alternative', () => {
    const light = (slug: string) => exercises.get(slug)!.equipment.every((e) => e === 'dumbbells');
    const machine = seedData.exercises.filter((x) =>
      x.equipment.some((e) => equipment.get(e)?.category === 'machines'),
    );
    expect(machine.length).toBeGreaterThan(8);
    for (const x of machine) {
      expect({ exercise: x.slug, ok: (seedData.alternatives[x.slug] ?? []).some(light) }).toEqual({
        exercise: x.slug,
        ok: true,
      });
    }
  });

  it('matches each running plan total to its template duration', () => {
    const runs = seedData.templates.filter((t) => t.type === 'running');
    expect(runs.length).toBeGreaterThanOrEqual(5);
    for (const t of runs) {
      const total = (t.intervals ?? []).reduce((s, i) => s + i.durationSeconds, 0);
      expect({ key: t.key, total }).toEqual({ key: t.key, total: t.durationMinutes * 60 });
    }
    // FS §19 plan: 5 → 6 → 8 → 6 → 9 → 5 mph.
    const fs19 = runs.find((t) => t.key === 'interval_run_35')!;
    expect(fs19.intervals!.map((i) => Math.round((i.speedKmh / 1.609344) * 10) / 10)).toEqual([
      5, 6, 8, 6, 9, 5,
    ]);
  });

  it('uses the right target per tracking type', () => {
    for (const t of seedData.templates) {
      for (const item of t.exercises ?? []) {
        const tracking = exercises.get(item.exercise)!.tracking;
        if (tracking === 'duration') expect(item.targetDurationSeconds).toBeGreaterThan(0);
        else expect(item.targetReps).toBeGreaterThan(0);
      }
    }
  });

  it('has an English and French name for every seeded row', () => {
    for (const e of seedData.equipment) expect(en.equipment).toHaveProperty(e.slug);
    for (const x of seedData.exercises) expect(en.exercise).toHaveProperty(x.slug);
    for (const m of seedData.measurementTypes) expect(en.measurement).toHaveProperty(m.slug);
    for (const c of seedData.photoCategories)
      expect(en.photo).toHaveProperty(c.slug.replace('.', '_'));
    for (const t of seedData.templates) expect(en.template).toHaveProperty(t.key);
    expect(seedKey(seedId.exercise('bench_press'))).toBe('bench_press');
    expect(seedKey('3f2a-user-uuid')).toBeNull();
  });

  it('applies the routine once: the same week every week, mph, only the routine left', async () => {
    await seedDatabase(db);
    expect(await applyRoutine(db, { today: '2026-09-26' })).toBe(true);
    expect(await applyRoutine(db, { today: '2026-09-26' })).toBe(false);
    const visible = await db.all('SELECT id FROM workout_templates WHERE deleted_at IS NULL');
    expect(visible).toHaveLength(6);
    await scheduleRepo(db).materialize('2026-09-26', '2026-10-11');
    const day = async (d: string) =>
      (
        await db.all<{ type: string; start_time: string | null }>(
          'SELECT type, start_time FROM scheduled_sessions WHERE scheduled_date = ? ORDER BY order_in_day',
          [d],
        )
      ).map((s) => (s.start_time ? `${s.type}@${s.start_time}` : s.type));
    // Push / Pull / Legs (1.2.0): the run first (warm-up), the gym right after; Thu rest.
    expect(await day('2026-09-28')).toEqual(['running@16:30', 'gym@17:00']);
    expect(await day('2026-09-30')).toEqual(['running@14:30', 'gym@14:55']);
    expect(await day('2026-10-01')).toEqual(['rest']);
    expect(await day('2026-10-02')).toEqual(['running@14:30', 'gym@15:00']);
    expect(await day('2026-10-04')).toEqual(['running@14:30', 'gym@14:55']);
    expect(await day('2026-10-05')).toEqual(await day('2026-09-28'));
    expect(await day('2026-09-26')).toEqual(['running@16:30', 'gym@17:00']);
    const profile = await db.get<{ speed_unit: string }>('SELECT speed_unit FROM user_profile');
    expect(profile?.speed_unit).toBe('mph');
    // The whole current week is filled from its Monday (startup materializes from there).
    await scheduleRepo(db).materialize('2026-09-21', '2026-09-27');
    expect(await day('2026-09-21')).toEqual(['running@16:30', 'gym@17:00']);
    // Self-healing: an emptied plan brings the routine back on the next start.
    await db.run('UPDATE schedule_rules SET deleted_at = ?', ['2026-09-27T00:00:00.000Z']);
    expect(await applyRoutine(db, { today: '2026-09-27' })).toBe(true);
    expect(await applyRoutine(db, { today: '2026-09-27' })).toBe(false);
  });

  it('applies the routine even when a future planned session was already started once', async () => {
    await seedDatabase(db);
    const at = '2026-09-27T10:00:00.000Z';
    await db.run(
      "INSERT INTO scheduled_sessions (id, title, type, scheduled_date, status, original_date, reschedule_count, is_exception, order_in_day, created_at, updated_at) VALUES ('s1', 'Old', 'gym', '2026-09-28', 'planned', '2026-09-28', 0, 0, 0, ?, ?)",
      [at, at],
    );
    await db.run(
      "INSERT INTO session_executions (id, scheduled_session_id, type, title, status, started_at, planned_snapshot, created_at, updated_at) VALUES ('e1', 's1', 'gym', 'Old', 'abandoned', ?, '{}', ?, ?)",
      [at, at, at],
    );
    expect(await applyRoutine(db, { today: '2026-09-27' })).toBe(true);
    await scheduleRepo(db).materialize('2026-09-27', '2026-09-29');
    const monday = await db.all<{ title: string }>(
      "SELECT title FROM scheduled_sessions WHERE scheduled_date = '2026-09-28' AND deleted_at IS NULL ORDER BY order_in_day",
    );
    expect(monday.map((s) => s.title)).toEqual([
      'Real Speed',
      'Push · Chest + Shoulders + Triceps',
    ]);
  });

  it('removes sample workouts on start; Push keeps its starting weights', async () => {
    await seedDatabase(db);
    expect(await pruneSampleWorkouts(db)).toBeGreaterThan(0);
    const left = await db.all<{ id: string }>(
      'SELECT id FROM workout_templates WHERE deleted_at IS NULL',
    );
    expect(left).toHaveLength(6);
    const push = await db.all<{ sets: number; target_reps: number; target_weight_kg: number }>(
      "SELECT sets, target_reps, target_weight_kg FROM workout_template_exercises WHERE template_id = 'seed-tpl-gym_push' ORDER BY order_index",
    );
    expect(push[0]).toEqual({ sets: 3, target_reps: 6, target_weight_kg: 35 });
    expect(push.reduce((n, x) => n + x.sets, 0)).toBe(23);
  });

  it('re-syncs the routine workouts on an existing install (exercise swaps reach the phone)', async () => {
    await seedDatabase(db);
    await applyRoutine(db, { today: '2026-10-02' });
    // An older install: Push still starts with the old chest press, routine v6.
    await db.run(
      "UPDATE workout_template_exercises SET exercise_id = 'seed-ex-chest_press_machine' WHERE id = 'seed-te-gym_push-0'",
    );
    await db.run("UPDATE app_settings SET value = '6' WHERE key = 'routine_version'");
    expect(await applyRoutine(db, { today: '2026-10-02' })).toBe(true);
    const push = await db.all<{ exercise_id: string }>(
      "SELECT exercise_id FROM workout_template_exercises WHERE template_id = 'seed-tpl-gym_push' ORDER BY order_index",
    );
    expect(push.map((x) => x.exercise_id.replace('seed-ex-', ''))).toEqual([
      'lever_lying_chest_press',
      'incline_bench_press',
      'decline_bench_press',
      'pec_deck',
      'dumbbell_shoulder_press',
      'lateral_raise',
      'cable_leaning_lateral_raise',
      'tricep_pushdown',
      'overhead_cable_extension',
    ]);
  });
});
