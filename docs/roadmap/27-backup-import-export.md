# 27 — Backup, Export & Import

| | |
|---|---|
| Milestone | M3 Platform services |
| Depends on | 24 |
| Spec refs | FS §59, §60, §61 · UI §39 |
| Output | Versioned JSON export, an optional ZIP with photos, validated import with a preview, and merge/replace strategies |

## Objective

Local-only data needs a reliable way out and back in (FS §59). Import must never silently destroy data (FS §60).

## Backup format

```jsonc
// vyro-backup-2026-09-24.json
{
  "format": "vyro-backup",
  "formatVersion": 1,
  "appVersion": "1.0.0",
  "schemaVersion": 1,                // migrations applied
  "exportedAt": "2026-09-24T19:10:00Z",
  "includesPhotos": false,
  "counts": { "weight_entries": 212, "session_executions": 148, "...": 0 },
  "data": {
    "user_profile": [...], "app_settings": [...], "goals": [...], "equipment": [...],
    "exercises": [...], "exercise_equipment": [...], "exercise_alternatives": [...],
    "workout_templates": [...], "workout_template_exercises": [...], "template_running_intervals": [...],
    "schedule_rules": [...], "scheduled_sessions": [...], "session_executions": [...],
    "session_exercises": [...], "exercise_sets": [...], "running_interval_logs": [...],
    "weight_entries": [...], "measurement_types": [...], "body_measurements": [...],
    "photo_categories": [...], "progress_photos": [...]   // metadata only unless includesPhotos
  },
  "checksum": "sha256:…"              // over the canonical JSON of "data"
}
```

- Excluded: `notification_schedules` (rebuilt by reconcile), lock secrets, AI keys, and `runtime_state` of in-progress executions (finish or abandon first, or it is exported as abandoned).
- Photo metadata is included by default (dates, categories) **without files**. With photos: a ZIP (`fflate`, pure JS) containing `data.json` plus `photos/<relative path>` and `thumbs/`. This is an explicit opt-in with a warning (FS §59).

## Export flow (`settings/backup`)

- [x] Options: "Data only (recommended)" and "Data + photos (large, contains private images)" with a size estimate.
- [x] Build the file in the cache directory, then share through `expo-sharing` (save to Files, Drive…). Delete the temp file afterwards.
- [x] Show the last backup date. An optional reminder is "Remind me to back up monthly" (a notification category from step 25).
- [ ] Optional passphrase encryption of the ZIP/JSON (AES-GCM through a pure JS lib such as `@noble/ciphers`). **Deferred (optional stretch)** — see the execution log.

## Import flow

```text
Pick file (expo-document-picker) → parse → validate (format, version, checksum, Zod per table)
 → PREVIEW: "Backup from 24 Sep 2026 · 148 workouts · 212 weigh-ins · 0 photos"
 → Strategy:  ( ) Merge — add missing records, keep newer on conflict (by id + updated_at)
              ( ) Replace — wipe local data, then restore (requires typing REPLACE)
 → Safety copy of the current DB (as in step 07) → apply in ONE transaction → reconcile notifications → done
```

- [x] Validation errors are human and specific: "This file is from a newer version of VYRO. Update the app to import it." or "The file is damaged (checksum mismatch)."
- [x] **Forward migration of backups:** `formatVersion` or `schemaVersion` lower than current → run backup transformers (`src/services/backup/upgraders/`) before import. Higher → refuse.
- [x] Referential integrity is checked before writing (every FK resolves inside the backup or in the local DB for merge).
- [x] Photos in a ZIP are written to private storage first. On failure, roll back the DB and remove the written files.
- [x] A progress indicator for large imports. The UI stays responsive (chunked inserts inside the transaction).

## Tasks

- [x] `src/services/backup/{export,import,validate,merge,upgraders}.ts` with tests: round trip (export → wipe → import → deep-equal data), merge conflict resolution, a corrupted checksum, a newer version rejected, an older version upgraded, and FK violation detection.
- [x] Settings UI with the confirmations from FS §60 ("This will add/replace local data. [Cancel] [Continue]").

## Acceptance criteria

- [x] A round trip on a device reproduces identical history, analytics and photos (with the ZIP).
- [x] Importing a damaged file changes nothing and explains why.
- [x] Replace requires explicit confirmation, and a safety copy exists afterwards.

## Execution log

**2026-09-26 — Done** (encryption deferred as the spec allows).

- **Format** `services/backup/format.ts`:
  - `vyro-backup` v1 with raw rows per table in dependency order (parents first, photo categories root-first).
  - `checksum: sha256:` over canonical JSON (sorted keys) of `data` (`@noble/hashes`). Counts, app version, schema version (max applied migration).
  - Excluded: `notification_schedules` (rebuilt by reconcile) and `onboarding.draft`. Lock secrets live in SecureStore, not the DB, so they are never exported.
  - In-progress executions are exported as **abandoned** without runtime state.
- **Export** `export.ts` + `files.ts`:
  - "Data only (recommended)" writes a JSON file.
  - "Data + photos" (opt-in, warning) writes a ZIP (`fflate`, pure JS) with `data.json` and `files/photos/…` / `files/thumbs/…`.
  - Built in the cache dir → `expo-sharing` → the temp file is deleted. A size estimate is shown, and `backup.lastAt` is recorded.
- **Monthly reminder**: `notifications.backup` in the step 25 engine, due 30 days after the last backup (tomorrow if never) at 10:00, quiet-shifted. It reuses the `weekly_summary` kind with a `backup:<date>` target, because the table's CHECK constraint lists kinds and a migration isn't worth it for bookkeeping.
- **Import** `validate.ts` + `import.ts`: pick (`expo-document-picker`, .json/.zip) → parse → **upgrade** older formats (`upgraders.ts`; format 0 fixture) → refuse newer format/schema → checksum → **Zod validation of every row** (table mappers) → **referential integrity**, derived generically from `PRAGMA foreign_key_list`: within the backup for replace, backup + local DB for merge → **preview** ("Backup from … · N workouts · N weigh-ins · N photos").
  - Strategies: **Merge** (insert missing; on id conflict keep the newer `updated_at`; key-only tables insert-or-ignore) or **Replace** (type REPLACE + confirmation dialog; wipe children-first, then restore).
  - Order: **named safety copy** (`vyro.pre-import.db`) → **photo files written first** (rollback removes them if the DB step fails) → **one transaction** with progress every 200 rows → settings store re-hydrated, all queries invalidated. Notifications re-reconcile through the query/settings subscriptions.
  - Unknown columns are ignored (forward-compatible rows).
- **Errors** are human and specific (newer version, damaged checksum, invalid data in table X, missing references), and **nothing is changed** on failure.
- **Encryption (decision)**: deferred. `@noble/hashes` is in place and AES-GCM via `@noble/ciphers` can wrap the same file later. The UI states that backups are not encrypted and should be kept private.
- **Tests (+4, DB-level)**: round trip export → wipe → import (replace) = identical data; merge conflict resolution (newer wins both ways + missing rows added); checksum damage / newer version / not-a-backup / unparsable / FK violation / invalid row all rejected with the local data unchanged; format-0 upgrade. Total 299, `pnpm check` green, web render sweep clean.
