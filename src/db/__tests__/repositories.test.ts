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
let tick = 0;

beforeEach(async () => {
  tick = 0;
  // Deterministic, strictly increasing clock so ordering and pagination are testable.
  setClock(() => new Date(Date.UTC(2026, 8, 24, 12, 0, tick++)));
  db = await openDatabase(openNodeDriver());
  await runMigrations(db, migrations);
  await seedDatabase(db, { now: '2026-09-24T00:00:00.000Z' });
  r = createRepositories(db);
});
afterEach(async () => {
  setClock(null);
  await db.driver.close();
});

const snapshot = (): PlannedSnapshot => ({
  schemaVersion: 1,
  templateId: seedId.template('upper_body'),
  name: 'Upper Body',
  type: 'gym',
  exercises: [
    {
      exerciseId: seedId.exercise('bench_press'),
      name: 'Bench Press',
      tracking: 'weight_reps',
      orderIndex: 0,
      sets: 3,
      targetReps: 10,
      targetDurationSeconds: null,
      targetWeightKg: 60,
      restSeconds: 90,
      notes: null,
    },
  ],
  intervals: [],
});

const session = (date = '2026-09-24') =>
  r.schedule.create({
    templateId: seedId.template('upper_body'),
    title: 'Upper Body',
    type: 'gym',
    scheduledDate: date,
    startTime: '18:00',
    endTime: null,
    durationMinutes: 55,
    orderInDay: 0,
    reminderOffsetMinutes: null,
    skipReason: null,
    notes: null,
  });

describe('profile & settings', () => {
  it('creates the single profile on first upsert and updates it after', async () => {
    expect(await r.profile.get()).toBeNull();
    const p = await r.profile.upsert({ name: 'Alex', heightCm: 180 });
    const p2 = await r.profile.upsert({ weightUnit: 'lb' });
    expect(p2.id).toBe(p.id);
    expect(p2).toMatchObject({ name: 'Alex', heightCm: 180, weightUnit: 'lb' });
    expect((await r.profile.completeOnboarding()).onboardingCompletedAt).toBeTruthy();
  });

  it('reads defaults, persists typed values and rejects invalid ones', async () => {
    expect(await r.settings.get('theme')).toBe('dark');
    await r.settings.set('accent', 'blue');
    expect(await r.settings.get('accent')).toBe('blue');
    expect((await r.settings.getAll()).seed_version).toBe(6);
    await expect(r.settings.set('accent', 'pink' as never)).rejects.toMatchObject({
      code: 'VALIDATION',
    });
    await db.run("UPDATE app_settings SET value = '\"neon\"' WHERE key = 'accent'");
    expect(await r.settings.get('accent')).toBe('lime'); // corrupt value falls back
  });
});

