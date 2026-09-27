import { type z } from 'zod';

import { openDatabase, type Database } from '../client';
import { fromRow, tables, toRow, type TableSpec } from '../mappers';
import { migrations } from '../migrations';
import { runMigrations } from '../migrations/runner';
import { openNodeDriver } from '../testing/nodeDriver';

const T = '2026-09-24T18:00:00.000Z';
const base = (id: string) => ({ id, createdAt: T, updatedAt: T, deletedAt: null });

/** One valid model per table, wired through their foreign keys (insert order matters). */
const fixtures: { [K in keyof typeof tables]: z.infer<(typeof tables)[K]['schema']> } = {
  userProfile: {
    ...base('u1'),
    name: 'Alex',
    heightCm: 180,
    dateOfBirth: null,
    weightUnit: 'kg',
    lengthUnit: 'cm',
    distanceUnit: 'km',
    speedUnit: 'kmh',
    weekStartsOn: 1,
    onboardingCompletedAt: T,
  },
  measurementTypes: {
    ...base('mt1'),
    slug: 'waist',
    name: 'Waist',
    kind: 'length',
    unitOther: null,
    orderIndex: 1,
    isCustom: false,
    archivedAt: null,
  },
  goals: {
    ...base('g1'),
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
  },
  equipment: {
    ...base('eq1'),
    slug: 'dumbbells',
    name: 'Dumbbells',
    category: 'free_weights',
    available: true,
    isCustom: false,
    notes: null,
    iconKey: null,
    imagePath: null,
  },
  exercises: {
    ...base('ex1'),
    slug: 'bench_press',
    name: 'Bench Press',
    category: 'chest',
    primaryMuscle: 'chest',
    secondaryMuscles: ['triceps', 'front_delts'],
    tracking: 'weight_reps',
    instructions: 'Lower to chest, press up.',
    defaultSets: 4,
    defaultReps: 10,
    defaultDurationSeconds: null,
    defaultRestSeconds: 90,
    difficulty: 'intermediate',
    isCustom: false,
    archivedAt: null,
  },
  exerciseEquipment: { exerciseId: 'ex1', equipmentId: 'eq1' },
  exerciseAlternatives: { exerciseId: 'ex1', alternativeId: 'ex1-alt', priority: 1, note: null },
  workoutTemplates: {
    ...base('tpl1'),
    name: 'Upper Body',
    type: 'gym',
    description: null,
    durationMinutes: 55,
    difficulty: 'intermediate',
    coverKey: null,
    distanceTargetKm: null,
    isSeed: true,
    archivedAt: null,
    notes: null,
  },
  templateExercises: {
    ...base('te1'),
    templateId: 'tpl1',
    exerciseId: 'ex1',
    orderIndex: 0,
    sets: 4,
    targetReps: 10,
    targetDurationSeconds: null,
    targetWeightKg: 60,
    restSeconds: 90,
    supersetGroup: null,
    notes: null,
  },
  templateIntervals: {
    ...base('ti1'),
    templateId: 'tpl1',
    orderIndex: 0,
    kind: 'warmup',
    durationSeconds: 300,
    speedKmh: 8,
    inclinePercent: 1,
    label: 'Warmup',
  },
  scheduleRules: {
    ...base('r1'),
    templateId: 'tpl1',
    title: 'Upper Body',
    type: 'gym',
    freq: 'weekly',
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
  },
  scheduledSessions: {
    ...base('s1'),
    ruleId: 'r1',
    templateId: 'tpl1',
    title: 'Upper Body',
    type: 'gym',
    scheduledDate: '2026-09-24',
    startTime: '18:00',
    endTime: null,
    durationMinutes: 55,
    status: 'planned',
    originalDate: '2026-09-24',
    originalStartTime: '18:00',
    rescheduleCount: 0,
    isException: false,
    orderInDay: 0,
    reminderOffsetMinutes: 15,
    skipReason: null,
    notes: null,
  },
  sessionExecutions: {
    ...base('x1'),
    scheduledSessionId: 's1',
    templateId: 'tpl1',
    type: 'gym',
    title: 'Upper Body',
    status: 'in_progress',
    outcome: null,
    startedAt: T,
    endedAt: null,
    activeSeconds: null,
    pausedSeconds: null,
    plannedSnapshot: {
      schemaVersion: 1,
      templateId: 'tpl1',
      name: 'Upper Body',
      type: 'gym',
      exercises: [
        {
          exerciseId: 'ex1',
          name: 'Bench Press',
          tracking: 'weight_reps',
          orderIndex: 0,
          sets: 4,
          targetReps: 10,
          targetDurationSeconds: null,
          targetWeightKg: 60,
          restSeconds: 90,
          notes: null,
        },
      ],
      intervals: [],
    },
    runtimeState: {
      schemaVersion: 1,
      kind: 'strength',
      lifecycle: 'active',
      startedAt: 0,
      pausedAt: null,
      accumulatedPauseMs: 0,
      autoRest: true,
      circuit: false,
      cursor: { exercise: 0, set: 1 },
      phase: 'working',
      rest: null,
      workTimer: null,
      current: null,
      tracking: { se1: 'weight_reps' },
      targets: {},
    },
    isRetroactive: false,
    perceivedEffort: null,
    distanceKm: null,
    notes: null,
  },
  sessionExercises: {
    ...base('se1'),
    executionId: 'x1',
    exerciseId: 'ex1-alt',
    plannedExerciseId: 'ex1',
    orderIndex: 0,
    plannedSets: 4,
    plannedReps: 10,
    plannedDurationSeconds: null,
    plannedWeightKg: 60,
    plannedRestSeconds: 90,
    status: 'active',
    substitutionReason: 'Machine busy',
    notes: null,
  },
  exerciseSets: {
    ...base('set1'),
    sessionExerciseId: 'se1',
    setIndex: 0,
    plannedReps: 10,
    plannedWeightKg: 60,
    plannedDurationSeconds: null,
    actualReps: 10,
    actualWeightKg: 62.5,
    actualDurationSeconds: null,
    restTakenSeconds: 95,
    status: 'done',
    isExtra: false,
    completedAt: T,
  },
  intervalLogs: {
    ...base('il1'),
    executionId: 'x1',
    orderIndex: 0,
    kind: 'run',
    label: null,
    plannedDurationSeconds: 600,
    plannedSpeedKmh: 9.7,
    plannedInclinePercent: 1,
    actualDurationSeconds: 540,
    actualSpeedKmh: 9.5,
    actualInclinePercent: 1,
    status: 'partial',
    isRepeat: false,
    startedAt: T,
    endedAt: T,
  },
  weightEntries: { ...base('w1'), valueKg: 74.6, unitEntered: 'kg', recordedAt: T, notes: null },
  bodyMeasurements: {
    ...base('bm1'),
    measurementTypeId: 'mt1',
    value: 82.5,
    unitEntered: 'cm',
    recordedAt: T,
    notes: null,
  },
  photoCategories: { slug: 'body', parentSlug: null, orderIndex: 0, name: null },
  progressPhotos: {
    ...base('p1'),
    category: 'body',
    subCategory: null,
    filePath: 'photos/body/2026/p1.jpg',
    thumbPath: 'thumbs/p1.jpg',
    width: 1536,
    height: 2048,
    bytes: 412000,
    capturedAt: T,
    weightEntryId: 'w1',
    notes: null,
  },
  notificationSchedules: {
    ...base('n1'),
    kind: 'session',
    targetId: 's1',
    osNotificationId: 'os-1',
    fireAt: T,
  },
  exerciseMedia: {
    ...base('em1'),
    exerciseId: 'ex1',
    kind: 'video',
    filePath: null,
    url: 'https://www.youtube.com/watch?v=abc123DEF45',
    orderIndex: 0,
  },
};

