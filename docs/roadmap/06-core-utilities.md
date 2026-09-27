# 06 — Core Utilities: i18n, Units, Dates, Errors, Logging

| | |
|---|---|
| Milestone | M0 Foundation |
| Depends on | 01 |
| Spec refs | FS §57, §61, §63 · UI §36 · AD-05, AD-06, AD-15 |
| Output | Pure, tested helpers every feature relies on |

## Objective

Solve the cross-cutting concerns once: translation, unit conversion, local-date maths, human-friendly errors and privacy-safe logging. Bugs here spread everywhere, so this step is heavily unit-tested.

## Tasks

### 1. i18n (`src/i18n/`)

- [x] `i18next` + `react-i18next`. Initial language from `expo-localization`, overridable in settings.
- [x] Namespaces per feature: `common, nav, onboarding, home, train, start, execution, running, plan, progress, body, photos, history, analytics, settings, notifications, errors, ai`.
- [x] Locale files `en/*.json` and `fr/*.json`. A test fails if any key exists in one language and not the other.
- [x] Pluralization (`{{count}} exercises`), interpolation, and date/number formatting via `Intl` with the selected locale.
- [x] A `t()` wrapper type-checks keys (i18next TypeScript resources declaration).

### 2. Units (`src/utils/units.ts`)

Canonical storage per AD-06:

| Quantity | Canonical | Display options |
|---|---|---|
| Body weight / load | kg | kg, lb |
| Length (height, measurements) | cm | cm, in (height also ft′in″) |
| Distance | km | km, mi |
| Speed | km/h | km/h, mph |
| Incline | % | % |

- [x] `toCanonical(value, unit)`, `fromCanonical(value, unit)` and `formatQuantity(value, kind, prefs, locale)`.
- [x] Rounding rules: weight 0.1, load 0.5 kg / 1 lb step, speed 0.1, length 0.1 (0.25 in).
- [x] **Round-trip test**: entering 165 lb, storing in kg and displaying in lb shows 165.0, not 164.9.
- [x] Pace helper: speed ↔ min/km or min/mi.

### 3. Dates (`src/utils/dates.ts`)

- [x] Types: `LocalDate` (branded `'YYYY-MM-DD'` string), `LocalTime` (`'HH:mm'`), `IsoInstant` (UTC ISO string).
- [x] `today()`, `toLocalDate(instant)`, `combine(localDate, localTime) → Date`, `addDays`, `startOfWeek(date, weekStartsOn)`, `weekDays()`, `monthGrid()`, `isPast(localDate)`.
- [x] `greeting(now)` → morning / afternoon / evening / night keys.
- [x] `formatDuration(seconds)` → "45 min", "1h 36m", "02:41". `formatClock(ms)` for timers.
- [x] Tests around DST transitions and week starts (Monday vs Sunday).

### 4. Errors (`src/utils/errors.ts`)

- [x] `AppError` with `code` (`DB_WRITE_FAILED`, `VALIDATION`, `NOT_FOUND`, `PERMISSION_DENIED`, `FILE_IO`, `IMPORT_INVALID`, `NOTIFICATION_FAILED`, `UNKNOWN`), `userMessageKey`, `cause` and `context`.
- [x] `toUserMessage(err)` returns translated human text, for example "We couldn't save this workout. Your existing session was not changed." (FS §57).
- [x] A `Result<T, AppError>` type for repository and service returns, so callers must handle failure.

### 5. Logger (`src/utils/logger.ts`)

- [x] Levels debug/info/warn/error. In release builds only warn/error are kept, in an in-memory ring buffer of about 200 entries, viewable at `dev/db` and exportable in diagnostics.
- [x] **Redaction:** the logger drops keys that match `weight|kg|lb|value|measurement|photo|uri|path|apiKey|token|pin|note` (FS §63). A unit test proves it.
- [x] No third-party crash or analytics SDK in V1.

### 6. Misc

- [x] `src/utils/id.ts` → `newId()` using `expo-crypto` `randomUUID()`.
- [x] `src/utils/clock.ts` → injectable `now()` so tests and the execution engine can control time.
- [x] `src/constants/featureFlags.ts` → `{ ai: false, devTools: __DEV__ }`.

## Acceptance criteria

- [x] At least 95 % test coverage on `units.ts` and `dates.ts`.
- [x] Switching the device to French shows the placeholder screens in French.
- [x] The key parity test and the redaction test pass.

## Execution log (2026-09-25)

- **i18n:** a dedicated i18next instance (`createInstance`) in `src/i18n`, provided by `I18nextProvider` in the root layout. Device language comes from `expo-localization` (fallback English), and `setLanguage('system' | 'en' | 'fr')` applies instantly. Keys are typed through `i18next.d.ts`.
- **Namespaces now:** common, nav, status, placeholder, home, execution, settings, errors (EN and FR). The other feature namespaces (train, plan, progress…) are added by the step that builds each feature, in `src/i18n/resources.ts`. The parity test enforces identical keys in both languages.
- All user-facing strings in shipped components moved to i18n: tab labels, FAB states, status tags, placeholders, Home, Settings, the pause sheet, the error screen, and accessibility labels (back, close, steppers, streak, avatar). The dev-only screens stay English. `src/constants/statusLabels.ts` was removed (StatusTag reads the `status` namespace).
- **Units** (`src/utils/units.ts`): canonical values are stored unrounded, so 165 lb → kg → 165 lb is exact. Display rounding is set per kind (load 0.5 kg / 1 lb, length 0.1 cm / 0.25 in). Height in inches shows as 5′11″. Numbers are formatted with `Intl` (French shows 74,6 kg). Pace helpers included.
- **Dates** (`src/utils/dates.ts`): branded `LocalDate` / `LocalTime` / `IsoInstant`, parsed as local midnight (never UTC). Calendar arithmetic is DST-safe. Also week and month grids, greeting key, `formatDuration`, `formatClock`. Tests run in a fixed `America/Toronto` timezone (`jest.global-setup.js`) and cover both 2026 DST transitions.
- **Errors:** `AppError` (code, `userMessageKey`, cause, context), `toAppError`, `toUserMessage(err, t)`, and `Result` with `ok` / `err`.
- **Logger:** leveled, with redaction by key pattern (weight, value, measurement, photo, uri, path, apiKey, token, pin, note…), a 200-entry ring buffer, and warn/error only in release. The ErrorBoundary now logs through it.
- `src/utils/id.ts` (`newId`, UUID v4 via expo-crypto) and `src/utils/clock.ts` (injectable `now()`).
- Coverage: `units.ts` and `dates.ts` at 100 % lines.
