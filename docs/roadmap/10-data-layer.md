# 10 — Repositories, Stores & Data Hooks

| | |
|---|---|
| Milestone | M0 Foundation |
| Depends on | 08, 09 |
| Spec refs | FS §6 (state), §49, §61, §62 · AD-03, AD-12 |
| Output | Typed repositories for every aggregate, a tiny query/invalidation layer, domain Zustand stores, and settings persistence |

## Objective

UI never touches SQL (FS §49). Screens read data through hooks that cache, refetch on invalidation and expose loading/error states. Mutations go through repositories that validate with Zod, run in transactions and emit invalidation events.

## Architecture

```text
Screen ── useWorkoutTemplates() ──► queryCache (key: ['templates', filter])
   │                                     ▲
   └─ templateRepo.create(input) ──► db.tx ──► emit invalidate(['templates'])
```

A dependency such as TanStack Query is acceptable, but a ~150-line local cache is enough and avoids extra weight. **Decision:** use `@tanstack/react-query` if it works offline without configuration friction (`networkMode: 'always'`). It is battle-tested for cache and invalidation and works fine with a local async source. Otherwise write the small internal cache. Record the choice in this file.

## Tasks

### 1. Repositories (`src/db/repositories/`)

One file per aggregate. Each returns `Result<T, AppError>` or throws `AppError`; choose one convention and apply it everywhere.

| Repository | Key methods |
|---|---|
| `profileRepo` | `get()`, `upsert(input)`, `completeOnboarding()` |
| `settingsRepo` | `get<K>(key)`, `set<K>(key, value)`, typed key registry (`theme`, `accent`, `language`, `haptics`, `notifications.*`, `lock.*`, `seed_version`, `ai.*`) |
| `goalRepo` | `list(status?)`, `get`, `create`, `update`, `setStatus`, `softDelete` |
| `equipmentRepo` | `list()`, `setAvailable(id, bool)`, `create`, `update`, `softDelete` |
| `exerciseRepo` | `search({ q, category, equipmentAvailableOnly })`, `get(id)` (with equipment + alternatives), `create`, `update`, `archive`, `setAlternatives(id, list)` |
| `templateRepo` | `list({ type, q, includeArchived })`, `get(id)` (with exercises or intervals), `create`, `update` (replace child rows in a tx), `duplicate(id)`, `archive`, `softDelete` (guarded by invariant 5) |
| `scheduleRepo` | `rules.*`, `sessionsForRange(from, to)`, `sessionsForDate(date)`, `create`, `move`, `duplicate`, `skip`, `cancel`, `setStatus`, `materialize(until)` (logic lives in step 16) |
| `executionRepo` | `getActive()`, `start(snapshot)`, `saveRuntimeState`, `logSet`, `logInterval`, `substitute`, `complete`, `abandon`, `get(id)` with children, `listHistory(filter, cursor)` |
| `weightRepo` | `list(range)`, `latest(n)`, `create`, `update`, `softDelete` |
| `measurementRepo` | `types.*`, `list(typeId, range)`, `latestPerType()`, `create`, `update`, `softDelete` |
| `photoRepo` | `list(category, cursor)`, `get`, `create(meta)`, `update(notes)`, `softDelete` (file removal in step 23) |
| `notificationRepo` | `upsert`, `byTarget`, `deleteByTarget`, `all()` |

Rules:

- [x] All writes set `updated_at`. Creates set `id` and `created_at`.
- [x] Every input is validated with the Zod input schema before SQL.
- [x] List methods use **cursor pagination** (`recorded_at < ?` / `started_at < ?` plus a limit) for anything that can grow unbounded (history, weights, photos) (FS §62).
- [x] Read queries select explicit columns, never `SELECT *`.
- [x] Soft-deleted rows are excluded by default. An `includeDeleted` flag exists for backup only.

### 2. Query hooks (`src/hooks/data/`)

- [x] `useProfile`, `useSettings`, `useGoals`, `useEquipment`, `useExercises(filter)`, `useExercise(id)`, `useTemplates(filter)`, `useTemplate(id)`, `useSessionsForDate(date)`, `useSessionsForRange`, `useActiveExecution`, `useHistory(filter)`, `useWeights(range)`, `useMeasurements`, `usePhotos(category)`.
- [x] Mutation hooks wrap repo calls, show a Toast on failure through `toUserMessage`, and invalidate keys.
- [x] A central `queryKeys.ts` registry. Mutations declare which keys they invalidate. Cross-aggregate invalidation is documented (for example, completing an execution invalidates `sessions`, `history`, `analytics`, `streak` and `home`).

