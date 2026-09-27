import { Directory, File, Paths } from 'expo-file-system';

import { logger } from '@/utils/logger';

import { type Database } from './client';

const KEEP = 2;

/**
 * Before migrating a non-empty database, copy it to `vyro.pre-m{N}.db` in the documents
 * directory and keep the two most recent copies (step 07).
 */
export async function makeSafetyCopy(db: Database, nextMigrationId: number): Promise<void> {
  try {
    // Flush the WAL into the main file so the copy is complete.
    await db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
    const source = new File(db.path);
    if (!source.exists) return;
    const target = new File(Paths.document, `vyro.pre-m${nextMigrationId}.db`);
    if (target.exists) target.delete();
    source.copy(target);

    const copies = new Directory(Paths.document)
      .list()
      .filter((f): f is File => f instanceof File && /^vyro\.pre-m\d+\.db$/.test(f.name))
      .sort((a, b) => Number(b.name.match(/\d+/)?.[0]) - Number(a.name.match(/\d+/)?.[0]));
    copies.slice(KEEP).forEach((f) => f.delete());
  } catch (e) {
    // A failed copy must not block the app; the migration itself is still transactional.
    logger.warn('Safety copy failed', { error: e });
  }
}

/** Copy of the database before an import (step 27), e.g. `vyro.pre-import.db`. */
export async function makeNamedSafetyCopy(db: Database, name: string): Promise<void> {
  await db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
  const source = new File(db.path);
  if (!source.exists) return;
  const target = new File(Paths.document, `vyro.${name}.db`);
  if (target.exists) target.delete();
  source.copy(target);
}
