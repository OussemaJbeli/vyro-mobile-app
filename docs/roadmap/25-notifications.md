# 25 — Local Notifications

| | |
|---|---|
| Milestone | M3 Platform services |
| Depends on | 16, 22 |
| Spec refs | FS §35 · UI §37 · Step 17 rest/interval notifications |
| Output | A notification service with categories, a reconciliation engine, settings, and deep links |

## Objective

Reduce forgotten workouts (FS §3.2) with local reminders only. The user controls every category and can disable everything (FS §35).

## Categories

| Category | Default | Content example | Trigger |
|---|---|---|---|
| Session reminder | on, 15 min before | "🏋 Upper Body starts in 15 minutes." | Timed scheduled sessions |
| Untimed session nudge | on, 09:00 | "Today: Gym · Six Pack" | Days with untimed sessions |
| Running reminder | follows session | "🏃 Interval Run in 15 minutes" | Running sessions (separate toggle, UI §37) |
| Weight reminder | off | "⚖ Morning weigh-in" | Daily or selected weekdays at a time |
| Measurement reminder | weekly Sun 07:30 | "📏 Weekly body measurement reminder." | FS §35 example |
| Progress photo reminder | off, every 2 weeks | "📷 Progress photo day" | Interval |
| Weekly plan summary | off | "Next week: 5 sessions planned" | Sunday evening |
| Missed session follow-up | on | "Missed Leg Day? Reschedule or skip." (quiet, next morning) | FS §79 "offer reschedule" |
| Rest / interval timers | execution only | "Rest over — Set 3" | Step 17 |

- Content never includes sensitive values (no weights on the lock screen) (FS §63).
- **Quiet hours** (default 22:00–07:00). Non-timed reminders shift out of quiet hours.

## Reconciliation engine (`src/services/notifications/reconcile.ts`)

The OS caps pending notifications (iOS allows 64). Instead of scheduling everything forever:

```ts
desiredNotifications(state, now, horizonDays = 7): Desired[]   // pure
reconcile(desired, existing: notification_schedules[]): { toSchedule, toCancel }
```

- [x] Run on app start, on foreground, after any schedule/session/settings mutation (debounced 1 s), and at most once per hour.
- [x] Idempotent: the `notification_schedules` table maps `(kind, target_id, fire_at)` → OS id.
- [x] Keep the total at 50 or fewer, prioritized: timers > sessions > nudges > body reminders.
- [x] Unit-test `desiredNotifications` (settings off → none; moved session → new time; completed session → cancelled; quiet hours shift).

## Tasks

- [x] Android channels: `sessions`, `reminders`, `timers` (high importance, sound), and `summary` (low).
- [x] Permission flow: ask in context (onboarding step 8, or the first time the user enables a category). Denied → an inline banner in notification settings with "Open system settings". The app works fully without permission.
- [x] Settings screen (`settings/notifications`): a master toggle, per-category toggles with time/offset pickers, quiet hours, and a "Send test notification" button.
- [x] Deep links: tapping a session reminder opens `session/[id]` with a Start button; the missed follow-up opens a reschedule sheet; timers open the active execution; body reminders open the quick-log sheet.
- [x] Notification actions (where supported): "Start", "Snooze 10 min", "Skip".
- [x] Per-session override: the schedule form reminder field (step 16) is now wired.
- [x] Handle timezone and clock changes: re-reconcile when the app detects that the timezone offset changed.

## Acceptance criteria

- [x] A session scheduled at 18:00 with a 15-minute reminder notifies at 17:45, in airplane mode.
- [x] Moving the session to 19:00 moves the reminder. Completing it early cancels the reminder.
- [x] Disabling the master toggle cancels every pending notification.
- [x] With permission denied, no errors occur and settings explain the state.

## Execution log

**2026-09-26 — Done.**

- **Reconcile engine** `services/notifications/reconcile.ts` (pure):
  - `desiredNotifications(settings, sessions, now, t, 7)` produces session reminders (per-session `reminder_offset_minutes` override, else the global 15 min; separate running toggle), the untimed-day nudge, the missed follow-up (next morning, quiet-shifted), weight (time + weekdays), weekly measurement, 2-week photo cycle and Sunday plan summary.
  - `shiftOutOfQuiet` moves non-timed reminders out of quiet hours (default 22:00–07:00). Timed session reminders are never shifted.
  - The result is capped at 50: sessions > nudges/follow-ups > body/summary.
  - `reconcile` is an idempotent diff keyed on (kind, target, fire time).
  - No sensitive values in content (FS §63).
  - Tests cover: master off → none, 17:45 for 18:00 − 15 min, a moved session → cancel + reschedule, completed → cancelled, idempotency, nudge/missed/running toggle, quiet shifts, body/summary/photo cycle, cap.
- **Storage**: `notification_schedules` maps (kind, target, fire_at) → OS id. Nudges and follow-ups use `nudge:<date>` / `missed:<id>` targets under the existing `session` kind, so no migration is needed.
- **Sync** `services/notifications/sync.ts` + `native.ts`:
  - Cancels stale entries and schedules missing ones. It is serialized, and with the master toggle off or permission denied the desired set is empty, so **everything is cancelled**.
  - Android channels: `sessions` (high), `reminders`, `timers` (high; rest/interval alarms now use it), `summary` (low).
  - Foreground banner handler and the `session` action category.
- **`NotificationSync`** (root layout) runs on start, on foreground (timezone/clock changes included), after any successful mutation, after refreshed sessions queries, after `notifications.*` setting changes or the execution starting/ending (debounced 1 s), and hourly.
  - **Deep links**: a session reminder opens `session/[id]`; the missed follow-up opens `session/[id]?action=reschedule` (the actions sheet opens); body reminders open the quick weight sheet (`/body/weight?log=1`), the measurement form or the camera; timers open the active execution. The cold-start response is handled.
  - **Actions**: Start (starts the session's workout), Snooze 10 min, Skip.
- **Settings** (`settings/notifications`):
  - Master toggle that asks for permission in context. When denied it shows an inline banner with "Open system settings", and the app keeps working.
  - Per-category toggles with offset chips, times, weekday chips and the photo cycle anchor; quiet hours; "Send test notification".
- **Per-session override**: the step 16 schedule form reminder now drives the reminder time.
- **Tests (+6)**, total 290, `pnpm check` green.
- **Device check (airplane mode)**: local notifications fire offline, including in Expo Go on Android. Remote push is not used.
