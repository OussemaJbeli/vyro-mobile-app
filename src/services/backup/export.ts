import { type Database } from '@/db/client';

import {
  BACKUP_FORMAT,
  checksumOf,
  EXCLUDED_SETTINGS,
  FORMAT_VERSION,
  TABLES,
  type Backup,
  type Row,
  type TableName,
} from './format';

export async function schemaVersion(db: Database): Promise<number> {
  return (await db.get<{ v: number | null }>('SELECT MAX(id) AS v FROM schema_migrations'))?.v ?? 0;
}

/**
 * Builds the backup (step 27). In-progress executions are exported as abandoned (their
 * runtime state is device-specific); notification ids are never exported.
 */
export async function buildBackup(
  db: Database,
  opts: { appVersion: string; includesPhotos: boolean; now?: Date },
): Promise<Backup> {
  const now = (opts.now ?? new Date()).toISOString();
  const data = {} as Record<TableName, Row[]>;
  for (const table of TABLES) {
    let rows = await db.all<Row>('SELECT * FROM ' + table + ' ORDER BY rowid');
    if (table === 'app_settings')
      rows = rows.filter((r) => !EXCLUDED_SETTINGS.includes(String(r.key)));
    if (table === 'session_executions') {
      rows = rows.map((r) =>
        r.status === 'in_progress'
          ? { ...r, status: 'abandoned', runtime_state: null, ended_at: r.ended_at ?? now }
          : r,
      );
    }
    if (table === 'photo_categories') {
      rows = [...rows].sort(
        (a, b) => (a.parent_slug === null ? 0 : 1) - (b.parent_slug === null ? 0 : 1),
      );
    }
    data[table] = rows;
  }
  return {
    format: BACKUP_FORMAT,
    formatVersion: FORMAT_VERSION,
    appVersion: opts.appVersion,
    schemaVersion: await schemaVersion(db),
    exportedAt: now,
    includesPhotos: opts.includesPhotos,
    counts: Object.fromEntries(TABLES.map((t) => [t, data[t].length])),
    data,
    checksum: checksumOf(data),
  };
}
