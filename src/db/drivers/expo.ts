import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import { type SqlDriver, type SqlExecutor, type SqlParams } from '../driver';

function executor(db: SQLiteDatabase): SqlExecutor {
  return {
    exec: (sql) => db.execAsync(sql),
    run: async (sql, params: SqlParams = []) => {
      const r = await db.runAsync(sql, params as never[]);
      return { changes: r.changes, lastInsertRowId: r.lastInsertRowId };
    },
    all: <T>(sql: string, params: SqlParams = []) => db.getAllAsync<T>(sql, params as never[]),
    get: async <T>(sql: string, params: SqlParams = []) =>
      (await db.getFirstAsync<T>(sql, params as never[])) ?? null,
  };
}

/** Opens the app database with the expo-sqlite async API (SDK 57). */
export async function openExpoDriver(name: string): Promise<SqlDriver> {
  const db = await openDatabaseAsync(name);
  return {
    ...executor(db),
    // Exclusive on device: unrelated queries issued meanwhile are NOT pulled into the
    // transaction. Web (alpha, preview only) lacks it, so it uses a regular transaction.
    transaction: async <T>(task: (tx: SqlExecutor) => Promise<T>) => {
      let result: T | undefined;
      if (Platform.OS === 'web') {
        await db.withTransactionAsync(async () => {
          result = await task(executor(db));
        });
      } else {
        await db.withExclusiveTransactionAsync(async (txn) => {
          result = await task(executor(txn));
        });
      }
      return result as T;
    },
    path: db.databasePath,
    close: () => db.closeAsync(),
  };
}
