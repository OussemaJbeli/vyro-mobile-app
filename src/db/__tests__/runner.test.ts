import { openDatabase, type Database } from '../client';
import { type Migration } from '../migrations';
import { migrationChecksum } from '../migrations/checksum';
import { runMigrations } from '../migrations/runner';

import { openNodeDriver } from '../testing/nodeDriver';

const m1: Migration = {
  id: 1,
  name: 'initial',
  statements: ['CREATE TABLE a (id TEXT PRIMARY KEY, v INTEGER)'],
};
const m2: Migration = {
  id: 2,
  name: 'add_b',
  statements: ['CREATE TABLE b (id TEXT PRIMARY KEY)', "INSERT INTO b (id) VALUES ('x')"],
};
const broken: Migration = {
  id: 3,
  name: 'broken',
  statements: ['CREATE TABLE c (id TEXT)', 'THIS IS NOT SQL'],
};

const tables = async (db: Database) =>
  (
    await db.all<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
    )
  ).map((r) => r.name);

let db: Database;
beforeEach(async () => {
  db = await openDatabase(openNodeDriver());
});
afterEach(() => db.driver.close());

describe('migration runner', () => {
  it('applies everything on a fresh install and sets user_version', async () => {
    const report = await runMigrations(db, [m1, m2]);
    expect(report.applied).toEqual([1, 2]);
    expect(await tables(db)).toEqual(['a', 'b', 'schema_migrations']);
    expect(await db.get<{ user_version: number }>('PRAGMA user_version')).toEqual({
      user_version: 2,
    });
  });

  it('is a no-op when re-run', async () => {
    await runMigrations(db, [m1, m2]);
    const report = await runMigrations(db, [m1, m2]);
    expect(report.applied).toEqual([]);
    expect(report.alreadyApplied).toEqual([1, 2]);
    expect(await db.get<{ n: number }>('SELECT COUNT(*) n FROM b')).toEqual({ n: 1 });
  });

  it('rolls back a failing migration and keeps earlier ones', async () => {
    await expect(runMigrations(db, [m1, m2, broken])).rejects.toMatchObject({
      code: 'DB_WRITE_FAILED',
      userMessageKey: 'errors:MIGRATION_FAILED',
    });
    expect(await tables(db)).toEqual(['a', 'b', 'schema_migrations']); // no table "c"
    const applied = await db.all<{ id: number }>('SELECT id FROM schema_migrations ORDER BY id');
    expect(applied.map((r) => r.id)).toEqual([1, 2]);
  });

  it('makes a safety copy only when upgrading an existing database', async () => {
    const beforeMigrate = jest.fn(async () => {});
    await runMigrations(db, [m1], { beforeMigrate });
    expect(beforeMigrate).not.toHaveBeenCalled(); // fresh install
    await runMigrations(db, [m1, m2], { beforeMigrate });
    expect(beforeMigrate).toHaveBeenCalledWith(2);
  });

  it('rejects out-of-order ids', async () => {
    await expect(runMigrations(db, [m2])).rejects.toThrow('ids must be 1..n');
  });

  it('detects edits through the checksum', () => {
    const edited = { ...m1, statements: ['CREATE TABLE a (id TEXT PRIMARY KEY, v TEXT)'] };
    expect(migrationChecksum(edited)).not.toBe(migrationChecksum(m1));
    expect(migrationChecksum({ ...m1 })).toBe(migrationChecksum(m1));
  });
});

describe('database client', () => {
  it('commits transactions and rolls back on throw (no partial rows, FS §61)', async () => {
    await runMigrations(db, [m1]);
    await db.tx(async (tx) => {
      await tx.run('INSERT INTO a (id, v) VALUES (?, ?)', ['1', 1]);
    });
    await expect(
      db.tx(async (tx) => {
        await tx.run('INSERT INTO a (id, v) VALUES (?, ?)', ['2', 2]);
        throw new Error('forced failure mid-transaction');
      }),
    ).rejects.toThrow('forced failure');
    expect(await db.all<{ id: string }>('SELECT id FROM a')).toEqual([{ id: '1' }]);
  });

  it('wraps SQL errors in AppError without leaking parameter values', async () => {
    await runMigrations(db, [m1]);
    await db.run('INSERT INTO a (id, v) VALUES (?, ?)', ['dup', 1]);
    const error = await db
      .run('INSERT INTO a (id, v) VALUES (?, ?)', ['dup', 74.6])
      .catch((e) => e);
    expect(error).toMatchObject({ code: 'DB_WRITE_FAILED' });
    expect(JSON.stringify(error.context)).not.toContain('74.6');
    await expect(db.all('SELECT * FROM missing')).rejects.toMatchObject({ code: 'DB_READ_FAILED' });
  });

  it('enables foreign keys through the pragmas', async () => {
    expect(await db.get<{ foreign_keys: number }>('PRAGMA foreign_keys')).toEqual({
      foreign_keys: 1,
    });
  });
});
