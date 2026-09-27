import { exerciseRecords } from '@/domain/analytics/records';
import { plannedStats } from '@/domain/analytics/metrics';
import { streaks } from '@/domain/streaks/streak';

import { openDatabase, type Database } from '../client';
import { loadDemoData } from '../demoData';
import { migrations } from '../migrations';
import { runMigrations } from '../migrations/runner';
import { createRepositories, type Repositories } from '../repositories';
import { seedDatabase } from '../seed/seed';
import { openNodeDriver } from '../testing/nodeDriver';

/**
 * Step 28 performance guard on the demo dataset (~2 years). Measures the heaviest reads
 * and domain aggregations, and checks that the hot queries use an index (no full scans
 * of large tables). Budgets are generous for CI; measured numbers are in the step file.
 */
let db: Database;
let r: Repositories;
const NOW = new Date('2026-09-26T12:00:00');
const measured: Record<string, number> = {};

beforeAll(async () => {
  db = await openDatabase(openNodeDriver());
  await runMigrations(db, migrations);
  await seedDatabase(db);
  r = createRepositories(db);
  measured.counts = 0;
  const counts = await loadDemoData(db, { now: NOW });
  Object.assign(
    measured,
    Object.fromEntries(Object.entries(counts).map(([k, v]) => [`rows.${k}`, v])),
  );
}, 120_000);
afterAll(async () => {
  // PERF=1 pnpm test performance → prints the measurements recorded in the step 28 file.
  if (process.env.PERF) console.log('step28-perf', JSON.stringify(measured));
  await db.driver.close();
});

async function time<T>(label: string, fn: () => Promise<T> | T): Promise<T> {
  const t0 = performance.now();
  const out = await fn();
  measured[label] = Math.round(performance.now() - t0);
  return out;
}

describe('demo dataset performance', () => {
  it('has the target volume', () => {
    expect(measured['rows.session_executions']).toBeGreaterThan(450);
    expect(measured['rows.exercise_sets']).toBeGreaterThan(10_000);
    expect(measured['rows.weight_entries']).toBeGreaterThan(650);
    expect(measured['rows.body_measurements']).toBeGreaterThanOrEqual(1000);
    expect(measured['rows.progress_photos']).toBe(300);
  });

  it('analytics for one year stays fast', async () => {
    const from = '2025-09-26T00:00:00.000Z';
    const to = '2026-09-27T00:00:00.000Z';
    const sessions = await time('sessionsForRange.1y', () =>
      r.schedule.sessionsForRange('2025-09-26', '2026-09-26'),
    );
    const execs = await time('completedBetween.1y', () => r.executions.completedBetween(from, to));
    const sets = await time('doneSets.all', () => r.executions.doneSets());
    await time('plannedStats.1y', () =>
      plannedStats(
        sessions.map((s) => ({
          date: s.scheduledDate,
          type: s.type,
          status: s.status,
          rescheduleCount: s.rescheduleCount,
          originalDate: s.originalDate,
        })),
        execs.map((x) => ({
          date: x.startedAt.slice(0, 10),
          type: x.type,
          scheduledSessionId: x.scheduledSessionId,
          activeSeconds: x.activeSeconds,
          distanceKm: x.distanceKm,
          outcome: x.outcome,
        })),
      ),
    );
    await time('streaks.1y', () =>
      streaks({
        sessions: sessions.map((s) => ({ date: s.scheduledDate, type: s.type, status: s.status })),
        adhocDates: [],
        today: '2026-09-26',
        since: '2025-09-26',
      }),
    );
    await time('records.allSets', () =>
      exerciseRecords(
        sets.map((s) => ({
          exerciseId: s.exerciseId,
          executionId: s.executionId,
          date: s.startedAt,
          reps: s.reps,
          weightKg: s.weightKg,
          durationSeconds: s.durationSeconds,
        })),
      ),
    );
    await time('history.page', () => r.executions.listHistory({}, null, 30));
    await time('weights.list.all', () => r.weights.list());
    await time('photos.all', () => r.photos.all());
    await time('measurements.between.1y', () => r.measurements.between({ from, to }));
    // Generous CI budgets (device targets live in the step file).
    for (const [k, v] of Object.entries(measured))
      if (!k.startsWith('rows.') && k !== 'counts') expect(v).toBeLessThan(2000);
  });

  it('hot queries use indexes', async () => {
    const plans: [string, string, unknown[]][] = [
      [
        'completedBetween',
        "SELECT * FROM session_executions WHERE status = 'completed' AND deleted_at IS NULL AND started_at >= ? AND started_at < ?",
        ['a', 'b'],
      ],
      [
        'sessionsForRange',
        'SELECT * FROM scheduled_sessions WHERE deleted_at IS NULL AND scheduled_date >= ? AND scheduled_date <= ?',
        ['a', 'b'],
      ],
      ['setsByExercise', 'SELECT * FROM session_exercises WHERE exercise_id = ?', ['a']],
      ['setsJoin', 'SELECT * FROM exercise_sets WHERE session_exercise_id = ?', ['a']],
      ['weights', 'SELECT * FROM weight_entries WHERE deleted_at IS NULL ORDER BY recorded_at', []],
      [
        'measurementsBetween',
        'SELECT * FROM body_measurements WHERE deleted_at IS NULL AND recorded_at >= ? AND recorded_at <= ? ORDER BY recorded_at DESC',
        ['a', 'b'],
      ],
      [
        'photosAll',
        'SELECT * FROM progress_photos WHERE deleted_at IS NULL ORDER BY captured_at DESC',
        [],
      ],
    ];
    const scans: string[] = [];
    for (const [name, sql, params] of plans) {
      const rows = await db.all<{ detail: string }>('EXPLAIN QUERY PLAN ' + sql, params as never);
      const detail = rows.map((x) => x.detail).join(' | ');
      measured[`plan.${name}`] = /USING (COVERING )?INDEX/.test(detail) ? 1 : 0;
      if (!/USING (COVERING )?INDEX/.test(detail)) scans.push(`${name}: ${detail}`);
    }
    expect(scans).toEqual([]);
  });
});
