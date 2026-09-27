import {
  buildSnapshot,
  hydrate,
  reduce,
  toRuntime,
  type Event as EventInput,
  type ExecState,
  type Tracking,
} from '@/domain/execution';
import { type PlannedSnapshot } from '@/types/domain';
import { setClock } from '@/utils/clock';

import { openDatabase, type Database } from '../client';
import { migrations } from '../migrations';
import { runMigrations } from '../migrations/runner';
import { createRepositories, type Repositories } from '../repositories';
import { seedId } from '../seed/ids';
import { seedDatabase } from '../seed/seed';
import { openNodeDriver } from '../testing/nodeDriver';

let db: Database;
let r: Repositories;
const T0 = Date.parse('2026-09-26T18:00:00.000Z');

beforeEach(async () => {
  setClock(() => new Date(T0));
  db = await openDatabase(openNodeDriver());
  await runMigrations(db, migrations);
  await seedDatabase(db, { now: '2026-09-26T00:00:00.000Z' });
  r = createRepositories(db);
});
afterEach(async () => {
  setClock(null);
  await db.driver.close();
});

async function snapshotOf(key: string): Promise<PlannedSnapshot> {
  const tpl = await r.templates.get(seedId.template(key));
  const rows = await db.all<{ id: string; name: string; tracking: Tracking }>(
    'SELECT id, name, tracking FROM exercises',
  );
  const byId = new Map(rows.map((x) => [x.id, x]));
  return buildSnapshot(tpl, (id) => byId.get(id));
}

/** The runner's contract without React Native: reduce → persist in one transaction. */
async function begin(key: string, scheduledSessionId: string | null) {
  const snapshot = await snapshotOf(key);
  const x = await r.executions.start({
    scheduledSessionId,
    templateId: snapshot.templateId,
    type: snapshot.type,
    title: snapshot.name,
    snapshot,
    startedAt: new Date(T0).toISOString(),
  });
  let state = hydrate(await r.executions.get(x.id), { autoRest: true });
  await r.executions.applyTransition(x.id, [], toRuntime(state));
  const step = async (...events: EventInput[]) => {
    for (const e of events) {
      const t = reduce(state, e);
      await r.executions.applyTransition(x.id, t.changes, toRuntime(t.state));
      state = t.state;
    }
    return state;
  };
  /** Simulated OS kill: throw memory away and rebuild from SQLite. */
  const reload = async (): Promise<ExecState> =>
    hydrate(await r.executions.get(x.id), { autoRest: false });
  return {
    id: x.id,
    snapshot,
    step,
    reload,
    get state() {
      return state;
    },
  };
}

