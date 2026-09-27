import { File } from 'expo-file-system';
import { deleteDatabaseAsync } from 'expo-sqlite';

import { type Database } from './client';

export type DbInfo = {
  migrations: { id: number; name: string; applied_at: string }[];
  tables: { name: string; rows: number }[];
  fileBytes: number | null;
  path: string;
};

/** Read-only introspection for the dev DB screen (step 07). */
export async function inspectDatabase(db: Database): Promise<DbInfo> {
  const migrations = await db.all<DbInfo['migrations'][number]>(
    'SELECT id, name, applied_at FROM schema_migrations ORDER BY id',
  );
  const names = await db.all<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  const tables = [];
  for (const { name } of names) {
    // Table names come from sqlite_master, not user input; identifiers can't be bound.
    const quoted = `"${name.replace(/"/g, '""')}"`;
    const row = await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM ' + quoted);
    tables.push({ name, rows: row?.n ?? 0 });
  }
  let fileBytes: number | null = null;
  try {
    const file = new File(db.path);
    fileBytes = file.exists ? file.size : null;
  } catch {
    fileBytes = null;
  }
  return { migrations, tables, fileBytes, path: db.path };
}

/** Dev only: closes and deletes the database. The caller reloads the app. */
export async function resetDatabase(db: Database, name: string): Promise<void> {
  await db.driver.close();
  await deleteDatabaseAsync(name);
}
