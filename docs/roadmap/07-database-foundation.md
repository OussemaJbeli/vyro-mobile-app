# 07 — Database Engine & Migrations

| | |
|---|---|
| Milestone | M0 Foundation |
| Depends on | 06 |
| Spec refs | FS §7, §49, §50, §61, §62, §65 · AD-03, AD-04 |
| Output | `src/db/client.ts`, a migration runner, transaction helpers, and a DB debug screen |

## Objective

Provide a safe, fast and migratable SQLite engine. After this step, schema changes are always additive migrations. The database is never dropped and recreated (FS §50).

## Tasks

### 1. Client (`src/db/client.ts`)

- [x] Open `vyro.db` with the `expo-sqlite` async API (`openDatabaseAsync`, or `SQLiteProvider` + `useSQLiteContext`; pick one and use it everywhere).
- [x] On open, run the pragmas:
  ```sql
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;
  ```
- [x] Typed wrappers: `all<T>(sql, params)`, `get<T>`, `run`, and `tx(async (db) => …)`. `tx` uses `withExclusiveTransactionAsync` (or the SDK's equivalent) and rolls back on throw, so partial failures never persist (FS §61).
- [x] Parameter binding only. A lint/grep check forbids template literals inside SQL calls.
- [x] Every DB error is wrapped in `AppError('DB_WRITE_FAILED' | …)` with the SQL (no parameter values) in the log context.

### 2. Migration runner (`src/db/migrations/`)

```text
migrations/
├── index.ts          ordered array: [m001_initial, m002_…]
├── m001_initial.ts   export default { id: 1, name: 'initial', up: async (db) => {…} }
└── runner.ts
```

- [x] Track state in a `schema_migrations(id INTEGER PRIMARY KEY, name TEXT, applied_at TEXT)` table (clearer than `user_version` alone; also set `user_version` for tooling).
- [x] At startup, apply each pending migration **in its own transaction**, in order. Stop on the first failure and show a blocking human error screen with "Export diagnostics". Never continue on a half-migrated schema.
- [x] **Pre-migration safety copy:** before applying migrations to a non-empty database, copy `vyro.db` to `vyro.pre-m{N}.db` in the documents folder and keep the last two copies.
- [x] Migrations are append-only. Once released, a migration file is never edited. A test compares a checksum list (`migrations.lock.json`).

### 3. Startup sequence

```text
open DB → pragmas → run migrations → run seed (if needed, step 09) → load settings → hide splash
```

- [x] Expose a `DatabaseProvider` with `ready | migrating | error` states. The root layout keeps the splash until `ready`.
- [x] Measure startup time in dev logs. The target is under 400 ms for warm start with seed data.

### 4. Dev DB screen (`src/app/dev/db.tsx`)

- [x] Shows applied migrations, table row counts, DB file size and the log ring buffer.
- [x] Actions: "Reset DB" (dev only, with confirm), "Load large demo dataset" (button present, disabled until step 28), "Export DB file".

### 5. Tests

- [x] Use an in-memory or temp SQLite for Jest (mock `expo-sqlite` with `better-sqlite3` behind the same wrapper interface, so repository tests run in Node).
- [x] Runner tests: fresh install applies all; re-run is a no-op; a failing migration rolls back and leaves earlier migrations intact; the checksum lock detects edits.

## Acceptance criteria

- [x] A fresh install creates the DB and applies `m001` (which can be empty until step 08).
- [x] Killing the app mid-transaction leaves no partial rows (tested with a forced throw).
- [x] The dev DB screen shows correct info.

## Pitfalls

- `expo-sqlite` APIs changed across SDKs (legacy vs `next`). Use only the current async API.
- Do not open multiple connections in parallel from different modules. Use one shared client.

## Execution log (2026-09-25)

- **Driver contract** (`src/db/driver.ts`): `exec / run / all / get / transaction / path / close`. `drivers/expo.ts` wraps the expo-sqlite SDK 57 async API. `testing/nodeDriver.ts` wraps better-sqlite3 (dev dependency, never bundled), so Jest runs the same SQL on a real SQLite engine.
- **Client** (`src/db/client.ts`): `Database` with typed `all / get / run / exec` and `tx()`. Errors become `AppError` (`DB_WRITE_FAILED` / `DB_READ_FAILED`), and only the first 80 characters of the SQL are logged, never the parameter values. Pragmas: WAL, foreign_keys ON, busy_timeout 5000.
- **Migrations are plain SQL** (`{ id, name, statements[] }`). They are checksummed (FNV-1a) into `migrations.lock.json`, and `lock.test.ts` fails if a recorded migration changes. `pnpm db:lock` records new migrations. The runner applies each pending migration in its own transaction, tracks them in `schema_migrations`, mirrors `PRAGMA user_version`, and stops on the first failure with `errors:MIGRATION_FAILED`.
- **Safety copy:** before upgrading a non-empty database, it checkpoints the WAL and copies to `Documents/vyro.pre-m{N}.db`, keeping the last 2. A failed copy only warns.
- **Startup:** `DatabaseProvider` (in `src/db`, re-exported for UI through `src/hooks/database.ts`) runs open → pragmas → migrations → registered startup tasks (seed in step 09, settings in step 10). `DatabaseGate` keeps the native splash up until the database is ready, or shows a blocking error with "Export diagnostics" (`src/services/diagnostics.ts`, redacted logs only).
- **Lint:** in `src/db/**`, interpolated template literals in `run / all / get` calls are errors (bind parameters instead).
- **Web preview:** `metro.config.js` adds `.wasm` assets and COOP/COEP headers. On web the driver uses `withTransactionAsync`, because `withExclusiveTransactionAsync` is not supported there. Devices keep exclusive transactions.
- Dev screen `/dev/db` (linked from the Home dev panel) shows migrations, table row counts, file size and recent logs, with Export DB and Reset DB.
- Verified with a headless web launch: the database opens, migration 1 applies, Home renders, and there are zero console errors. That launch caught the web transaction issue above.