### 3. Zustand stores (`src/store/`)

For ephemeral or UI state only. Persistent truth stays in SQLite.

| Store | Holds |
|---|---|
| `settingsStore` | Hydrated settings mirror (theme, accent, units, language, haptics) for synchronous reads in render |
| `plannerStore` | Selected date, view mode (day/week/month) |
| `executionStore` | Live runtime state of the active execution (step 17 connects it to the engine and persistence) |
| `uiStore` | Global sheets and toasts queue |

- [x] Use selectors (`useStore(s => s.x)`) everywhere to avoid global re-renders.
- [x] `settingsStore` hydrates from `settingsRepo` at startup, before the splash hides. The theme and i18n providers read from it. Remove the step 03 in-memory default.

### 4. Tests

- [x] Repository tests against the Node SQLite adapter from step 07. Cover CRUD, soft delete, pagination, invariants 1, 4 and 5 from step 08, and validation errors.
- [x] Hook tests for loading → data → invalidation → refetch.

## Acceptance criteria

- [x] No file under `src/components` or `src/app/` imports `@/db`. Lint enforces it.
- [x] Changing the accent in `dev/theme` persists across an app restart.
- [x] Repository test suite passes with at least 85 % coverage.

## Execution log (2026-09-25)

- **Cache/invalidation decision: TanStack Query** (`@tanstack/react-query`), configured local-first: `networkMode: 'always'`, `staleTime: Infinity`, no retries or refetch-on-focus. Freshness comes only from explicit invalidation.
- **Repositories** (`src/db/repositories/`): profile, settings, goals, equipment, exercises, templates, schedule, executions, weights, measurements, photos, notifications, built by `createRepositories(db)`. **Convention: return data or throw `AppError`** (not `Result`). Shared helpers in `base.ts` build explicit column lists (never `SELECT *`), insert/patch/soft-delete with timestamps, and cursor pagination (`time|id` cursors, so equal timestamps are neither skipped nor repeated).
- Invariants enforced and tested: **1** a single in-progress execution (`errors:EXECUTION_ACTIVE`); **2** rest sessions can't be executed; **3** completion sets the scheduled session to completed/modified and abandon restores planned; **4** move keeps `original_date`, increments `reschedule_count`, and marks rule occurrences as exceptions; **5** `templates.remove()` archives when history references the template.
- `executions.start()` freezes the snapshot and creates pending `session_exercises` / `exercise_sets` / `running_interval_logs` in one transaction. Substitution keeps `planned_exercise_id`.
- **Settings:** typed registry in `src/types/settings.ts` (Zod schema + default per key). `settingsRepo` falls back to the default for corrupt values. `useSettingsStore` (Zustand) is hydrated by `src/hooks/bootstrap.ts` before the splash hides, writes through to SQLite, and rolls back if a save fails. Language and haptics apply automatically. **ThemeProvider now reads theme and accent from the store**, so both persist across restarts (checked with a headless reload on web).
- Stores: `settingsStore`, `plannerStore` (selected date and view), `executionStore` (rehydrated from the active execution at startup; the step 17 engine drives it), `uiStore`, `startStore`.
- Hooks (`src/hooks/data/`): `RepositoriesProvider` (inside DatabaseGate), `useRepositories`, read hooks for every aggregate (`useHistory` and `usePhotos` are infinite queries), and `useRepoMutation` (invalidates declared roots, shows a human error toast). Keys and the cross-aggregate invalidation contract live in `queryKeys.ts`.
- Rule materialization is **not** here: step 16 builds it on `scheduleRepo.createOccurrence` (idempotent through `UNIQUE(rule_id, original_date)`).
- Tests: 20 repository tests (CRUD, soft delete, pagination, invariants, validation, atomic measurement sessions), a hook test (loading → data → mutation → refetch, plus the error toast), and settings store tests (write-through and rollback). **Repository coverage: 97 % lines.**
- Jest: `expo-crypto`'s `randomUUID` is mocked to Node's real UUID (jest-expo returned `undefined`).
