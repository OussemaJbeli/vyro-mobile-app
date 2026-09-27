# QA issues (step 29)

One row per failure found while running the step 29 matrix or the e2e suite. Blockers and
majors must be closed before step 30's release build.

Severity: **blocker** (data loss, crash on a core path, cannot finish a workout) ·
**major** (core feature wrong, no workaround) · **minor** (workaround exists) · **cosmetic**.

| # | Area | Steps | Expected | Actual | Severity | Status |
|---|---|---|---|---|---|---|
| 1 | Plan / routine | Existing install with a planned session that had been started once (then discarded) → app update applies the routine | Routine replaces the plan | Foreign key on `session_executions` aborted the whole apply; plan stayed empty | blocker | ✅ Fixed 2026-09-27 (hide instead of delete, routine v3+, test in `seed.test.ts`) |
| 2 | e2e | First emulator run of `e2e/flows` | All flows pass | Not run yet: the flows were written without an emulator | — | ⏳ Open (needs the first emulator run) |
| 3 | Photos | Android 10–12: Progress → Photos → Upload from library, with storage permissions blocked (step 30 audit) | System picker opens, photo saved | Not verified on a device yet | — | ⏳ Open (device check) |