describe('execution engine ⇄ SQLite', () => {
  it('kill mid-rest restores exact exercise, set and remaining rest; finish updates the plan', async () => {
    const session = await r.schedule.create({
      templateId: seedId.template('upper_body'),
      title: 'Upper Body',
      type: 'gym',
      scheduledDate: '2026-09-26',
      startTime: '18:00',
      endTime: null,
      durationMinutes: 55,
      orderInDay: 0,
      reminderOffsetMinutes: null,
      skipReason: null,
      notes: null,
    });
    const run = await begin('upper_body', session.id);
    const first = run.state.exercises[0]!;
    await run.step(
      {
        type: 'SUBSTITUTE_EXERCISE',
        now: T0 + 5_000,
        exerciseId: seedId.exercise('push_up'),
        tracking: 'reps',
        reason: 'bench busy',
      },
      { type: 'COMPLETE_SET', now: T0 + 60_000 },
      { type: 'ADD_SET', now: T0 + 70_000, id: 'extra-1' },
      { type: 'PAUSE', now: T0 + 80_000 },
      { type: 'RESUME', now: T0 + 140_000 },
    );
    expect(run.state.phase).toBe('resting');

    const restored = await run.reload();
    expect(restored).toEqual(run.state);
    expect(restored.cursor).toEqual({ exercise: 0, set: 1 });
    expect(restored.exercises[0]).toMatchObject({
      exerciseId: seedId.exercise('push_up'),
      plannedExerciseId: first.exerciseId,
      tracking: 'reps',
    });

    // Finish every remaining set, then close.
    let now = T0 + 200_000;
    while (run.state.cursor) await run.step({ type: 'COMPLETE_SET', now: (now += 120_000) });
    await run.step({ type: 'FINISH', now: now + 1_000 });

    const done = await r.executions.get(run.id);
    expect(done).toMatchObject({
      status: 'completed',
      outcome: 'modified',
      runtimeState: null,
      pausedSeconds: 60,
    });
    expect(done.plannedSnapshot).toEqual(run.snapshot); // AD-07: untouched plan
    expect(done.exercises[0]!.sets.at(-1)).toMatchObject({
      id: 'extra-1',
      isExtra: true,
      status: 'done',
    });
    expect(done.exercises.flatMap((e) => e.sets).every((s) => s.status === 'done')).toBe(true);
    expect((await r.schedule.getSession(session.id)).status).toBe('modified');
    expect(await r.executions.getActive()).toBeNull();
  });

  it('running: repeat, speed and duration edits survive a kill; catch-up after reopening', async () => {
    const run = await begin('interval_run_35', null);
    expect(run.state.kind).toBe('running');
    await run.step(
      { type: 'INTERVAL_ADJUST_SPEED', now: T0 + 60_000, speedKmh: 8.5 },
      { type: 'INTERVAL_ADJUST_DURATION', now: T0 + 60_000, deltaSeconds: 30 },
      { type: 'INTERVAL_REPEAT', now: T0 + 90_000, id: 'rep-1' },
      { type: 'INTERVAL_NEXT', now: T0 + 120_000 },
    );
    expect(await run.reload()).toEqual(run.state);

    // Reopened much later: the reducer settles every interval whose time is up.
    const t = reduce(await run.reload(), { type: 'TICK', now: T0 + 22 * 60_000 });
    expect(t.caughtUp).toBe(2); // repeat, run and sprint all ended while away
    expect(t.state.current).toMatchObject({ index: 4, startActiveMs: 22 * 60_000 });
    await r.executions.applyTransition(run.id, t.changes, toRuntime(t.state));
    expect(await run.reload()).toEqual(t.state);
    const rows = (await r.executions.get(run.id)).intervals;
    expect(rows[0]).toMatchObject({
      status: 'partial',
      actualDurationSeconds: 120,
      actualSpeedKmh: 8.5,
    });
    expect(rows[1]).toMatchObject({ id: 'rep-1', isRepeat: true, orderIndex: 1 });

    const abandon = reduce(t.state, { type: 'ABANDON', now: T0 + 23 * 60_000 });
    await r.executions.applyTransition(run.id, abandon.changes, toRuntime(abandon.state));
    expect((await r.executions.get(run.id)).status).toBe('abandoned');
  });

  it('empty workout: exercises added on the fly are stored with their sets', async () => {
    const x = await r.executions.start({
      scheduledSessionId: null,
      templateId: null,
      type: 'gym',
      title: 'Empty workout',
      snapshot: {
        schemaVersion: 1,
        templateId: null,
        name: 'Empty workout',
        type: 'gym',
        exercises: [],
        intervals: [],
      },
    });
    let state = hydrate(await r.executions.get(x.id), { autoRest: true });
    const apply = async (e: EventInput) => {
      const t = reduce(state, e);
      await r.executions.applyTransition(x.id, t.changes, toRuntime(t.state));
      state = t.state;
    };
    await apply({
      type: 'ADD_EXERCISE',
      now: T0,
      id: 'se-new',
      exerciseId: seedId.exercise('push_up'),
      tracking: 'reps',
      restSeconds: 30,
      sets: [{ id: 'set-new', reps: 12, weightKg: null, durationSeconds: null }],
    });
    await apply({ type: 'COMPLETE_SET', now: T0 + 30_000 });
    await apply({ type: 'REORDER_REMAINING', now: T0 + 31_000, order: ['se-new'] });
    expect(hydrate(await r.executions.get(x.id), { autoRest: true })).toEqual(state);
    await apply({ type: 'FINISH', now: T0 + 60_000 });
    expect((await r.executions.get(x.id)).outcome).toBe('modified');
  });
});
