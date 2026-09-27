import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { logger } from '@/utils/logger';

import { openDatabase, type Database } from './client';
import { openExpoDriver } from './drivers/expo';
import { migrations } from './migrations';
import { runMigrations, type MigrationReport } from './migrations/runner';
import { makeSafetyCopy } from './safetyCopy';
import { seedDatabase } from './seed/seed';

export const DATABASE_NAME = 'vyro.db';

export type DatabaseStatus =
  | { state: 'opening' }
  | { state: 'ready'; db: Database; report: MigrationReport }
  | { state: 'error'; error: unknown };

const DatabaseContext = createContext<DatabaseStatus>({ state: 'opening' });

/** Extra startup work run after migrations and seeding (settings hydration in step 10). */
export type StartupTask = (db: Database) => Promise<void>;
const startupTasks: StartupTask[] = [];
export const registerStartupTask = (task: StartupTask) => {
  startupTasks.push(task);
};

let opened: Promise<{ db: Database; report: MigrationReport }> | null = null;

/** Startup: open → pragmas → migrations → seed → startup tasks. Runs once per app process. */
export function initDatabase() {
  opened ??= (async () => {
    const t0 = Date.now();
    const db = await openDatabase(await openExpoDriver(DATABASE_NAME));
    const report = await runMigrations(db, migrations, {
      beforeMigrate: (nextId) => makeSafetyCopy(db, nextId),
    });
    const seed = await seedDatabase(db);
    for (const task of startupTasks) await task(db);
    logger.info('Database ready', {
      ms: Date.now() - t0,
      applied: report.applied,
      seeded: seed.inserted,
    });
    return { db, report };
  })();
  // Allow a retry after a failure.
  opened.catch(() => {
    opened = null;
  });
  return opened;
}

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<DatabaseStatus>({ state: 'opening' });

  useEffect(() => {
    let alive = true;
    initDatabase().then(
      ({ db, report }) => alive && setStatus({ state: 'ready', db, report }),
      (error: unknown) => alive && setStatus({ state: 'error', error }),
    );
    return () => {
      alive = false;
    };
  }, []);

  return <DatabaseContext.Provider value={status}>{children}</DatabaseContext.Provider>;
}

export const useDatabaseStatus = (): DatabaseStatus => useContext(DatabaseContext);

/** The open database. Only valid below DatabaseGate (which renders children only when ready). */
export function useDatabase(): Database {
  const status = useDatabaseStatus();
  if (status.state !== 'ready') throw new Error('useDatabase used before the database was ready');
  return status.db;
}
