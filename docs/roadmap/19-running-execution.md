# 19 — Running Execution UI

| | |
|---|---|
| Milestone | M1 Core training loop |
| Depends on | 17 |
| Spec refs | FS §19, §20 · UI §42 · Step 15 `RunningTimeline` |
| Output | A glanceable treadmill interval screen with countdown, cues, live adjustments and actual tracking |

## Objective

Readable from a treadmill at arm's length, while running. Huge numbers, clear "what's next", and audio/haptic cues so the user can look away (FS §20).

## Screen anatomy (`execute/run/[executionId]`)

```text
┌──────────────────────────────────────┐
│ ✕  Interval Run 35     18:22  ⏸      │
│ ▁▂▅▂▇▁  (timeline, current marker)   │
│                                      │
│ INTERVAL 3 / 6 · SPRINT              │
│        12.9  km/h                    │  ← metric (current speed)
│        02:41                         │  ← timer (remaining in interval)
│  [ − ]  speed  [ + ]    incline 1 %  │
│                                      │
│ NEXT  Run · 9.7 km/h · 05:00         │
│                                      │
│ [ ⏭ Skip ] [ ↻ Repeat ] [ ⏸ Pause ]  │
│                                      │
│ ✓ Warmup  ✓ Run  → Sprint  ○ Run …   │
└──────────────────────────────────────┘
```

## Tasks

- [x] 3-2-1 start countdown (skippable).
- [x] Interval transitions: a haptic pattern plus a beep 3 s before the change, plus a spoken cue through `expo-speech` (install it with `npx expo install expo-speech`; it uses the on-device TTS engine) (setting: "Voice cues": "Next: run, 9.7 kilometres per hour"). Everything is offline.
- [x] Live controls (FS §20): pause/resume, skip interval, repeat interval, speed ±0.1 (long-press ±0.5), incline ±0.5, extend or shorten the current interval (±30 s), stop/finish early.
- [x] Every adjustment is recorded in `running_interval_logs` actuals. The original plan remains in the snapshot.
- [x] Background: schedule local notifications for each upcoming interval change while backgrounded (limited to the next ~10), and cancel/reschedule on foreground or adjustment.
- [x] Lock-screen friendly: the notification shows the current interval ("Sprint · 12.9 km/h · ends 18:25"). An ongoing/foreground-service style notification is optional; check `expo-notifications` capabilities and note limitations.
- [x] Optional **distance entry** at finish ("Treadmill says 4.52 km"). Otherwise use the estimate Σ(actual speed × actual duration), clearly labelled "estimated".
- [x] Completion screen: planned vs actual per interval (FS §14 example: "Planned 30 min, 6 → 9 mph; Actual 22 min, 6 → 8 mph"), totals, average speed, effort, notes.
- [x] Landscape is allowed on this screen only (treadmill phone holders). Layout adapts.

## Acceptance criteria

- [x] The FS §19 plan runs end-to-end with automatic transitions, and a 10-minute screen lock mid-run resumes at the correct interval and time.
- [x] Skipping, repeating and changing speed are all reflected in the logs and the completion diff.
- [x] Numbers are readable at about 1 m (timer at least 64 pt, speed at least 32 pt).

## Execution log

**2026-09-26 — Done.**

- **Screen** `execute/run/[executionId]` → `components/execution/RunningExecution.tsx`.
  - Top bar (elapsed, ⏸), the step 15 `RunningTimeline` with current marker and progress, and "INTERVAL 3 / 6 · SPRINT".
  - Speed 48 pt in the user's unit, remaining time 64 pt (`timer`).
  - xl steppers: speed ±0.1 (long-press accelerates) and incline ±0.5. −30 s / +30 s, "Next: Run · 9.7 km/h · 5:00", Skip / Repeat, status chips per interval, and the "Resumed — N intervals completed while away" banner.
  - Finish/discard come through the shared exit sheet (`useExecutionExit`, now also used by the strength screen).
- **Countdown 3-2-1**: runs start with `startedAt` = now + 3 s, so the active clock starts when the countdown ends. The engine clamps before start. "Start now" dispatches the new `SKIP_COUNTDOWN`.
- **Cues**: haptic + beep ticks 3 s before each change and on the countdown (`useTimerCues`). Spoken "Next: run, 9.7 km/h" through `expo-speech` (`services/audio/speech.ts`, setting "Voice cues", on-device TTS, offline).
- **Actuals**: every adjustment goes through the engine into `running_interval_logs`; the snapshot stays untouched.
- **Background**: `upcomingAlarms(state, now, 10)` (pure) schedules the next ≤ 10 interval changes as local notifications. The title is "Sprint · 12.9 km/h" and the body "Ends at 18:25". They are cancelled on return.
  - Limitation: expo-notifications has no ongoing/foreground-service notification, so the lock screen shows the latest delivered change, not a live card.
- **Distance**: on finish the engine stores the estimated Σ speed × duration (`runSummary`). The completion screen labels it "estimated" and offers an optional treadmill distance entry (user unit → km) through `saveReview`.
- **Completion (running)**:
  - Duration, distance, average speed and intervals tiles. "Planned 35:00 → Actual 22:00".
  - Per-interval planned vs actual ("Planned 5:00 @ 12.9 km/h → Actual 2:41 @ 12.9 km/h") with Skipped / Stopped early / Repeated / As planned tags. Effort and notes as for strength.
- **Landscape on this screen only**: `orientation: 'default'` + the `expo-screen-orientation` plugin (initial PORTRAIT_UP). The app locks portrait at startup and the run screen unlocks while focused. The layout switches to two columns when wide.
- **Starting runs** is enabled everywhere (Train, running detail, Plan).
- **Test (+1)**: countdown/skip, upcoming alarm times, estimated distance written on finish. Total 257. `pnpm check` green.
