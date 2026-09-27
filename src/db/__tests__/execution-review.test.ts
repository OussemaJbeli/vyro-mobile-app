import {
  buildSnapshot,
  deriveOutcome,
  hydrate,
  reduce,
  toRuntime,
  type Event,
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
let clock = Date.parse('2026-09-20T18:00:00.000Z');

beforeEach(async () => {
  setClock(() => new Date(clock));
  db = await openDatabase(openNodeDriver());
  await runMigrations(db, migrations);
  await seedDatabase(db, { now: '2026-09-20T00:00:00.000Z' });
  r = createRepositories(db);
});
afterEach(async () => {
  setClock(null);
  await db.driver.close();
});

const bench = seedId.exercise('bench_press');
const snapshot = (): PlannedSnapshot => ({
  schemaVersion: 1,
  templateId: null,
  name: 'Bench day',
  type: 'gym',
  exercises: [
    {
      exerciseId: bench,
      name: 'Bench',
      tracking: 'weight_reps',
      orderIndex: 0,
      sets: 3,
      targetReps: 10,
      targetDurationSeconds: null,
      targetWeightKg: null,
      restSeconds: null,
      notes: null,
    },
  ],
  intervals: [],
});

async function run(
  events: (Event | ((now: number) => Event))[],
  opts: { scheduledSessionId?: string } = {},
) {
  const x = await r.executions.start({
    scheduledSessionId: opts.scheduledSessionId ?? null,
    templateId: null,
    type: 'gym',
    title: 'Bench day',
    snapshot: snapshot(),
    startedAt: new Date(clock).toISOString(),
  });
  let s = hydrate(await r.executions.get(x.id), { autoRest: false });
  for (const e of events) {
    clock += 60_000;
    const t = reduce(s, typeof e === 'function' ? e(clock) : e);
    await r.executions.applyTransition(x.id, t.changes, toRuntime(t.state));
    s = t.state;
  }
  return x.id;
}

const done =
  (reps: number, weightKg: number) =>
  (now: number): Event => ({ type: 'COMPLETE_SET', now, reps, weightKg });
const finish = (now: number): Event => ({ type: 'FINISH', now });

describe('execution review helpers', () => {
  it('lastPerformance returns the top set of the most recent completed session', async () => {
    await run([done(10, 60), done(10, 62.5), done(8, 62.5), finish]);
    clock += 86_400_000;
    await run([done(10, 65), done(9, 65), done(6, 67.5), finish]);
    clock += 86_400_000;
    // An abandoned session never counts.
    const abandoned = await run([done(12, 90), (now) => ({ type: 'ABANDON', now })]);
    const last = await r.executions.lastPerformance([bench, seedId.exercise('squat')]);
    expect(last).toEqual({ [bench]: { reps: 6, weightKg: 67.5, durationSeconds: null } });
    expect(await r.executions.lastPerformance([])).toEqual({});
    expect(abandoned).toBeTruthy();
  });

  it('keeps notes typed during the workout and saves the review', async () => {
    const id = await run([done(10, 60)]);
    await r.executions.setNotes(id, 'Felt strong');
    const [ex] = (await r.executions.get(id)).exercises;
    await r.executions.setExerciseNote(ex!.id, 'Grip wider');
    let s = hydrate(await r.executions.get(id), { autoRest: false });
    const t = reduce(s, { type: 'FINISH', now: clock + 60_000 });
    await r.executions.applyTransition(id, t.changes, toRuntime(t.state));
    s = t.state;
    expect(await r.executions.get(id)).toMatchObject({ notes: 'Felt strong', outcome: 'partial' });
    await r.executions.saveReview(id, {
      perceivedEffort: 7,
      notes: 'Felt strong, left shoulder ok',
    });
    const after = await r.executions.get(id);
    expect(after).toMatchObject({ perceivedEffort: 7, notes: 'Felt strong, left shoulder ok' });
    expect(after.exercises[0]!.notes).toBe('Grip wider');
    expect(s.lifecycle).toBe('completed');
  });

  it('discard removes an empty workout but keeps logged data as abandoned', async () => {
    const session = await r.schedule.create({
      templateId: null,
      title: 'Bench day',
      type: 'gym',
      scheduledDate: '2026-09-20',
      startTime: null,
      endTime: null,
      durationMinutes: null,
      orderInDay: 0,
      reminderOffsetMinutes: null,
      skipReason: null,
      notes: null,
    });
    const empty = await run([], { scheduledSessionId: session.id });
    expect(await r.executions.discard(empty)).toBe('deleted');
    await expect(r.executions.get(empty)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(await r.executions.getActive()).toBeNull();
    expect((await r.schedule.getSession(session.id)).status).toBe('planned');

    const logged = await run([done(10, 60)]);
    expect(await r.executions.discard(logged)).toBe('abandoned');
    const kept = await r.executions.get(logged);
    expect(kept.status).toBe('abandoned');
    expect(kept.exercises[0]!.sets[0]!.status).toBe('done');
  });

  it('buildSnapshot + start work from a seed template', async () => {
    const tpl = await r.templates.get(seedId.template('abs'));
    const snap = buildSnapshot(tpl, () => ({ name: 'x', tracking: 'reps' }));
    expect(snap.exercises).toHaveLength(4);
  });
});

describe('history & analytics queries (step 24)', () => {
  it('doneSets joins muscles; correction recomputes the outcome; hard delete frees the session', async () => {
    const session = await r.schedule.create({
      templateId: null,
      title: 'Bench day',
      type: 'gym',
      scheduledDate: '2026-09-20',
      startTime: null,
      endTime: null,
      durationMinutes: null,
      orderInDay: 0,
      reminderOffsetMinutes: null,
      skipReason: null,
      notes: null,
    });
    const id = await run([done(10, 60), done(10, 60), done(10, 60), finish], {
      scheduledSessionId: session.id,
    });
    expect((await r.executions.get(id)).outcome).toBe('as_planned');
    const sets = await r.executions.doneSets({ exerciseId: bench });
    expect(sets).toHaveLength(3);
    expect(sets[0]).toMatchObject({ primaryMuscle: 'chest', reps: 10, weightKg: 60 });
    expect(await r.executions.templateStats('none')).toEqual({ count: 0, last: null });

    const first = (await r.executions.get(id)).exercises[0]!.sets[0]!;
    await r.executions.correctSet(first.id, {
      actualReps: 6,
      actualWeightKg: 60,
      actualDurationSeconds: null,
    });
    const corrected = await r.executions.get(id);
    expect(corrected.exercises[0]!.sets[0]).toMatchObject({
      actualReps: 6,
      completedAt: first.completedAt,
    });
    await r.executions.setOutcome(id, deriveOutcome(hydrate(corrected, { autoRest: false })));
    expect((await r.executions.get(id)).outcome).toBe('modified');
    expect((await r.schedule.getSession(session.id)).status).toBe('modified');

    await r.executions.deleteExecution(id);
    await expect(r.executions.get(id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect((await r.schedule.getSession(session.id)).status).toBe('planned');
  });
});
