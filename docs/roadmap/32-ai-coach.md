# 32 — AI Coach Experiences

| | |
|---|---|
| Milestone | M5 AI layer (V1.1) |
| Depends on | 31 |
| Spec refs | FS §42, §43, §80, §81 · UI §27, §28, §29, §40 |
| Output | The AI Coach screen (reports and chat), contextual ✨ entry points across the app, a weekly insight card, and approve/ignore suggestion flows |

## Objective

AI makes an already excellent tracker smarter (FS §90). Every recommendation is actionable, explainable and user-approved (FS §81, UI §29).

## 1. AI Coach screen (`coach/index`, UI §28)

```text
AI COACH
Good evening 👋
┌ This week (computed LOCALLY, no AI needed) ┐
│ You completed 5 / 6 planned activities.    │
│ Running volume ↑ vs last week.             │
└────────────────────────────────────────────┘
What would you like to know?
[ Analyze my week ] [ Analyze my progress ] [ Improve my schedule ]
[ Adapt my workouts ] [ Running analysis ]
Recent reports ›
────────────────────────
Ask anything…   "How is my progress?"        [➤]
```

- [ ] The header facts are **local deterministic analytics** (step 24), so the screen is useful even offline. AI adds interpretation on top.
- [ ] Action buttons run the matching `AIService` method: payload preview → loading skeleton → **Report view**: title, summary, bullets, suggestions (each with Apply / Ignore), disclaimers, and "Based on your recorded data from …".
- [ ] **Chat:** a free-form thread. Each turn includes a compact rolling context summary (not the DB). The assistant can emit suggestions as structured cards. Threads are listed and deletable.
- [ ] Reachable from the Home "✨ Ask your coach" row and the Settings/Profile area. **Not** a bottom tab (UI §27).

## 2. Contextual entry points (UI §27)

| Location | Button | Method | Typical output |
|---|---|---|---|
| Home (low priority slot, UI §40) | ✨ Ask your coach / weekly insight card | `summarizeWeek` | FS §81 weekly insight |
| Progress Overview | ✨ Analyze my progress | `analyzeProgress` | Weight/measurement trend interpretation (FS §80 wording) |
| Workout detail / execution pre-start | ✨ Adapt this workout | `adaptWorkout` | "No cable machine today" → replacement suggestions (FS §42) |
| Running detail / analytics | ✨ Analyze my running | `analyzeRunning` | Progression across interval sessions |
| Plan | ✨ Improve my schedule | `improveSchedule` | "Missed Tuesday → reorganize the week" (FS §42) |
| Exercise swap sheet | ✨ More ideas | `suggestAlternative` | Extra alternatives beyond the local engine |

- [ ] All entry points are hidden when AI is disabled, and show the offline notice without connectivity.

## 3. Suggestion cards (FS §43, UI §29)

```text
AI SUGGESTION
Move Leg Day from Thursday to Friday.
Why: Thursday already has Running + Abs; Friday is free.
[ Preview change ]  [ Apply ]  [ Ignore ]
```

- [ ] Preview shows the exact diff (the planner week before and after, or the template before and after).
- [ ] Apply goes through `applySuggestion` (step 31): local validation → conflict warnings → commit → toast with **Undo** (it restores the previous state within the session).
- [ ] Ignore marks it `ignored` and asks nothing more. Stale suggestions (their target changed) auto-expire with a note.
- [ ] The history of applied suggestions is visible in the Coach "Recent reports".

## 4. Weekly insight card (FS §81)

- [ ] On Home, only when AI is enabled **and** the user has generated one: "WEEKLY INSIGHT · 6 / 8 sessions · Gym 3/3 · Running 1/2 · Abs 2/3", AI summary lines, and a "See suggestions" link.
- [ ] Generation is always user-initiated (a "Generate this week's insight" button). No automatic calls.

## 5. Quality and safety

- [ ] Prompt templates are versioned in `src/services/ai/prompts/` with golden tests against MockProvider fixtures.
- [ ] Wording guard: a post-processor flags guarantee-like phrases ("you will lose", "guaranteed") and rewrites them to estimate language, or adds a disclaimer (FS §44).
- [ ] Rate and cost awareness: show approximate usage per request if the provider returns it.
- [ ] Accessibility: reports are readable by the screen reader in order, and suggestion buttons have explicit labels ("Apply suggestion: move Leg Day to Friday").

## Acceptance criteria

- [ ] "I don't have a cable machine today, adapt my workout" returns replacements that only use available equipment. Applying them updates today's execution plan or template only after approval.
- [ ] "I missed Tuesday, reorganize the rest of my week" proposes moves that pass local conflict checks. Nothing changes until Apply.
- [ ] Disabling AI removes every AI surface. The app is identical to V1.
- [ ] **🎉 Roadmap complete.** Update tracking.md so all milestones are Done.
