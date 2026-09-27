import { type Database } from '@/db/client';
import { fromRow, tables } from '@/db/mappers';

import { schemaVersion } from './export';
import {
  BACKUP_FORMAT,
  BackupError,
  checksumOf,
  FORMAT_VERSION,
  TABLES,
  type Backup,
  type Row,
  type TableName,
} from './format';
import { upgrade, type RawBackup } from './upgraders';

const SPEC_BY_TABLE = new Map<string, (typeof tables)[keyof typeof tables]>(
  Object.values(tables).map((s) => [s.table, s]),
);

type Fk = { from: string; table: string; to: string };

export async function foreignKeys(db: Database): Promise<Record<string, Fk[]>> {
  const out: Record<string, Fk[]> = {};
  for (const t of TABLES)
    out[t] = await db.all<Fk>('SELECT "from", "table", "to" FROM pragma_foreign_key_list(?)', [t]);
  return out;
}

/** Parse + upgrade + validate (format, version, checksum, rows, references). Never writes. */
export async function readBackup(
  text: string,
  db: Database,
  opts: { strategy: 'merge' | 'replace' },
): Promise<Backup> {
  let raw: RawBackup;
  try {
    raw = JSON.parse(text) as RawBackup;
  } catch {
    throw new BackupError('PARSE');
  }
  if (raw.format !== BACKUP_FORMAT || typeof raw.data !== 'object' || raw.data === null)
    throw new BackupError('NOT_BACKUP');
  const version = typeof raw.formatVersion === 'number' ? raw.formatVersion : 0;
  if (
    version > FORMAT_VERSION ||
    (typeof raw.schemaVersion === 'number' && raw.schemaVersion > (await schemaVersion(db)))
  ) {
    throw new BackupError('NEWER_VERSION');
  }
  if (typeof raw.checksum === 'string' && checksumOf(raw.data) !== raw.checksum)
    throw new BackupError('CHECKSUM');
  if (version === FORMAT_VERSION && typeof raw.checksum !== 'string')
    throw new BackupError('CHECKSUM');
  const up = upgrade(raw, FORMAT_VERSION);
  const data = {} as Record<TableName, Row[]>;
  const src = up.data as Record<string, unknown>;
  for (const t of TABLES) {
    const rows = src[t] ?? [];
    if (!Array.isArray(rows)) throw new BackupError('INVALID_ROW', t);
    data[t] = rows as Row[];
  }
  validateRows(data);
  await validateReferences(data, db, opts.strategy);
  return {
    format: BACKUP_FORMAT,
    formatVersion: FORMAT_VERSION,
    appVersion: String(up.appVersion ?? ''),
    schemaVersion: Number(up.schemaVersion ?? 0),
    exportedAt: String(up.exportedAt ?? ''),
    includesPhotos: up.includesPhotos === true,
    counts: Object.fromEntries(TABLES.map((t) => [t, data[t].length])),
    data,
    checksum: checksumOf(data),
  };
}

function validateRows(data: Record<TableName, Row[]>) {
  for (const t of TABLES) {
    const spec = SPEC_BY_TABLE.get(t);
    for (const row of data[t]) {
      if (t === 'app_settings') {
        if (typeof row.key !== 'string' || typeof row.value !== 'string')
          throw new BackupError('INVALID_ROW', t);
        continue;
      }
      if (!spec) continue;
      try {
        // Each table spec validates its own row shape (union of specs → erase the generic).
        fromRow(spec as never, row);
      } catch {
        throw new BackupError('INVALID_ROW', t);
      }
    }
  }
}

/** Every foreign key resolves inside the backup, or (merge) in the local database. */
async function validateReferences(
  data: Record<TableName, Row[]>,
  db: Database,
  strategy: 'merge' | 'replace',
) {
  const fks = await foreignKeys(db);
  const keysIn = new Map<string, Set<string>>();
  const keys = async (table: string, col: string) => {
    const k = `${table}.${col}`;
    let set = keysIn.get(k);
    if (!set) {
      set = new Set((data[table as TableName] ?? []).map((r) => String(r[col])));
      if (strategy === 'merge') {
        for (const r of await db.all<Row>('SELECT ' + col + ' AS v FROM ' + table))
          set.add(String(r.v));
      }
      keysIn.set(k, set);
    }
    return set;
  };
  for (const t of TABLES) {
    for (const fk of fks[t] ?? []) {
      const set = await keys(fk.table, fk.to);
      for (const row of data[t]) {
        const v = row[fk.from];
        if (v !== null && v !== undefined && !set.has(String(v)))
          throw new BackupError('FOREIGN_KEY', `${t}.${fk.from}`);
      }
    }
  }
}
