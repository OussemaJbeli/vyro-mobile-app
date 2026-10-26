import { parseSetup } from '@/services/setup/format';

import { openDatabase, type Database } from '../client';
import { reconcileCycle } from '../cycle';
import { migrations } from '../migrations';
import { runMigrations } from '../migrations/runner';
import { applyRoutine } from '../routine';
import { seedDatabase } from '../seed/seed';
import { exportSetup, importSetup } from '../setup';
import { openNodeDriver } from '../testing/nodeDriver';

let db: Database;
beforeEach(async () => {
  db = await openDatabase(openNodeDriver());
  await runMigrations(db, migrations);
  await seedDatabase(db);
  await applyRoutine(db, { today: '2026-10-25' });
  await reconcileCycle(db, '2026-10-25');
});
afterEach(() => db.driver.close());

const strip = (f: Awaited<ReturnType<typeof exportSetup>>) => ({ ...f, exportedAt: undefined });

describe('setup file', () => {
  it('round-trips: export → import → export gives the same file', async () => {
    const first = await exportSetup(db);
    expect(first.workouts?.map((w) => w.key)).toEqual(
      expect.arrayContaining(['gym_push', 'gym_pull', 'gym_legs', 'run_real_speed']),
    );
    await importSetup(db, parseSetup(JSON.stringify(first)), '2026-10-25');
    expect(strip(await exportSetup(db))).toEqual(strip(first));
  });

  it('applies edits (weights, a run in mph, cycle order) and never touches history', async () => {
    await db.run(
      "INSERT INTO session_executions (id, type, title, status, started_at, planned_snapshot, created_at, updated_at) VALUES ('h1', 'gym', 'Old', 'completed', '2026-10-01T10:00:00Z', '{}', 'x', 'x')",
    );
    const file = await exportSetup(db);
    const push = file.workouts!.find((w) => w.key === 'gym_push')!;
    push.exercises[0]!.weightKg = 27.5;
    const run = file.workouts!.find((w) => w.key === 'run_real_speed')!;
    run.intervals[1]!.speedMph = 11.5;
    delete run.intervals[1]!.speedKmh;
    file.cycle!.days.reverse(); // Legs, Pull, Push
    file.body = {
      weightKg: 89,
      goals: [{ type: 'weight', title: 'Reach 82 kg', targetValue: 82 }],
    };

    const r = await importSetup(db, parseSetup(JSON.stringify(file)), '2026-10-25');
    expect(r).toMatchObject({ weightLogged: true, goals: 1, cycleDays: 3 });

    const after = await exportSetup(db);
    expect(after.workouts!.find((w) => w.key === 'gym_push')!.exercises[0]!.weightKg).toBe(27.5);
    expect(after.workouts!.find((w) => w.key === 'run_real_speed')!.intervals[1]!.speedMph).toBe(
      11.5,
    );
    expect(after.cycle!.days.map((d) => d.name)).toEqual(['Legs', 'Pull', 'Push']);
    expect(await db.get("SELECT id FROM session_executions WHERE id = 'h1'")).toBeTruthy();
  });

  it('rejects a broken file with the field that is wrong', () => {
    expect(() =>
      parseSetup('{"format":"vyro-setup","version":1,"workouts":[{"key":"x"}]}'),
    ).toThrow(/workouts\.0\.name/);
  });
});
