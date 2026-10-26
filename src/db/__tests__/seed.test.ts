import en from '@/i18n/locales/en/seed.json';

import { openDatabase, type Database } from '../client';
import { migrations } from '../migrations';
import { runMigrations } from '../migrations/runner';
import { seedData } from '../seed/data/content';
import { seedId, seedKey } from '../seed/ids';
import { getSeedVersion, seedDatabase } from '../seed/seed';
import { readCyclePlan, reconcileCycle, saveCyclePlan } from '../cycle';
import { type CycleGroup } from '@/domain/scheduling/cycle';
import { applyRoutine, pruneSampleWorkouts } from '../routine';
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
    expect(await getSeedVersion(db)).toBe(6);
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
    const report = await seedDatabase(db, { version: 7 });
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

  const dayOf = async (d: string) =>
    (
      await db.all<{ type: string; start_time: string | null }>(
        'SELECT type, start_time FROM scheduled_sessions WHERE scheduled_date = ? AND deleted_at IS NULL ORDER BY order_in_day',
        [d],
      )
    ).map((s) => (s.start_time ? `${s.type}@${s.start_time}` : s.type));

  it('applies the routine once: Push → Pull → Legs → Rest from Sunday, run before gym, mph', async () => {
    await seedDatabase(db);
    // Sunday 2026-10-18: the cycle starts with Push.
    expect(await applyRoutine(db, { today: '2026-10-18' })).toBe(true);
    await reconcileCycle(db, '2026-10-18');
    expect(await applyRoutine(db, { today: '2026-10-18' })).toBe(false);
    const visible = await db.all('SELECT id FROM workout_templates WHERE deleted_at IS NULL');
    expect(visible).toHaveLength(6);
    expect(await dayOf('2026-10-18')).toEqual(['running@14:30', 'gym@15:00']); // Sun: Push
    expect(await dayOf('2026-10-19')).toEqual(['running@16:30', 'gym@17:00']); // Mon: Pull
    expect(await dayOf('2026-10-20')).toEqual(['running@16:30', 'gym@16:55']); // Tue: Legs
    expect(await dayOf('2026-10-21')).toEqual(['rest']); // Wed: rest after 3 days
    const profile = await db.get<{ speed_unit: string; week_starts_on: number }>(
      'SELECT speed_unit, week_starts_on FROM user_profile',
    );
    expect(profile).toEqual({ speed_unit: 'mph', week_starts_on: 0 });
  });

  it('repeats a missed day: Pull missed on Monday comes back on Tuesday', async () => {
    await seedDatabase(db);
    await applyRoutine(db, { today: '2026-10-18' });
    await reconcileCycle(db, '2026-10-18');
    // Sunday's Push gym session completed; Monday nothing.
    await db.run(
      "UPDATE scheduled_sessions SET status = 'completed' WHERE scheduled_date = '2026-10-18' AND type = 'gym'",
    );
    await reconcileCycle(db, '2026-10-20');
    const titles = async (d: string) =>
      (
        await db.all<{ title: string }>(
          "SELECT title FROM scheduled_sessions WHERE scheduled_date = ? AND deleted_at IS NULL AND type = 'gym'",
          [d],
        )
      ).map((s) => s.title);
    expect(await titles('2026-10-20')).toEqual(['Pull · Back + Rear Delts + Biceps']);
    expect(await titles('2026-10-21')).toEqual(['Legs · Quads + Hamstrings + Calves']);
    expect(await dayOf('2026-10-22')).toEqual(['rest']);
  });

  it('applies the routine even when a future planned session was already started once', async () => {
    await seedDatabase(db);
    const at = '2026-10-18T10:00:00.000Z';
    await db.run(
      "INSERT INTO scheduled_sessions (id, title, type, scheduled_date, status, original_date, reschedule_count, is_exception, order_in_day, created_at, updated_at) VALUES ('s1', 'Old', 'gym', '2026-10-19', 'planned', '2026-10-19', 0, 0, 0, ?, ?)",
      [at, at],
    );
    await db.run(
      "INSERT INTO session_executions (id, scheduled_session_id, type, title, status, started_at, planned_snapshot, created_at, updated_at) VALUES ('e1', 's1', 'gym', 'Old', 'abandoned', ?, '{}', ?, ?)",
      [at, at, at],
    );
    expect(await applyRoutine(db, { today: '2026-10-18' })).toBe(true);
    await reconcileCycle(db, '2026-10-18');
    expect(await dayOf('2026-10-19')).toEqual(['running@16:30', 'gym@17:00']);
  });

  it('keeps only the routine workouts; Push follows docs/plan/pro_plan.md', async () => {
    await seedDatabase(db);
    expect(await pruneSampleWorkouts(db)).toBeGreaterThan(0);
    const left = await db.all<{ id: string }>(
      'SELECT id FROM workout_templates WHERE deleted_at IS NULL',
    );
    expect(left).toHaveLength(6);
    const push = await db.all<{ exercise_id: string; sets: number; target_weight_kg: number }>(
      "SELECT exercise_id, sets, target_weight_kg FROM workout_template_exercises WHERE template_id = 'seed-tpl-gym_push' ORDER BY order_index",
    );
    expect(push[0]).toEqual({
      exercise_id: 'seed-ex-incline_chest_press_machine',
      sets: 3,
      target_weight_kg: 20,
    });
    expect(push.reduce((n, x) => n + x.sets, 0)).toBe(21);
  });

  it('re-syncs the routine workouts on an existing install (exercise swaps reach the phone)', async () => {
    await seedDatabase(db);
    await applyRoutine(db, { today: '2026-10-18' });
    await db.run(
      "UPDATE workout_template_exercises SET exercise_id = 'seed-ex-chest_press_machine' WHERE id = 'seed-te-gym_pull-0'",
    );
    await db.run("UPDATE app_settings SET value = '7' WHERE key = 'routine_version'");
    expect(await applyRoutine(db, { today: '2026-10-18' })).toBe(true);
    const pull = await db.all<{ exercise_id: string }>(
      "SELECT exercise_id FROM workout_template_exercises WHERE template_id = 'seed-tpl-gym_pull' ORDER BY order_index",
    );
    expect(pull.map((x) => x.exercise_id.replace('seed-ex-', ''))).toEqual([
      'lat_pulldown',
      'seated_row',
      'cable_one_arm_twisting_row',
      'lever_seated_row',
      'lever_preacher_curl',
      'hammer_curl',
    ]);
  });

  it('rebuilds an empty plan on start, even after a stale "custom" opt-out', async () => {
    await seedDatabase(db);
    await applyRoutine(db, { today: '2026-10-18' });
    await db.run('DELETE FROM scheduled_sessions');
    await db.run(
      "INSERT INTO app_settings (key, value, updated_at) VALUES ('routine_opt_out', 'true', 'x') ON CONFLICT(key) DO UPDATE SET value = 'true'",
    );
    expect(await applyRoutine(db, { today: '2026-10-18' })).toBe(true);
    await reconcileCycle(db, '2026-10-18');
    expect(await dayOf('2026-10-18')).toEqual(['running@14:30', 'gym@15:00']);
  });

  it('edits the day groups: Legs first, a different run on Push, same day kept, plan redrawn', async () => {
    await seedDatabase(db);
    await applyRoutine(db, { today: '2026-10-20' }); // Day 1 (Push) starts on the setup day
    await reconcileCycle(db, '2026-10-20');
    const plan = await readCyclePlan(db);
    const [push, pull, legs] = plan.groups as [CycleGroup, CycleGroup, CycleGroup];
    await saveCyclePlan(
      db,
      { groups: [legs, { ...push, runTemplateId: 'seed-tpl-run_easy_16' }, pull] },
      '2026-10-20',
    );
    const titles = async (d: string) =>
      (
        await db.all<{ title: string }>(
          'SELECT title FROM scheduled_sessions WHERE scheduled_date = ? AND deleted_at IS NULL ORDER BY order_in_day',
          [d],
        )
      ).map((s) => s.title);
    // Today stays Push (now with the easy run), then Pull, then rest, then Legs.
    expect(await titles('2026-10-20')).toEqual([
      'Easy Controlled Run',
      'Push · Chest + Shoulders + Triceps',
    ]);
    expect(await titles('2026-10-21')).toEqual([
      'Speed Endurance',
      'Pull · Back + Rear Delts + Biceps',
    ]);
    expect(await titles('2026-10-22')).toEqual(['Rest']);
    expect(await titles('2026-10-23')).toEqual([
      'Easy Controlled Run',
      'Legs · Quads + Hamstrings + Calves',
    ]);
  });
});
