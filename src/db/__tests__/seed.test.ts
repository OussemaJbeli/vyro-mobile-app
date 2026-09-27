import en from '@/i18n/locales/en/seed.json';

import { openDatabase, type Database } from '../client';
import { migrations } from '../migrations';
import { runMigrations } from '../migrations/runner';
import { seedData } from '../seed/data/content';
import { seedId, seedKey } from '../seed/ids';
import { getSeedVersion, seedDatabase } from '../seed/seed';
import { applyGymRepsStandard, applyRoutine, pruneSampleWorkouts } from '../routine';
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
    expect(await getSeedVersion(db)).toBe(3);
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
    const report = await seedDatabase(db, { version: 4 });
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
    expect(runs.length).toBeGreaterThanOrEqual(8);
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
    expect(visible).toHaveLength(12);
    await scheduleRepo(db).materialize('2026-09-26', '2026-10-11');
    const day = async (d: string) =>
      (
        await db.all<{ type: string; start_time: string | null }>(
          'SELECT type, start_time FROM scheduled_sessions WHERE scheduled_date = ? ORDER BY order_in_day',
          [d],
        )
      ).map((s) => (s.start_time ? `${s.type}@${s.start_time}` : s.type));
    // Monday, Thursday (rest), Sunday (14:00 start), and the next Monday repeats.
    expect(await day('2026-09-28')).toEqual(['abs@12:10', 'running@16:30', 'gym@17:00']);
    // Wednesday (docs/plan/weak.md): run 14:30, gym right after, six-pack 16:10; by time.
    expect(await day('2026-09-30')).toEqual(['running@14:30', 'gym@15:10', 'abs@16:10']);
    expect(await day('2026-10-01')).toEqual(['rest']);
    expect(await day('2026-10-04')).toEqual(['abs@12:10', 'running@14:30', 'gym@15:15']);
    expect(await day('2026-10-05')).toEqual(await day('2026-09-28'));
    expect(await day('2026-09-26')).toEqual(['abs@12:10', 'running@16:30', 'gym@17:05']);
    const profile = await db.get<{ speed_unit: string }>('SELECT speed_unit FROM user_profile');
    expect(profile?.speed_unit).toBe('mph');
    // The whole current week is filled from its Monday (startup materializes from there).
    await scheduleRepo(db).materialize('2026-09-21', '2026-09-27');
    expect(await day('2026-09-21')).toEqual(['abs@12:10', 'running@16:30', 'gym@17:00']);
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
      'Abs A · Crunch',
      'Speed Intervals',
      'Day 1 · Chest + Lats',
    ]);
  });

  it('removes sample workouts on start and moves gym lifts to 3 × 15 once', async () => {
    await seedDatabase(db);
    expect(await pruneSampleWorkouts(db)).toBeGreaterThan(0);
    const left = await db.all<{ id: string }>(
      'SELECT id FROM workout_templates WHERE deleted_at IS NULL',
    );
    expect(left).toHaveLength(12);
    expect(await applyGymRepsStandard(db)).toBe(true);
    expect(await applyGymRepsStandard(db)).toBe(false);
    const sets = await db.all<{ sets: number; target_reps: number }>(
      "SELECT sets, target_reps FROM workout_template_exercises WHERE template_id = 'seed-tpl-gym_arms'",
    );
    expect(sets.every((s) => s.sets === 3 && s.target_reps === 15)).toBe(true);
  });
});
