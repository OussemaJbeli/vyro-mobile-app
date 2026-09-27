import { AppError } from '@/utils/errors';
import { logger } from '@/utils/logger';

import { type Database } from '../client';

import { type Migration } from './types';

export type MigrationReport = {
  applied: number[];
  alreadyApplied: number[];
  schemaVersion: number;
};

export type RunnerOptions = {
  /** Called once before the first pending migration when the DB already has migrations. */
  beforeMigrate?: (nextId: number) => Promise<void>;
  now?: () => string;
};

const BOOKKEEPING = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL
  );
`;

function assertOrdered(migrations: readonly Migration[]) {
  migrations.forEach((m, i) => {
    if (m.id !== i + 1) {
      throw new Error(`Migration ids must be 1..n in order; found ${m.id} at position ${i + 1}`);
    }
  });
}

/**
 * Applies pending migrations in order, each in its own transaction. Stops at the first
 * failure; earlier migrations stay applied and the app shows a blocking error instead of
 * running on a half-migrated schema.
 */
export async function runMigrations(
  db: Database,
  migrations: readonly Migration[],
  opts: RunnerOptions = {},
): Promise<MigrationReport> {
  assertOrdered(migrations);
  await db.exec(BOOKKEEPING);
  const done = new Set(
    (await db.all<{ id: number }>('SELECT id FROM schema_migrations ORDER BY id')).map((r) => r.id),
  );
  const pending = migrations.filter((m) => !done.has(m.id));
  const now = opts.now ?? (() => new Date().toISOString());

  if (pending.length > 0 && done.size > 0 && opts.beforeMigrate) {
    await opts.beforeMigrate(pending[0]!.id);
  }

  const applied: number[] = [];
  for (const m of pending) {
    try {
      await db.tx(async (tx) => {
        for (const statement of m.statements) await tx.exec(statement);
        await tx.run('INSERT INTO schema_migrations (id, name, applied_at) VALUES (?, ?, ?)', [
          m.id,
          m.name,
          now(),
        ]);
      });
    } catch (e) {
      logger.error('Migration failed', {
        id: m.id,
        name: m.name,
        reason: e instanceof Error ? e.message : String(e),
      });
      throw new AppError('DB_WRITE_FAILED', `Migration ${m.id} (${m.name}) failed`, {
        cause: e,
        userMessageKey: 'errors:MIGRATION_FAILED',
        context: { migrationId: m.id },
      });
    }
    applied.push(m.id);
  }

  const schemaVersion = migrations.length;
  // user_version mirrors the table for external tools. PRAGMA values can't be bound.
  await db.exec(`PRAGMA user_version = ${Number(schemaVersion) | 0};`);
  return { applied, alreadyApplied: [...done].sort((a, b) => a - b), schemaVersion };
}
