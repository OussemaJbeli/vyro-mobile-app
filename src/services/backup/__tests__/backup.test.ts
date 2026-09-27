import { openDatabase, type Database } from '@/db/client';
import { migrations } from '@/db/migrations';
import { runMigrations } from '@/db/migrations/runner';
import { createRepositories, type Repositories } from '@/db/repositories';
import { seedId } from '@/db/seed/ids';
import { seedDatabase } from '@/db/seed/seed';
import { openNodeDriver } from '@/db/testing/nodeDriver';
import { setClock } from '@/utils/clock';

import { buildBackup } from '../export';
import { BackupError, checksumOf, type Backup } from '../format';
import { applyBackup } from '../import';
import { readBackup } from '../validate';

let db: Database;
let r: Repositories;
let tick = 0;

beforeEach(async () => {
  tick = 0;
  setClock(() => new Date(Date.UTC(2026, 8, 20, 12, 0, tick++)));
  db = await openDatabase(openNodeDriver());
  await runMigrations(db, migrations);
  await seedDatabase(db, { now: '2026-09-20T00:00:00.000Z' });
  r = createRepositories(db);
  await r.weights.create({
    valueKg: 80,
    unitEntered: 'kg',
    recordedAt: '2026-09-19T07:00:00.000Z',
    notes: null,
  });
  await r.weights.create({
    valueKg: 79.5,
    unitEntered: 'kg',
    recordedAt: '2026-09-20T07:00:00.000Z',
    notes: 'fasted',
  });
  const x = await r.executions.start({
    scheduledSessionId: null,
    templateId: null,
    type: 'gym',
    title: 'Bench day',
    snapshot: {
      schemaVersion: 1,
      templateId: null,
      name: 'Bench day',
      type: 'gym',
      exercises: [
        {
          exerciseId: seedId.exercise('bench_press'),
          name: 'Bench',
          tracking: 'weight_reps',
          orderIndex: 0,
          sets: 2,
          targetReps: 10,
          targetDurationSeconds: null,
          targetWeightKg: 60,
          restSeconds: 90,
          notes: null,
        },
      ],
      intervals: [],
    },
  });
  await r.executions.complete(x.id, { outcome: 'partial', activeSeconds: 600, pausedSeconds: 0 });
  await r.exerciseMedia.add({
    exerciseId: seedId.exercise('bench_press'),
    kind: 'video',
    filePath: null,
    url: 'https://youtu.be/dQw4w9WgXcQ',
  });
});
afterEach(async () => {
  setClock(null);
  await db.driver.close();
});

const opts = { appVersion: '0.1.0', includesPhotos: false, now: new Date('2026-09-21T10:00:00Z') };
const wipe = async () => {
  for (const t of ['exercise_sets', 'session_exercises', 'session_executions', 'weight_entries'])
    await db.run('DELETE FROM ' + t);
};

describe('backup', () => {
  it('round trip: export → wipe → import (replace) → identical data', async () => {
    const original = await buildBackup(db, opts);
    expect(original.counts.weight_entries).toBe(2);
    expect(original.checksum).toBe(checksumOf(original.data));
    await wipe();
    const parsed = await readBackup(JSON.stringify(original), db, { strategy: 'replace' });
    await applyBackup(db, parsed, 'replace');
    const again = await buildBackup(db, opts);
    expect(again.data).toEqual(original.data);
  });

  it('merge adds missing rows and keeps the newer updated_at on conflict', async () => {
    const backup = await buildBackup(db, opts);
    const [w1, w2] = backup.data.weight_entries;
    // Local edit newer than the backup → kept; backup row newer than local → applied.
    await db.run('UPDATE weight_entries SET notes = ?, updated_at = ? WHERE id = ?', [
      'local',
      '2026-12-01T00:00:00.000Z',
      String(w1!.id),
    ]);
    const edited = {
      ...backup,
      data: {
        ...backup.data,
        weight_entries: [
          w1!,
          { ...w2!, notes: 'from backup', updated_at: '2027-01-01T00:00:00.000Z' },
        ],
      },
    };
    await db.run('DELETE FROM exercise_sets');
    const parsed = await readBackup(
      JSON.stringify({ ...edited, checksum: checksumOf(edited.data) }),
      db,
      { strategy: 'merge' },
    );
    const res = await applyBackup(db, parsed, 'merge');
    expect(res.inserted).toBe(2); // the deleted sets
    const rows = await db.all<{ id: string; notes: string | null }>(
      'SELECT id, notes FROM weight_entries ORDER BY recorded_at',
    );
    expect(rows.map((x) => x.notes)).toEqual(['local', 'from backup']);
  });

  it('rejects a damaged file (checksum), a newer version and broken references — nothing changes', async () => {
    const backup = await buildBackup(db, opts);
    const damaged = {
      ...backup,
      data: {
        ...backup.data,
        weight_entries: [{ ...backup.data.weight_entries[0]!, value_kg: 55 }],
      },
    };
    await expect(
      readBackup(JSON.stringify(damaged), db, { strategy: 'merge' }),
    ).rejects.toMatchObject({ code: 'CHECKSUM' });
    await expect(
      readBackup(JSON.stringify({ ...backup, formatVersion: 99 }), db, { strategy: 'merge' }),
    ).rejects.toMatchObject({ code: 'NEWER_VERSION' });
    await expect(readBackup('not json', db, { strategy: 'merge' })).rejects.toBeInstanceOf(
      BackupError,
    );
    await expect(
      readBackup(JSON.stringify({ hello: 1 }), db, { strategy: 'merge' }),
    ).rejects.toMatchObject({ code: 'NOT_BACKUP' });
    const orphan = {
      ...backup.data,
      exercise_sets: [{ ...backup.data.exercise_sets[0]!, session_exercise_id: 'missing' }],
    };
    await expect(
      readBackup(JSON.stringify({ ...backup, data: orphan, checksum: checksumOf(orphan) }), db, {
        strategy: 'replace',
      }),
    ).rejects.toMatchObject({ code: 'FOREIGN_KEY' });
    const bad = {
      ...backup.data,
      weight_entries: [{ ...backup.data.weight_entries[0]!, value_kg: -3 }],
    };
    await expect(
      readBackup(JSON.stringify({ ...backup, data: bad, checksum: checksumOf(bad) }), db, {
        strategy: 'replace',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_ROW' });
    expect((await db.all('SELECT id FROM weight_entries')).length).toBe(2);
  });

  it('upgrades an older format (0: "weights" key, no checksum)', async () => {
    const backup = await buildBackup(db, opts);
    const { weight_entries: weights, ...rest } = backup.data;
    const v0 = {
      format: 'vyro-backup',
      formatVersion: 0,
      schemaVersion: 1,
      exportedAt: backup.exportedAt,
      data: { ...rest, weights },
    };
    await wipe();
    const parsed: Backup = await readBackup(JSON.stringify(v0), db, { strategy: 'replace' });
    expect(parsed.formatVersion).toBe(1);
    expect(parsed.data.weight_entries).toHaveLength(2);
    await applyBackup(db, parsed, 'replace');
    expect((await db.all('SELECT id FROM weight_entries')).length).toBe(2);
  });
});