async function insert(db: Database, spec: TableSpec, model: object) {
  const row = toRow(spec, model);
  const cols = Object.keys(row);
  // Identifiers come from the static registry, never from user input.
  const sql =
    'INSERT INTO ' +
    spec.table +
    ' (' +
    cols.join(', ') +
    ') VALUES (' +
    cols.map(() => '?').join(', ') +
    ')';
  await db.run(sql, Object.values(row));
}

let db: Database;
beforeEach(async () => {
  db = await openDatabase(openNodeDriver());
  await runMigrations(db, migrations);
});
afterEach(() => db.driver.close());

describe('m001 schema', () => {
  it('creates every table and index, with no foreign key problems', async () => {
    const objects = await db.all<{ type: string; name: string }>(
      "SELECT type, name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'",
    );
    const tablesCreated = objects.filter((o) => o.type === 'table').map((o) => o.name);
    const indexes = objects.filter((o) => o.type === 'index' && o.name.startsWith('idx_'));
    // + schema_migrations (exercise_media from m003, 3 AI tables from m005)
    expect(tablesCreated).toHaveLength(23 + 1 + 3);
    expect(indexes).toHaveLength(15 + 2 + 1 + 3); // + m002 history, m003 media, m005 AI indexes
    expect(await db.all('PRAGMA foreign_key_check')).toEqual([]);
  });

  it.each(Object.entries(tables))('%s model fields match the table columns', async (_, spec) => {
    const columns = (await db.all<{ name: string }>('PRAGMA table_info(' + spec.table + ')'))
      .map((c) => c.name)
      .sort();
    const fields = Object.keys(spec.schema.shape)
      .map((f) => f.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`))
      .sort();
    expect(fields).toEqual(columns);
  });

  it('round-trips every table through SQL (model → row → SQL → row → model)', async () => {
    const alt = {
      ...fixtures.exercises,
      ...base('ex1-alt'),
      slug: 'db_bench',
      name: 'DB Bench Press',
    };
    await insert(db, tables.exercises, alt);
    for (const [name, spec] of Object.entries(tables) as [keyof typeof tables, TableSpec][]) {
      await insert(db, spec, fixtures[name]);
      const key = 'id' in fixtures[name] ? 'id' : Object.keys(fixtures[name])[0]!;
      const value = (fixtures[name] as Record<string, unknown>)[key];
      const column = key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
      const row = await db.get<Record<string, unknown>>(
        'SELECT * FROM ' + spec.table + ' WHERE ' + column + ' = ?',
        [value as string],
      );
      expect({ name, model: fromRow(spec, row!) }).toEqual({ name, model: fixtures[name] });
    }
    expect(await db.all('PRAGMA foreign_key_check')).toEqual([]);
  });
});

describe('validation', () => {
  it('rejects invalid enums, negative durations and relative-path violations', () => {
    expect(() =>
      toRow(tables.scheduledSessions, { ...fixtures.scheduledSessions, status: 'done' as never }),
    ).toThrow(expect.objectContaining({ code: 'VALIDATION' }));
    expect(() =>
      toRow(tables.templateIntervals, { ...fixtures.templateIntervals, durationSeconds: -5 }),
    ).toThrow(expect.objectContaining({ code: 'VALIDATION' }));
    expect(() =>
      toRow(tables.progressPhotos, { ...fixtures.progressPhotos, filePath: '/data/abs/p.jpg' }),
    ).toThrow(expect.objectContaining({ code: 'VALIDATION' }));
  });

  it('rejects malformed JSON when reading a row', () => {
    const row = toRow(tables.exercises, fixtures.exercises);
    expect(() => fromRow(tables.exercises, { ...row, secondary_muscles: '[not json' })).toThrow(
      expect.objectContaining({ code: 'VALIDATION' }),
    );
  });

  it('accepts partial updates', () => {
    expect(toRow(tables.goals, { status: 'achieved', achievedAt: T }, { partial: true })).toEqual({
      status: 'achieved',
      achieved_at: T,
    });
  });

  it('enforces CHECK constraints in SQL too', async () => {
    await expect(
      db.run(
        "INSERT INTO weight_entries (id, value_kg, unit_entered, recorded_at, created_at, updated_at) VALUES ('w', -1, 'kg', ?, ?, ?)",
        [T, T, T],
      ),
    ).rejects.toMatchObject({ code: 'DB_WRITE_FAILED' });
  });

  it('makes rule materialization idempotent with UNIQUE(rule_id, original_date)', async () => {
    for (const name of ['workoutTemplates', 'scheduleRules', 'scheduledSessions'] as const) {
      await insert(db, tables[name], fixtures[name]);
    }
    await expect(
      insert(db, tables.scheduledSessions, { ...fixtures.scheduledSessions, id: 's2' }),
    ).rejects.toMatchObject({ code: 'DB_WRITE_FAILED' });
  });
});
