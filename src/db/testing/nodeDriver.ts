import BetterSqlite3 from 'better-sqlite3';

import { type SqlDriver, type SqlExecutor, type SqlParams } from '../driver';

/**
 * better-sqlite3 implementation of SqlDriver for Jest. Same SQL engine as the device,
 * synchronous under the hood, exposed through the async contract.
 */
export function openNodeDriver(path = ':memory:'): SqlDriver {
  const db = new BetterSqlite3(path);
  const exec: SqlExecutor = {
    exec: async (sql) => {
      db.exec(sql);
    },
    run: async (sql, params: SqlParams = []) => {
      const r = db.prepare(sql).run(...(params as unknown[]));
      return { changes: r.changes, lastInsertRowId: Number(r.lastInsertRowid) };
    },
    all: async <T>(sql: string, params: SqlParams = []) =>
      db.prepare(sql).all(...(params as unknown[])) as T[],
    get: async <T>(sql: string, params: SqlParams = []) =>
      (db.prepare(sql).get(...(params as unknown[])) as T | undefined) ?? null,
  };
  return {
    ...exec,
    transaction: async <T>(task: (tx: SqlExecutor) => Promise<T>) => {
      db.exec('BEGIN IMMEDIATE');
      try {
        const result = await task(exec);
        db.exec('COMMIT');
        return result;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
    path,
    close: async () => {
      db.close();
    },
  };
}
