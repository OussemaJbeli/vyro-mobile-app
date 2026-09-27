# 29 — QA & Offline Certification

| | |
|---|---|
| Milestone | M4 Ship V1 |
| Depends on | 28 |
| Spec refs | FS §58, §83, §84 · UI §12 |
| Output | Automated end-to-end flows, a full manual test matrix, and a signed-off V1 certification against FS §83 |

## Objective

Prove that V1 is done. Every Definition-of-Done item (FS §83) and quality requirement (FS §84) is verified and recorded here.

## 1. Automated end-to-end (Maestro, `e2e/`)

Maestro flows (written in `e2e/flows`, first emulator run pending) run against the release-like `preview` build on an emulator:

- [ ] `onboarding_full.yaml` and `onboarding_skip_all.yaml` (written)
- [ ] `create_gym_workout.yaml` (written) (with reorder and duplicate)
- [ ] `create_running_plan.yaml` (written) (FS §19 plan, asserts total 35:00)
- [ ] `schedule_and_move.yaml` (written) (conflict warning appears)
- [ ] `execute_gym_workout.yaml` (written) (complete sets, swap exercise, finish, see the history diff)
- [ ] `execute_run_skip_repeat.yaml` (written)
- [ ] `log_weight_and_measurement.yaml` (written)
- [ ] `export_import_roundtrip.yaml` (written)
- [ ] `daily_sequence_complete.yaml` (written) (three activities → Today complete)

## 2. Test matrix (FS §84)

| Area | Cases | Result |
|---|---|---|
| Functional | create, edit, delete, complete, skip, reschedule, duplicate — for workouts, runs, sessions, goals, weights, measurements, photos | ☐ |
| Database | fresh install; upgrade from a build with an older schema (install v0.9 → add data → install v1.0); invalid data rejected; interrupted write (kill during save) | ☐ |
| Resume | kill during a set, during rest, during an interval, during finish; reboot the phone mid-workout | ☐ |
| Offline | airplane mode, every core feature in FS §58 list (open, view schedule, start, timers, record sets, record intervals, weight, photos, history, analytics, edit workouts, edit goals) | ☐ |
| Photos | camera and import; permission denied; private storage (not in Gallery); delete and restore; compare; a large image (48 MP) | ☐ |
| Notifications | schedule, cancel, reschedule, permission denied, quiet hours, timezone change | ☐ |
| Lock | biometrics, PIN, wrong-PIN backoff, switcher privacy, timeout | ☐ |
| Backup | round trip, damaged file, newer version, merge, replace | ☐ |
| Performance | demo dataset targets from step 28 | ☐ |
| Localization | full EN and FR pass, units kg/lb, km/mi, mph | ☐ |
| Accessibility | TalkBack pass, 2× font | ☐ |
| Devices | small phone (5.4″, 360 dp wide), large phone, Android 10 minimum through the latest version | ☐ |

Results live in `docs/roadmap/qa-report.md`. Record each failure as an issue in `docs/roadmap/qa-issues.md` with steps, expected and actual results, and severity. Blockers and majors must be fixed before step 30.

## 3. V1 certification (FS §83)

| # | Criterion | Verified by | ✓ |
|---|---|---|---|
| 1 | Install/open the application | Fresh install on 2 devices | ☐ |
| 2 | Configure profile and goals | onboarding_full + settings | ☐ |
| 3 | Configure equipment | onboarding + equipment screen | ☐ |
| 4 | Browse exercises | Library with search and filter | ☐ |
| 5 | Create workouts | create_gym_workout | ☐ |
| 6 | Schedule workouts | schedule_and_move | ☐ |
| 7 | View the weekly plan | Plan week view | ☐ |
| 8 | Start a gym workout | execute_gym_workout | ☐ |
| 9 | Record sets/reps | execute_gym_workout | ☐ |
| 10 | Use rest timers | Manual plus the step 17 tests | ☐ |
| 11 | Create a running interval plan | create_running_plan | ☐ |
| 12 | Execute the running plan | execute_run_skip_repeat | ☐ |
| 13 | Create home/abs workouts | Manual | ☐ |
| 14 | Schedule home workouts | Manual | ☐ |
| 15 | Record weight | log_weight_and_measurement | ☐ |
| 16 | Record measurements | log_weight_and_measurement | ☐ |
| 17 | Capture private progress photos | Manual (Gallery check) | ☐ |
| 18 | Compare photos | Manual | ☐ |
| 19 | View history | Manual plus e2e | ☐ |
| 20 | View analytics | Manual | ☐ |
| 21 | Receive local reminders | Manual, airplane mode | ☐ |
| 22 | Export data | export_import_roundtrip | ☐ |
| 23 | Import data | export_import_roundtrip | ☐ |
| 24 | Use all core features with no internet | Offline matrix | ☐ |
| 25 | Close/reopen without losing data | Resume matrix | ☐ |

## Acceptance criteria

- [ ] All 25 certification rows are ticked, with the date and the build number recorded.
- [ ] No open blocker or major issues in `qa-issues.md`.
- [ ] The e2e suite passes three consecutive runs (not flaky).
