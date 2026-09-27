# QA report & V1 certification (step 29)

Build under test: `1.0.0` (versionCode from EAS, `appVersionSource: remote`).
Legend: ✅ verified · 🤖 covered by automated tests (Jest), device check still due · ☐ to do.

## 1. Automated coverage today

`pnpm check` (typecheck + lint + 52 Jest suites, 312 tests) passes on 2026-09-27. What it covers:

| Area | Suites |
|---|---|
| Database: fresh install, migrations + checksum lock, invalid data rejected, seed idempotence, routine apply | `schema`, `lock`, `seed`, `repositories`, `performance` |
| Execution: sets, rest, intervals, pause/resume, kill + resume, outcomes, retro edits | `engine`, `execution-engine`, `execution-review`, `runner`, `startState`, `retro`, `summary`, `strength-execution` |
| Planning: recurrence, materialization, conflicts, starter plan, day/month scores | `recurrence`, `conflicts`, `starterPlan`, `progress` |
| Builders: gym and running workouts, exercise form and picker | `builderModel`, `workout-builder`, `running-builder`, `runningBuilderModel`, `intervals`, `exercise-form`, `exercise-picker` |
| Body, analytics, streaks | `trend`, `weekly`, `analytics`, `streak` |
| Photos: private storage, purge, orphans | `storage` |
| Notifications: reconcile, quiet hours | `reconcile` |
| Lock: PIN hashing, backoff policy | `lock`, `policy` |
| Backup: export, validation, merge/replace, damaged and newer files | `backup` |
| Localization and units | `i18n`, `units`, `seedNames`, `dates` |

## 2. Device test matrix (FS §84)

| Area | Cases | Result |
|---|---|---|
| Functional | create, edit, delete, complete, skip, reschedule, duplicate — workouts, runs, sessions, goals, weights, measurements, photos | 🤖 |
| Database | fresh install; upgrade from the preview build with data; interrupted write | 🤖 fresh install + migrations · ☐ upgrade on device |
| Resume | kill during a set, rest, interval, finish; reboot mid-workout | 🤖 kill/resume · ☐ reboot |
| Offline | airplane mode, every FS §58 feature | ☐ (no feature calls the network) |
| Photos | camera, import, permission denied, not in Gallery, delete/restore, compare, 48 MP image | ☐ |
| Notifications | schedule, cancel, reschedule, denied, quiet hours, timezone change | 🤖 reconcile · ☐ device |
| Lock | biometrics, PIN, wrong-PIN backoff, switcher privacy, timeout | 🤖 PIN/backoff · ☐ device |
| Backup | round trip, damaged file, newer version, merge, replace | 🤖 · ☐ share sheet round trip |
| Performance | step 28 demo dataset targets | 🤖 `performance` · ☐ device timing |
| Localization | EN and FR, kg/lb, km/mi, mph | 🤖 · ☐ visual pass |
| Accessibility | TalkBack, 2× font | ☐ |
| Devices | 5.4″ / 360 dp, large phone, Android 10 → latest | ☐ |

## 3. V1 certification (FS §83)

| # | Criterion | Verified by | ✓ |
|---|---|---|---|
| 1 | Install/open the application | Fresh install on 2 devices | ☐ |
| 2 | Configure profile and goals | `onboarding_full` + settings | 🤖 |
| 3 | Configure equipment | Onboarding + equipment screen | 🤖 |
| 4 | Browse exercises | Library with search and filter | 🤖 |
| 5 | Create workouts | `create_gym_workout` | 🤖 |
| 6 | Schedule workouts | `schedule_and_move` | 🤖 |
| 7 | View the weekly plan | Plan week view | 🤖 |
| 8 | Start a gym workout | `execute_gym_workout` | 🤖 |
| 9 | Record sets/reps | `execute_gym_workout` | 🤖 |
| 10 | Use rest timers | Step 17 tests + manual | 🤖 |
| 11 | Create a running interval plan | `create_running_plan` | 🤖 |
| 12 | Execute the running plan | `execute_run_skip_repeat` | 🤖 |
| 13 | Create home/abs workouts | Manual | 🤖 (seeded abs A/B/C) |
| 14 | Schedule home workouts | Manual | 🤖 |
| 15 | Record weight | `log_weight_and_measurement` | 🤖 |
| 16 | Record measurements | `log_weight_and_measurement` | 🤖 |
| 17 | Capture private progress photos | Manual (Gallery check) | ☐ |
| 18 | Compare photos | Manual | ☐ |
| 19 | View history | Manual + e2e | 🤖 |
| 20 | View analytics | Manual | 🤖 |
| 21 | Receive local reminders | Manual, airplane mode | ☐ |
| 22 | Export data | `export_import_roundtrip` | 🤖 |
| 23 | Import data | `export_import_roundtrip` | 🤖 |
| 24 | Use all core features with no internet | Offline matrix | ☐ |
| 25 | Close/reopen without losing data | Resume matrix | 🤖 |

**Sign-off:** a row becomes ✅ once it passes on a device with the preview build. Record the date
and build number here. V1 is certified when all 25 rows are ✅, `qa-issues.md` has no open
blocker/major, and `maestro test e2e/flows` passes three runs in a row.
