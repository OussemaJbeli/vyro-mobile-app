/**
 * Minimal SQL driver contract. The app uses the expo-sqlite driver; Jest uses a
 * better-sqlite3 driver with the same behaviour, so repositories and migrations are
 * tested against a real SQLite engine in Node.
 */
export type SqlValue = string | number | null | Uint8Array;
export type SqlParams = readonly SqlValue[];

export type RunResult = { changes: number; lastInsertRowId: number };

export interface SqlExecutor {
  /** Multiple statements, no parameters. Only for trusted DDL (migrations, pragmas). */
  exec(sql: string): Promise<void>;
  run(sql: string, params?: SqlParams): Promise<RunResult>;
  all<T>(sql: string, params?: SqlParams): Promise<T[]>;
  get<T>(sql: string, params?: SqlParams): Promise<T | null>;
}

export interface SqlDriver extends SqlExecutor {
  /**
   * Runs `task` in an exclusive transaction: only queries made through `tx` belong to it.
   * Commits when `task` resolves, rolls back when it throws.
   */
  transaction<T>(task: (tx: SqlExecutor) => Promise<T>): Promise<T>;
  /** Absolute path of the database file (for safety copies and diagnostics). */
  readonly path: string;
  close(): Promise<void>;
}
