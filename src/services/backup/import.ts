import { type Database, type Db } from '@/db/client';

import { TABLES, type Backup, type Row } from './format';

export type ImportResult = { inserted: number; updated: number; skipped: number };

type Column = { name: string; pk: number };

async function columns(db: Db, table: string): Promise<Column[]> {
  return db.all<Column>('SELECT name, pk FROM pragma_table_info(?)', [table]);
}

/**
 * Applies a validated backup in ONE transaction (step 27, FS §60).
 * - replace: wipe local data (children first), then restore everything;
 * - merge: add missing records; on id conflict keep the newer `updated_at`.
 * Unknown columns in the file are ignored (forward-compatible rows).
 */
export async function applyBackup(
  db: Database,
  backup: Backup,
  strategy: 'merge' | 'replace',
  onProgress?: (done: number, total: number) => void,
): Promise<ImportResult> {
  const total = TABLES.reduce((n, t) => n + backup.data[t].length, 0);
  const result: ImportResult = { inserted: 0, updated: 0, skipped: 0 };
  let done = 0;
  await db.tx(async (tx) => {
    if (strategy === 'replace') {
      await tx.run('DELETE FROM notification_schedules');
      for (const t of [...TABLES].reverse()) await tx.run('DELETE FROM ' + t);
    }
    for (const t of TABLES) {
      const cols = await columns(tx, t);
      const names = new Set(cols.map((c) => c.name));
      const pk = cols.filter((c) => c.pk > 0).map((c) => c.name);
      const single = pk.length === 1 ? pk[0]! : null;
      for (const raw of backup.data[t]) {
        const row: Row = Object.fromEntries(Object.entries(raw).filter(([k]) => names.has(k)));
        const keys = Object.keys(row);
        const insert = (verb: string) =>
          tx.run(
            verb +
              ' INTO ' +
              t +
              ' (' +
              keys.join(', ') +
              ') VALUES (' +
              keys.map(() => '?').join(', ') +
              ')',
            keys.map((k) => row[k] ?? null),
          );
        if (strategy === 'replace') {
          await insert('INSERT');
          result.inserted++;
        } else if (single && names.has('updated_at')) {
          const local = await tx.get<{ updated_at: string }>(
            'SELECT updated_at FROM ' + t + ' WHERE ' + single + ' = ?',
            [row[single] ?? null],
          );
          if (!local) {
            await insert('INSERT');
            result.inserted++;
          } else if (String(row.updated_at ?? '') > local.updated_at) {
            const set = keys.filter((k) => k !== single);
            await tx.run(
              'UPDATE ' +
                t +
                ' SET ' +
                set.map((k) => k + ' = ?').join(', ') +
                ' WHERE ' +
                single +
                ' = ?',
              [...set.map((k) => row[k] ?? null), row[single] ?? null],
            );
            result.updated++;
          } else result.skipped++;
        } else {
          const r = await insert('INSERT OR IGNORE');
          if (r.changes > 0) result.inserted++;
          else result.skipped++;
        }
        done++;
        if (onProgress && (done % 200 === 0 || done === total)) onProgress(done, total);
      }
    }
  });
  return result;
}
