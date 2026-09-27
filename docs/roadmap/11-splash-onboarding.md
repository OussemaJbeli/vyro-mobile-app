# 11 — Splash & Onboarding

| | |
|---|---|
| Milestone | M1 Core training loop |
| Depends on | 05, 10 |
| Spec refs | FS §52 · UI §3 · Template "Theme Variations" splash ("Train smarter. Live stronger." + Get Started) |
| Output | Animated brand splash, welcome screen, and a short skippable setup flow that writes profile, goal, equipment and a starter schedule |

## Objective

First launch should take under 90 seconds and end on a Home screen that already shows a real plan. Every optional step can be skipped (FS §52).

## Flow

```text
Native splash (V on #01070C)
  → Animated splash: V mark scales + glow pulse → lockup fades in (≤ 1.2 s, skipped on warm start)
  → Welcome: hero mountain background, VyroLogo stacked, "Train smarter. Live stronger." [Get Started]
  → Setup (progress dots, Skip on every optional step, Back always available)
     1. Name (optional)                       "What should we call you?"
     2. Units                                  kg/lb · cm/in · km/mi · km/h/mph (one screen, smart defaults from locale)
     3. Height (optional)                      ruler-style picker in chosen unit
     4. Current weight (optional)              creates the first weight_entry
     5. Main goal                              cards: Lose weight · Build muscle · Run better · Be consistent · Custom
                                               → a follow-up field (target weight / weekly sessions) when relevant
     6. Equipment                              presets: "Full gym" · "Home, dumbbells" · "Bodyweight only" → editable grid
     7. Training days                          weekday toggles + preferred time → offer a starter plan (see below)
     8. Notifications                          explains the value, then asks permission (denial is fine)
     9. App lock (optional)                    biometrics/PIN toggle (flow implemented in step 26; here it only saves the preference)
  → "You're set" summary → Home
```

## Smart starter plan (step 7)

Based on goal + days + equipment, propose a weekly plan from the seed templates:

| Days/week | Build muscle | Lose weight / Run better | Be consistent |
|---|---|---|---|
| 2 | Full Body ×2 | Full Body + Interval Run | Full Body + 30 min Run |
| 3 | Push / Pull / Leg Day | Full Body, Interval Run, Abs | Upper, Legs, 30 min Run |
| 4 | Upper / Leg Day / Push / Pull | Upper, Run, Legs, Interval Run | Upper, Legs, Run, Abs |
| 5+ | Push, Pull, Legs, Upper, Abs | + Abs on two days | Mixed |

- If equipment is "Bodyweight only", replace gym templates with **Home Workout** and **Abs**.
- Non-selected days become **planned rest** (`type='rest'`), so Home shows the Recovery Day card (UI §5) instead of "nothing".
- The user sees the proposal as a week strip and can **Accept**, **Edit later**, or **Skip**. Accepting creates `schedule_rules` (weekly) through the step 16 API. Because step 16 is not built yet, implement `planStarter()` in `domain/scheduling/starterPlan.ts` now as a pure function, and have onboarding write rules through `scheduleRepo.rules.create`. Materialization is completed in step 16. Until then, write only the rules and flag them `materialized_until = NULL`.

## Tasks

- [x] Animated splash with Reanimated. Respect Reduce Motion (static lockup instead). Hide the native splash only after the first frame is painted.
- [x] Welcome and step screens use the kit components. Onboarding state lives in a local Zustand store and is committed **once** at the end in a single transaction, so a mid-flow kill does not leave a half profile. The store is persisted to `app_settings.onboarding_draft` so the user resumes where they left.
- [x] Unit pickers: `NumberStepper` plus a wheel/ruler picker. Validate plausible ranges (height 100–250 cm, weight 25–300 kg).
- [x] `profileRepo.completeOnboarding()` sets `onboarding_completed_at`. `src/app/index.tsx` redirects accordingly.
- [x] Settings entry "Redo setup" (step 12) re-opens the flow, prefilled. *(Built in step 12.)*
- [x] i18n for every string (EN/FR).

## Acceptance criteria

- [x] Skipping everything lands on Home with a working empty state within 3 taps of "Get Started".
- [x] A full run creates: profile, units, 1 weight entry, 1 goal, equipment availability, and weekly rules for the chosen days plus rest days.
- [x] Killing the app on step 5 and reopening resumes on step 5 with the earlier answers.
- [x] Denying notification permission shows a calm message and continues.

## Pitfalls

- Do not ask for notification permission on the Welcome screen. Ask in context on step 8 (better grant rate, platform guidelines).

## Execution log (2026-09-25)

- **Flow:** `/welcome` → `/setup/<step>` for name, units, height, weight, goal, equipment, days, notifications, lock, done. One dynamic route (`(onboarding)/setup/[step].tsx`) renders each step from `src/components/onboarding/steps.tsx`. Steps live under `/setup/` because a bare `/lock` would collide with the app-lock screen route.
- **Skip everything:** the first step offers "Skip setup for now", which finishes with defaults: Get Started → Skip reaches Home in 2 taps. Optional steps also have a header "Skip".
- **Draft:** `useOnboardingStore` saves the answers to `app_settings.onboarding.draft` after every change. Welcome shows "Continue setup" and resumes on the saved step after a kill.
- **Commit:** `commitOnboarding()` (`src/db/onboarding.ts`) writes, in **one transaction**, the profile (name, height, units, `onboarding_completed_at`), the first weigh-in, the goal (typed per choice, with a translated title), equipment availability, weekly `schedule_rules` (one per template plus one `rest` rule, `materialized_until = NULL` until step 16) and the preferences (`notifications.enabled`, `lock.enabled`). The draft is cleared. Any failure rolls everything back (tested).
- **Starter plan:** `planStarter()` / `planToRules()` in `src/domain/scheduling/starterPlan.ts` follow the roadmap table and cover 1–7 days. Without a full gym, gym sessions become Home Workout, alternating with Abs. The days step previews the week and offers "Use this plan" / "No plan for now" (the "Edit later" option was merged into accepting, since the plan is editable in Plan from step 16).
- **Units:** defaults come from the device locale (`measurementSystem`: US → lb/in/mi/mph, UK → kg/cm/mi/mph). Height and weight use a new **`RulerPicker`** (virtualized, snap per tick, screen-reader increment/decrement). Ranges: height 100–250 cm / 40–98 in, weight 25–300 kg / 55–660 lb.
- **Equipment:** presets Full gym / Home dumbbells / Bodyweight only, plus a "Fine-tune" chip grid with localized seed names.
- **Notifications:** asked in context on step 8 through `requestNotificationPermission()`, which never throws. Denial shows a calm message and continues.
- **App lock:** preference only (`lock.enabled`); the lock itself is step 26.
- **Splash:** `AnimatedSplash` plays once per cold start after the database is ready: the V scales in with its glow, the lockup fades in, then the overlay fades out (1.15 s). It is skipped entirely under Reduce Motion.
- **Welcome:** `HeroBackground` is a themed gradient with an accent rim until the licensed mountain image exists (ASSETS.md).
- **Entry redirect:** `useAppStore.onboardingCompleted` is loaded in bootstrap before the splash hides, so `/` redirects synchronously.
- Tests: starter plan (all goals and day counts, equipment adaptation, rule grouping), commit (full run, skipped run, rollback), draft store (write-through, resume, step order), locale units and presets. A headless web walkthrough of the full and skipped flows landed on Home with zero errors, and a reload stayed on Home. Screenshots caught and fixed two ruler bugs (wrong start position, clipped labels).
