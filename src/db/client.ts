import { AppError, type AppErrorCode } from '@/utils/errors';
import { logger } from '@/utils/logger';

import { type RunResult, type SqlDriver, type SqlExecutor, type SqlParams } from './driver';

/** First words of a statement for logs. Parameter values are never logged (FS §63). */
const describe = (sql: string) => sql.replace(/\s+/g, ' ').trim().slice(0, 80);

function wrap(e: unknown, sql: string, code: AppErrorCode): AppError {
  if (e instanceof AppError) return e;
  const message = e instanceof Error ? e.message : String(e);
  logger.error('SQL failed', { sql: describe(sql), message });
  return new AppError(code, message, { cause: e, context: { sql: describe(sql) } });
}

/** Typed query helpers with error wrapping. Parameter binding only: never interpolate values. */
export class Db implements SqlExecutor {
  constructor(private readonly x: SqlExecutor) {}

  async exec(sql: string): Promise<void> {
    try {
      await this.x.exec(sql);
    } catch (e) {
      throw wrap(e, sql, 'DB_WRITE_FAILED');
    }
  }

  async run(sql: string, params: SqlParams = []): Promise<RunResult> {
    try {
      return await this.x.run(sql, params);
    } catch (e) {
      throw wrap(e, sql, 'DB_WRITE_FAILED');
    }
  }

  async all<T>(sql: string, params: SqlParams = []): Promise<T[]> {
    try {
      return await this.x.all<T>(sql, params);
    } catch (e) {
      throw wrap(e, sql, 'DB_READ_FAILED');
    }
  }

  async get<T>(sql: string, params: SqlParams = []): Promise<T | null> {
    try {
      return await this.x.get<T>(sql, params);
    } catch (e) {
      throw wrap(e, sql, 'DB_READ_FAILED');
    }
  }
}

/** The app's database: typed helpers plus transactions. */
export class Database extends Db {
  constructor(readonly driver: SqlDriver) {
    super(driver);
  }

  /** All-or-nothing writes (FS §61): a throw inside `task` rolls everything back. */
  tx<T>(task: (tx: Db) => Promise<T>): Promise<T> {
    return this.driver.transaction((raw) => task(new Db(raw)));
  }

  get path(): string {
    return this.driver.path;
  }
}

export const PRAGMAS = `
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;
`;

/** Opens a driver and applies connection pragmas. One shared connection per app. */
export async function openDatabase(driver: SqlDriver): Promise<Database> {
  const db = new Database(driver);
  await db.exec(PRAGMAS);
  return db;
}