describe('goals, equipment, exercises', () => {
  it('runs the goal lifecycle and orders active first', async () => {
    const g = await r.goals.create({
      type: 'weight',
      title: 'Target weight',
      targetValue: 70,
      unit: 'kg',
      startValue: 74.6,
      measurementTypeId: null,
      startDate: '2026-09-01',
      targetDate: null,
      status: 'active',
      achievedAt: null,
      notes: null,
    });
    await r.goals.setStatus(g.id, 'achieved');
    expect((await r.goals.get(g.id)).achievedAt).toBeTruthy();
    expect(await r.goals.list('active')).toEqual([]);
    await r.goals.softDelete(g.id);
    expect(await r.goals.list()).toEqual([]);
    await expect(r.goals.get(g.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('filters exercises by availability of their equipment', async () => {
    const all = await r.exercises.search({ availableOnly: true });
    expect(all.some((e) => e.slug === 'cable_fly')).toBe(true);
    await r.equipment.setAvailable(seedId.equipment('cable_machine'), false);
    const after = await r.exercises.search({ availableOnly: true });
    expect(after.some((e) => e.slug === 'cable_fly')).toBe(false);
    expect(after.some((e) => e.slug === 'push_up')).toBe(true); // bodyweight stays
  });

  it('applies an equipment preset, including "nothing available"', async () => {
    await r.equipment.setAvailableOnly([seedId.equipment('dumbbells')]);
    const list = await r.equipment.list();
    expect(list.filter((e) => e.available).map((e) => e.slug)).toEqual(['dumbbells']);
    await r.equipment.setAvailableOnly([]);
    expect((await r.equipment.list()).some((e) => e.available)).toBe(false);
  });

  it('searches safely and returns relations', async () => {
    expect((await r.exercises.search({ q: 'bench' })).map((e) => e.slug)).toContain('bench_press');
    expect(await r.exercises.search({ q: '100%_' })).toEqual([]); // wildcards are escaped
    const detail = await r.exercises.get(seedId.exercise('bench_press'));
    expect(detail.equipmentIds).toEqual(
      expect.arrayContaining([seedId.equipment('barbell'), seedId.equipment('flat_bench')]),
    );
    expect(detail.alternatives[0]?.alternativeId).toBe(seedId.exercise('dumbbell_bench_press'));
  });

  it('creates custom exercises, archives them and orders alternatives', async () => {
    const ex = await r.exercises.create(
      {
        slug: null,
        name: 'Band Pull-Apart',
        category: 'shoulders',
        primaryMuscle: 'rear_delts',
        secondaryMuscles: [],
        tracking: 'reps',
        instructions: null,
        defaultSets: 3,
        defaultReps: 15,
        defaultDurationSeconds: null,
        defaultRestSeconds: 45,
        difficulty: 'beginner',
      },
      [seedId.equipment('resistance_bands')],
    );
    await r.exercises.setAlternatives(ex.id, [
      seedId.exercise('face_pull'),
      ex.id,
      seedId.exercise('rear_delt_fly'),
    ]);
    const detail = await r.exercises.get(ex.id);
    expect(detail.isCustom).toBe(true);
    expect(detail.alternatives.map((a) => [a.alternativeId, a.priority])).toEqual([
      [seedId.exercise('face_pull'), 1],
      [seedId.exercise('rear_delt_fly'), 3],
    ]);
    await r.exercises.archive(ex.id);
    expect((await r.exercises.search({ customOnly: true })).length).toBe(0);
    expect((await r.exercises.search({ customOnly: true, includeArchived: true })).length).toBe(1);
  });
});

describe('templates', () => {
  it('lists by type, duplicates with children and replaces children on update', async () => {
    const running = await r.templates.list({ type: 'running' });
    expect(running).toHaveLength(5);
    const copy = await r.templates.duplicate(seedId.template('upper_body'));
    const detail = await r.templates.get(copy.id);
    expect(detail.name).toBe('Upper Body (copy)');
    expect(detail.isSeed).toBe(false);
    expect(detail.exercises).toHaveLength(6);
    await r.templates.update(copy.id, {
      name: 'Short Upper',
      exercises: [detail.exercises[0]!].map((e) => ({
        exerciseId: e.exerciseId,
        sets: 2,
        targetReps: 8,
        targetDurationSeconds: null,
        targetWeightKg: null,
        restSeconds: 60,
        supersetGroup: null,
        notes: null,
      })),
    });
    const updated = await r.templates.get(copy.id);
    expect(updated.name).toBe('Short Upper');
    expect(updated.exercises.map((e) => [e.orderIndex, e.sets])).toEqual([[0, 2]]);
  });

  it('invariant 5: archives a template that history references, deletes an unused one', async () => {
    const unused = await r.templates.duplicate(seedId.template('push'));
    expect(await r.templates.remove(unused.id)).toBe('deleted');
    await r.executions.start({
      scheduledSessionId: null,
      templateId: seedId.template('upper_body'),
      type: 'gym',
      title: 'Upper Body',
      snapshot: snapshot(),
    });
    expect(await r.templates.remove(seedId.template('upper_body'))).toBe('archived');
    expect((await r.templates.get(seedId.template('upper_body'))).archivedAt).toBeTruthy();
  });
});

describe('schedule', () => {
  it('invariant 4: move keeps the original date and counts reschedules', async () => {
    const s = await session();
    await r.schedule.move(s.id, '2026-09-25', '19:00');
    await r.schedule.move(s.id, '2026-09-26');
    const moved = await r.schedule.getSession(s.id);
    expect(moved).toMatchObject({
      scheduledDate: '2026-09-26',
      startTime: '19:00',
      originalDate: '2026-09-24',
      originalStartTime: '18:00',
      rescheduleCount: 2,
      isException: false,
    });
    expect(await r.schedule.sessionsForDate('2026-09-24')).toEqual([]);
    expect(await r.schedule.sessionsForRange('2026-09-20', '2026-09-30')).toHaveLength(1);
  });

  it('marks moved rule occurrences as exceptions, and skips/cancels/duplicates', async () => {
    const rule = await r.schedule.rules.create({
      templateId: null,
      title: 'Run',
      type: 'running',
      freq: 'weekly',
      interval: 1,
      byWeekday: [2],
      byMonthDay: null,
      startDate: '2026-09-22',
      endDate: null,
      startTime: '07:00',
      durationMinutes: 30,
      reminderOffsetMinutes: null,
      active: true,
      materializedUntil: null,
    });
    const occ = await r.schedule.createOccurrence({
      ruleId: rule.id,
      templateId: null,
      title: 'Run',
      type: 'running',
      scheduledDate: '2026-09-29',
      startTime: '07:00',
      endTime: null,
      durationMinutes: 30,
      status: 'planned',
      originalDate: '2026-09-29',
      originalStartTime: '07:00',
      rescheduleCount: 0,
      isException: false,
      orderInDay: 0,
      reminderOffsetMinutes: null,
      skipReason: null,
      notes: null,
    });
    await r.schedule.move(occ.id, '2026-09-30');
    expect((await r.schedule.getSession(occ.id)).isException).toBe(true);
    await r.schedule.skip(occ.id, 'Tired');
    expect(await r.schedule.getSession(occ.id)).toMatchObject({
      status: 'skipped',
      skipReason: 'Tired',
    });
    const dup = await r.schedule.duplicate(occ.id, '2026-10-01');
    expect(dup).toMatchObject({ ruleId: null, status: 'planned', originalDate: '2026-10-01' });
    await r.schedule.cancel(dup.id);
    expect((await r.schedule.getSession(dup.id)).status).toBe('cancelled');
  });
});

describe('executions', () => {
  it('starts from a snapshot with pending actual rows and completes as modified', async () => {
    const s = await session();
    const x = await r.executions.start({
      scheduledSessionId: s.id,
      templateId: seedId.template('upper_body'),
      type: 'gym',
      title: 'Upper Body',
      snapshot: snapshot(),
    });
    expect((await r.schedule.getSession(s.id)).status).toBe('in_progress');
    const detail = await r.executions.get(x.id);
    expect(detail.exercises[0]!.sets.map((st) => st.status)).toEqual([
      'pending',
      'pending',
      'pending',
    ]);

    const [first] = detail.exercises[0]!.sets;
    await r.executions.logSet(first!.id, { actualReps: 10, actualWeightKg: 62.5 });
    await r.executions.substitute(
      detail.exercises[0]!.id,
      seedId.exercise('dumbbell_bench_press'),
      'Bench busy',
    );
    const extra = await r.executions.addSet(detail.exercises[0]!.id);
    expect(extra).toMatchObject({ setIndex: 3, isExtra: true });
    await r.executions.complete(x.id, {
      outcome: 'modified',
      activeSeconds: 2800,
      pausedSeconds: 60,
    });

    const done = await r.executions.get(x.id);
    expect(done.status).toBe('completed');
    expect(done.exercises[0]).toMatchObject({
      exerciseId: seedId.exercise('dumbbell_bench_press'),
      plannedExerciseId: seedId.exercise('bench_press'),
    });
    expect(done.plannedSnapshot).toEqual(snapshot()); // plan untouched (AD-07)
    expect((await r.schedule.getSession(s.id)).status).toBe('modified'); // invariant 3
    expect(await r.executions.getActive()).toBeNull();
  });

  it('invariant 1: only one active execution; invariant 2: rest is never executed', async () => {
    const input = {
      scheduledSessionId: null,
      templateId: null,
      type: 'gym' as const,
      title: 'Quick',
      snapshot: snapshot(),
    };
    await r.executions.start(input);
    await expect(r.executions.start(input)).rejects.toMatchObject({
      code: 'VALIDATION',
      userMessageKey: 'errors:EXECUTION_ACTIVE',
    });
    await expect(
      r.executions.start({ ...input, type: 'rest', isRetroactive: true }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('abandons back to planned and paginates history newest first', async () => {
    const s = await session();
    const x = await r.executions.start({
      scheduledSessionId: s.id,
      templateId: null,
      type: 'gym',
      title: 'A',
      snapshot: snapshot(),
    });
    await r.executions.abandon(x.id);
    expect((await r.schedule.getSession(s.id)).status).toBe('planned');
    for (let i = 0; i < 4; i++) {
      const e = await r.executions.start({
        scheduledSessionId: null,
        templateId: null,
        type: i % 2 ? 'running' : 'gym',
        title: `W${i}`,
        snapshot: snapshot(),
      });
      await r.executions.complete(e.id, {
        outcome: 'as_planned',
        activeSeconds: 60,
        pausedSeconds: 0,
      });
    }
    const p1 = await r.executions.listHistory({}, null, 2);
    const p2 = await r.executions.listHistory({}, p1.nextCursor, 2);
    const p3 = await r.executions.listHistory({}, p2.nextCursor, 2);
    expect([...p1.items, ...p2.items, ...p3.items].map((e) => e.title)).toEqual([
      'W3',
      'W2',
      'W1',
      'W0',
      'A',
    ]);
    expect(p3.nextCursor).toBeNull();
    expect(
      (await r.executions.listHistory({ types: ['running'] })).items.map((e) => e.title),
    ).toEqual(['W3', 'W1']);
  });

  it('logs running intervals', async () => {
    const x = await r.executions.start({
      scheduledSessionId: null,
      templateId: null,
      type: 'running',
      title: 'Run',
      snapshot: {
        ...snapshot(),
        type: 'running',
        exercises: [],
        intervals: [
          {
            orderIndex: 0,
            kind: 'warmup',
            durationSeconds: 300,
            speedKmh: 8,
            inclinePercent: 1,
            label: null,
          },
        ],
      },
    });
    const [log] = (await r.executions.get(x.id)).intervals;
    await r.executions.logInterval(log!.id, {
      actualDurationSeconds: 280,
      actualSpeedKmh: 8.5,
      status: 'partial',
    });
    expect((await r.executions.get(x.id)).intervals[0]).toMatchObject({
      plannedDurationSeconds: 300,
      actualDurationSeconds: 280,
      status: 'partial',
    });
  });
});

describe('body, photos, notifications', () => {
  it('lists weights by range, pages newest first and returns latest', async () => {
    for (const [i, v] of [75, 74.8, 74.6].entries()) {
      await r.weights.create({
        valueKg: v,
        unitEntered: 'kg',
        recordedAt: `2026-09-2${i}T07:00:00.000Z`,
        notes: null,
      });
    }
    expect(
      (await r.weights.list({ from: '2026-09-21T00:00:00.000Z' })).map((w) => w.valueKg),
    ).toEqual([74.8, 74.6]);
    expect((await r.weights.latest(1))[0]?.valueKg).toBe(74.6);
    const page = await r.weights.page(null, 2);
    expect(page.items.map((w) => w.valueKg)).toEqual([74.6, 74.8]);
    expect((await r.weights.page(page.nextCursor, 2)).items.map((w) => w.valueKg)).toEqual([75]);
    await expect(
      r.weights.create({
        valueKg: -3,
        unitEntered: 'kg',
        recordedAt: '2026-09-24T07:00:00.000Z',
        notes: null,
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('saves a measurement session atomically and returns the latest per type', async () => {
    const waist = seedId.measurementType('waist');
    const chest = seedId.measurementType('chest');
    await r.measurements.createSession(
      [{ measurementTypeId: waist, value: 84, unitEntered: 'cm' }],
      '2026-09-01T07:00:00.000Z',
    );
    await r.measurements.createSession(
      [
        { measurementTypeId: waist, value: 82.5, unitEntered: 'cm' },
        { measurementTypeId: chest, value: 101, unitEntered: 'cm' },
      ],
      '2026-09-20T07:00:00.000Z',
    );
    const latest = await r.measurements.latestPerType();
    expect(latest.find((m) => m.measurementTypeId === waist)?.value).toBe(82.5);
    expect(await r.measurements.list(waist)).toHaveLength(2);
    await expect(
      r.measurements.createSession([
        { measurementTypeId: chest, value: 99, unitEntered: 'cm' },
        { measurementTypeId: 'missing-type', value: 1, unitEntered: 'cm' },
      ]),
    ).rejects.toMatchObject({ code: 'DB_WRITE_FAILED' });
    expect(await r.measurements.list(chest)).toHaveLength(1); // nothing partial saved
    const custom = await r.measurements.types.create({
      slug: null,
      name: 'Forearm',
      kind: 'length',
      unitOther: null,
      orderIndex: 20,
    });
    expect((await r.measurements.types.list()).map((t) => t.id)).toContain(custom.id);
  });

  it('stores photo metadata, soft deletes and lists recently deleted', async () => {
    const p = await r.photos.create({
      category: 'body',
      subCategory: 'body.front',
      filePath: 'photos/body/2026/a.jpg',
      thumbPath: 'thumbs/a.jpg',
      width: 1000,
      height: 1500,
      bytes: 1000,
      capturedAt: '2026-09-24T07:00:00.000Z',
      weightEntryId: null,
      notes: null,
    });
    expect((await r.photos.list('body')).items).toHaveLength(1);
    await r.photos.softDelete(p.id);
    expect((await r.photos.list('body')).items).toHaveLength(0);
    expect((await r.photos.deleted()).map((x) => x.id)).toEqual([p.id]);
    expect((await r.photos.categories())[0]?.parentSlug).toBeNull();
  });

  it('maps OS notification ids and clears them by target', async () => {
    await r.notifications.insert({
      kind: 'session',
      targetId: 's1',
      osNotificationId: 'os-1',
      fireAt: '2026-09-24T17:45:00.000Z',
    });
    expect(await r.notifications.byTarget('s1')).toHaveLength(1);
    await r.notifications.deleteByTarget('s1');
    expect(await r.notifications.all()).toEqual([]);
  });
});

describe('remaining operations', () => {
  it('covers edits, archives, reorders and deletes across repositories', async () => {
    // exercises
    expect(
      (await r.exercises.search({ category: 'core' })).every((e) => e.category === 'core'),
    ).toBe(true);
    const all = await r.exercises.listWithEquipment();
    expect(all.find((e) => e.slug === 'bench_press')?.equipmentIds).toHaveLength(2);
    const bench = seedId.exercise('bench_press');
    await r.exercises.update(bench, { name: 'My Bench' }, [seedId.equipment('barbell')]);
    expect(await r.exercises.get(bench)).toMatchObject({
      name: 'My Bench',
      equipmentIds: [seedId.equipment('barbell')],
    });
    await r.exercises.archive(bench);
    await r.exercises.unarchive(bench);
    expect((await r.exercises.get(bench)).archivedAt).toBeNull();

    // equipment
    const eq = await r.equipment.create({
      slug: null,
      name: 'Sandbag',
      category: 'other',
      available: true,
      notes: null,
    });
    await r.equipment.update(eq.id, { notes: 'Garage' });
    await r.equipment.softDelete(eq.id);
    expect((await r.equipment.list()).some((e) => e.id === eq.id)).toBe(false);

    // goals
    const g = await r.goals.create({
      type: 'frequency',
      title: '4 sessions/week',
      targetValue: 4,
      unit: null,
      startValue: null,
      measurementTypeId: null,
      startDate: '2026-09-01',
      targetDate: null,
      status: 'active',
      achievedAt: null,
      notes: null,
    });
    await r.goals.update(g.id, { notes: 'Winter plan' });
    expect((await r.goals.get(g.id)).notes).toBe('Winter plan');

    // schedule rules and sessions
    const rule = await r.schedule.rules.create({
      templateId: null,
      title: 'Abs',
      type: 'abs',
      freq: 'daily',
      interval: 2,
      byWeekday: null,
      byMonthDay: null,
      startDate: '2026-09-24',
      endDate: null,
      startTime: null,
      durationMinutes: 12,
      reminderOffsetMinutes: null,
      active: true,
      materializedUntil: null,
    });
    await r.schedule.rules.update(rule.id, { active: false });
    expect((await r.schedule.rules.get(rule.id)).active).toBe(false);
    expect(await r.schedule.rules.list()).toHaveLength(1);
    await r.schedule.rules.softDelete(rule.id);
    expect(await r.schedule.rules.list()).toHaveLength(0);
    const a = await session();
    const b = await session();
    await r.schedule.reorderDay([b.id, a.id]);
    expect((await r.schedule.sessionsForDate('2026-09-24')).map((s) => s.id)).toEqual([b.id, a.id]);
    await r.schedule.edit(a.id, { notes: 'Heavy day' });
    expect((await r.schedule.getSession(a.id)).isException).toBe(true);
    await r.schedule.setStatus(a.id, 'completed');
    await r.schedule.softDelete(b.id);
    expect(await r.schedule.sessionsForDate('2026-09-24')).toHaveLength(1);

    // body
    const w = await r.weights.create({
      valueKg: 80,
      unitEntered: 'kg',
      recordedAt: '2026-09-24T07:00:00.000Z',
      notes: null,
    });
    await r.weights.update(w.id, { notes: 'After travel' });
    await r.weights.softDelete(w.id);
    expect(await r.weights.latest()).toEqual([]);
    const types = await r.measurements.types.list();
    await r.measurements.types.reorder(types.map((t) => t.id).reverse());
    expect((await r.measurements.types.list())[0]?.id).toBe(types.at(-1)?.id);
    await r.measurements.types.update(types[0]!.id, { name: 'Chest (relaxed)' });
    await r.measurements.types.archive(types[0]!.id);
    expect((await r.measurements.types.list()).some((t) => t.id === types[0]!.id)).toBe(false);
    expect((await r.measurements.types.list(true)).some((t) => t.id === types[0]!.id)).toBe(true);
    const [m] = await r.measurements.createSession([
      { measurementTypeId: seedId.measurementType('neck'), value: 38, unitEntered: 'cm' },
    ]);
    await r.measurements.update(m!.id, { value: 38.5 });
    await r.measurements.softDelete(m!.id);
    expect(await r.measurements.list(seedId.measurementType('neck'))).toEqual([]);

    // photos and notifications
    const p = await r.photos.create({
      category: 'hair',
      subCategory: 'hair.top',
      filePath: 'photos/hair/2026/b.jpg',
      thumbPath: 'thumbs/b.jpg',
      width: null,
      height: null,
      bytes: null,
      capturedAt: '2026-09-24T07:00:00.000Z',
      weightEntryId: null,
      notes: null,
    });
    await r.photos.updateNotes(p.id, 'Morning light');
    expect((await r.photos.get(p.id))?.notes).toBe('Morning light');
    await r.notifications.insert({
      kind: 'weight',
      targetId: null,
      osNotificationId: 'os-2',
      fireAt: '2026-09-25T07:00:00.000Z',
    });
    await r.notifications.insert({
      kind: 'photo',
      targetId: null,
      osNotificationId: 'os-3',
      fireAt: '2026-09-26T07:00:00.000Z',
    });
    await r.notifications.deleteByOsId('os-2');
    expect((await r.notifications.all()).map((n) => n.osNotificationId)).toEqual(['os-3']);
    await r.notifications.clear();
    expect(await r.notifications.all()).toEqual([]);
  });
});

describe('step 12: units and equipment impact', () => {
  it('switching units never changes stored values', async () => {
    await r.profile.upsert({ weightUnit: 'kg' });
    const w = await r.weights.create({
      valueKg: 74.6,
      unitEntered: 'kg',
      recordedAt: '2026-09-24T07:00:00.000Z',
      notes: null,
    });
    await r.profile.upsert({
      weightUnit: 'lb',
      lengthUnit: 'in',
      distanceUnit: 'mi',
      speedUnit: 'mph',
    });
    const row = await db.get<{ value_kg: number; unit_entered: string }>(
      'SELECT value_kg, unit_entered FROM weight_entries WHERE id = ?',
      [w.id],
    );
    expect(row).toEqual({ value_kg: 74.6, unit_entered: 'kg' });
    expect((await r.profile.get())?.weightUnit).toBe('lb');
  });

  it('counts exercises in active workouts that need each equipment item', async () => {
    const usage = await r.equipment.usage();
    // Cable machine: tricep_pushdown (Upper Body, Push, gym_push), face_pull (Pull),
    // overhead_cable_extension (gym_push), cable_one_arm_twisting_row (gym_pull).
    expect(usage[seedId.equipment('cable_machine')]).toEqual({ exercises: 4, templates: 5 });
    expect(usage[seedId.equipment('treadmill')]).toBeUndefined(); // runs use intervals, not exercises
    await r.templates.archive(seedId.template('pull'));
    expect((await r.equipment.usage())[seedId.equipment('cable_machine')]).toEqual({
      exercises: 3,
      templates: 4,
    });
  });
});

describe('step 13: duplicate as custom', () => {
  it('copies an exercise with its equipment and alternatives as a custom exercise', async () => {
    const copy = await r.exercises.duplicate(seedId.exercise('bench_press'), 'Bench Press (copy)');
    const detail = await r.exercises.get(copy.id);
    expect(detail).toMatchObject({
      name: 'Bench Press (copy)',
      isCustom: true,
      slug: null,
      category: 'chest',
    });
    expect(detail.equipmentIds.sort()).toEqual(
      [seedId.equipment('barbell'), seedId.equipment('flat_bench')].sort(),
    );
    expect(detail.alternatives.map((a) => a.alternativeId)).toEqual([
      seedId.exercise('dumbbell_bench_press'),
      seedId.exercise('chest_press_machine'),
      seedId.exercise('push_up'),
    ]);
  });
});

describe('step 14: template summaries', () => {
  it('lists exercise ids per template and interval counts for runs', async () => {
    const s = await r.templates.summaries();
    expect(s.exercises[seedId.template('upper_body')]).toHaveLength(6);
    expect(s.exercises[seedId.template('upper_body')]![0]).toBe(seedId.exercise('bench_press'));
    expect(s.intervals[seedId.template('interval_run_35')]).toBe(6);
    expect(s.exercises[seedId.template('run_30')]).toBeUndefined();
  });
});

describe('step 16: materialization and rule edits', () => {
  const weekly = {
    templateId: seedId.template('upper_body'),
    title: 'Upper Body',
    type: 'gym' as const,
    freq: 'weekly' as const,
    interval: 1,
    byWeekday: [1, 3, 5],
    byMonthDay: null,
    startDate: '2026-09-21',
    endDate: null,
    startTime: '18:00',
    durationMinutes: 55,
    reminderOffsetMinutes: 15,
    active: true,
    materializedUntil: null,
  };

  it('materializes 8 weeks from today and is idempotent', async () => {
    const rule = await r.schedule.createRule(weekly, '2026-09-24');
    const first = await r.schedule.sessionsForRange('2026-09-01', '2026-12-31');
    expect(first[0]).toMatchObject({
      scheduledDate: '2026-09-25',
      ruleId: rule.id,
      startTime: '18:00',
      status: 'planned',
    });
    expect(first.at(-1)!.scheduledDate <= '2026-11-19').toBe(true); // today + 56 days
    expect(first).toHaveLength(24); // 8 weeks × 3 days, from Fri 25 Sep
    expect(await r.schedule.materialize('2026-09-24')).toBe(0);
    expect((await r.schedule.rules.get(rule.id)).materializedUntil).toBe('2026-11-19');
  });

  it('extends the window when the planner looks further ahead', async () => {
    await r.schedule.createRule(weekly, '2026-09-24');
    await r.schedule.ensureMaterialized('2026-09-24', '2026-12-31');
    const dec = await r.schedule.sessionsForRange('2026-12-01', '2026-12-31');
    expect(dec.length).toBeGreaterThan(10);
  });

  it('never recreates what the user moved, skipped or deleted', async () => {
    const rule = await r.schedule.createRule(weekly, '2026-09-24');
    const [fri, mon, wed] = await r.schedule.sessionsForRange('2026-09-25', '2026-09-30');
    await r.schedule.move(fri!.id, '2026-09-26');
    await r.schedule.skip(mon!.id);
    await r.schedule.softDelete(wed!.id);
    await r.schedule.materialize('2026-09-24');
    const again = await r.schedule.sessionsForRange('2026-09-25', '2026-09-30');
    expect(again.map((x) => [x.scheduledDate, x.status])).toEqual([
      ['2026-09-26', 'planned'],
      ['2026-09-28', 'skipped'],
    ]);
    expect(rule.id).toBeTruthy();
  });

  it('rule edits change future planned occurrences only', async () => {
    const rule = await r.schedule.createRule(weekly, '2026-09-21');
    const [mon, wed, fri] = await r.schedule.sessionsForRange('2026-09-21', '2026-09-25');
    await r.schedule.setStatus(mon!.id, 'completed'); // past + done
    await r.schedule.move(fri!.id, '2026-09-26', '09:00'); // exception
    await r.schedule.updateRule(rule.id, { startTime: '07:00' }, '2026-09-23');
    const after = await r.schedule.sessionsForRange('2026-09-21', '2026-10-02');
    const byDate = Object.fromEntries(after.map((x) => [x.scheduledDate, x]));
    expect(byDate['2026-09-21']).toMatchObject({ status: 'completed', startTime: '18:00' });
    expect(byDate['2026-09-26']).toMatchObject({ startTime: '09:00', isException: true });
    expect(byDate['2026-09-23']).toMatchObject({ startTime: '07:00' }); // today onward regenerated
    expect(byDate['2026-09-28']).toMatchObject({ startTime: '07:00' });
    expect(wed).toBeTruthy();
  });

  it('deletes a rule from today, or stops it from a future date', async () => {
    const a = await r.schedule.createRule(weekly, '2026-09-24');
    await r.schedule.deleteRule(a.id, '2026-10-05', '2026-09-24');
    const stopped = await r.schedule.sessionsForRange('2026-09-24', '2026-12-31');
    expect(stopped.every((x) => x.scheduledDate < '2026-10-05')).toBe(true);
    expect((await r.schedule.rules.get(a.id)).endDate).toBe('2026-10-04');
    await r.schedule.deleteRule(a.id, '2026-09-24', '2026-09-24');
    expect(await r.schedule.sessionsForRange('2026-09-24', '2026-12-31')).toEqual([]);
    expect(await r.schedule.rules.list()).toEqual([]);
  });

  it('adds a planned rest day', async () => {
    const rest = await r.schedule.setRestDay('2026-09-27');
    expect(rest).toMatchObject({ type: 'rest', status: 'planned', originalDate: '2026-09-27' });
  });
});
