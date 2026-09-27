# 20 — Start Tab: Daily Sequence & Completion

| | |
|---|---|
| Milestone | M1 Core training loop |
| Depends on | 18, 19 |
| Spec refs | UI §10, §11, §12, §49 · Template screen 3 "START — Execute Your Plan" |
| Output | A context-aware Start FAB, the "Today's Training" sequence screen, and the "Today complete" celebration |

## Objective

The centre button makes the day a guided flow: press Start, and the app takes the user through today's activities in order (UI §11).

## Start state resolver (`domain/execution/startState.ts`, pure)

```ts
resolveStartState(todaySessions, activeExecution, now): {
  fab: 'start' | 'continue' | 'done' | 'rest' | 'empty';
  primary?: { kind: 'resume' | 'begin'; sessionId?: string; executionId?: string; label: string };
}
```

Priority:
1. Active execution exists → **continue** (label: "Continue Upper Body").
2. Today has pending non-rest sessions → **start** with the next in `order_in_day` / time order.
3. All of today's non-rest sessions are completed/modified/skipped/cancelled and at least one is done → **done**.
4. Today only has rest → **rest**.
5. Nothing planned → **empty** (FAB opens Start with "Quick start" suggestions).

Unit-test every branch.

## Start screen (template screen 3)

```text
Today's Training                      1/3
████░░░░░░░░
[✓] Running        Completed
[⚡] Gym            ◉ Next
[ ] Six Pack       ○ Pending
┌──────────────────────────────┐
│  (cover image)               │
│  Upper Body                  │
│  55 min · 6 exercises        │
│  [ ▶ Start Workout ]         │
└──────────────────────────────┘
Next Up
[cover] Six Pack  12 min · Abs   ›
```

- [x] The list shows today's sessions with `StatusTag`s. The hero card shows the next activity (or the one in progress with "Set 2 / 4 · Continue", UI §12).
- [x] Hero CTA: Start Workout / Start Run / Continue. Each routes to the right execution screen.
- [x] Tapping another pending activity promotes it to the hero (the user can change the order today without editing the plan).
- [x] If a hero exercise needs missing equipment: a banner "2 exercises unavailable today · Review swaps" opens a pre-start swap sheet that substitutes before the start (UI §16).
- [x] **Rest day state:** the Recovery card (☕, "No workout scheduled today", next activity, "View schedule"), plus an optional "Log a light activity" link.
- [x] **Empty state:** "Nothing planned today", with Quick start (recent templates), Plan something, or Start empty workout.
- [x] **Quick start** section at the bottom: the 3 most recent templates plus "Browse workouts".

## Sequencing

- [x] After finishing an execution, the completion screen's "Continue" returns here with the next activity promoted and a short check-off animation.
- [x] When the last activity finishes → **Today complete** screen (UI §49): "TODAY COMPLETE 🎉", 3 / 3 activities, per-activity durations, total (for example 1h 36m), buttons [View summary] [Done]. Keep the celebration subtle and brief (FS §45: motivating, not childish).
- [x] The FAB state updates everywhere through query invalidation (`sessions`, `activeExecution`).

## Acceptance criteria

- [x] With Running done and Gym plus Six Pack pending, the screen matches template screen 3, and the FAB says Start.
- [x] Leaving mid-Gym and tapping the FAB returns straight into the exact set.
- [x] Completing all three activities shows Today complete, and the FAB shows ✓.

## Execution log

**2026-09-26 — Done.**

- **`domain/execution/startState.ts`** (pure): `resolveStartState(todaySessions, active)`. Priority: continue → start (next by `order_in_day`, then time) → done → rest → empty. Also `orderToday`, `isPendingSession`, `isDoneSession`. Every branch is unit-tested (`startState.test.ts`, 4 tests).
- **FAB everywhere**: `useStartFabSync` (mounted by the tabs layout) feeds `startStore` from today's sessions query + the active execution. `empty` shows as Start, and "Continue Upper Body workout" is the a11y label.
  - The step 05 dev toggles were removed from Home, and TabBar reads only `startStore`.
  - The Start tab press opens the live workout directly when one is active (exact set, from step 18).
- **Start screen** (`components/start/TodayTraining.tsx`, template screen 3):
  - "Today's Training 1/3" + progress bar, and the ordered list with `StatusTag`s (the hero is tagged "Next", with a fade on status change).
  - **Hero card**: cover, title, "55 min · 6 exercises" / "6 intervals", CTA Start Workout / Start Run. While a workout is active it shows Continue with "Set 2 / 4 · Continue" / "Interval 3 / 6 · Continue".
  - Tapping another pending activity promotes it to the hero (no plan edit).
  - **Unavailable equipment** banner "2 exercises unavailable today · Review swaps" → `PreStartSwapSheet` (available alternatives, or Keep) → start, then `SUBSTITUTE_EXERCISE` with the new `exerciseIndex` and reason "No equipment". The snapshot stays the plan.
  - **Rest day**: recovery card, next activity within 14 days, "View schedule", "Log a light activity" (seed Recovery template).
  - **Done state** card. **Empty state**: Start empty workout / Plan something.
  - **Quick start**: 3 recent templates (from history, filled with templates not already planned today) + "Browse workouts". "Next Up" rows for the other pending activities.
- **Sequencing**: the completion screen's button reads **Continue** when activities remain. After saving it routes to the Start tab (next promoted), to **Today complete** when the last of today's scheduled activities is done, otherwise to Home.
- **Today complete** (`/today-complete`, fullscreen): trophy zoom-in, "TODAY COMPLETE 🎉", "3 / 3 activities", total "1h 36m", per-activity durations (tap → that summary), [View summary] [Done]. Subtle, under 0.5 s of motion.
- **Test update**: the Upper Body screen test now expects Today complete for the day's only activity. Suites green.
