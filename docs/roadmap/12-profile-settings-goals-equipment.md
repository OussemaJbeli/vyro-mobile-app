# 12 — Profile, Settings, Goals & Equipment

| | |
|---|---|
| Milestone | M1 Core training loop |
| Depends on | 11 |
| Spec refs | FS §8, §9, §10, §25 · UI §31–§38 |
| Output | The complete Settings hub, profile editing, units, appearance (theme + accent), language, goals CRUD and equipment management |

## Objective

Give the user full control of their configuration from the Home avatar (UI §31). Items owned by later steps (Notifications, App lock, Backup, AI) appear as rows now and open their placeholder until those steps land.

## Settings hub (`settings/index`)

```text
[Avatar] Name · "Edit profile"

PROFILE           My information · Goals · Body (→ Progress/Body) · Equipment · Training preferences
APP               Notifications · Appearance · Language · Units · Haptics · Privacy · App lock · Backup & export
AI                AI provider · AI preferences          (hidden unless featureFlags.ai)
ABOUT             Version · Licenses · Redo setup · Diagnostics
```

## Tasks

### 1. Profile (`settings/profile`)
- [x] Name, height (unit-aware), optional date of birth, week start day. React Hook Form + Zod input schema. Save on explicit "Save".
- [x] Height change note: height is stable, so no history table (FS §25). BMI in Progress uses the current height.

### 2. Units (`settings/units`)
- [x] Weight, length, distance, speed. Changing units **only changes display**. A unit test proves stored values are untouched.

### 3. Appearance (`settings/appearance`)
- [x] Theme: System / Dark / Light as a segmented control with live preview cards (like the template's Dark/Light mock phones).
- [x] Accent: the six swatches from the template (Lime default, Blue, Purple, Orange, Red, Teal) with a live logo preview ("Color Customization Example" panel).

### 4. Language (`settings/language`)
- [x] System / English / Français. Applies instantly without restart.

### 5. Training preferences
- [x] Default rest seconds, default weight increment (2.5 kg / 5 lb), auto-start rest timer (on/off), keep screen awake during workouts (on by default), haptics on/off, countdown beeps on/off.

### 6. Goals (`goals/index`, `goals/[id]`)
- [x] List active goals first, then paused/achieved/abandoned (history is kept, FS §9).
- [x] Create/edit form by goal type:
  | Type | Fields | Progress source (step 24) |
  |---|---|---|
  | weight | target kg, start value (prefilled from latest weight) | weight entries |
  | measurement | measurement type, target | body measurements |
  | frequency | sessions per week | completed executions |
  | consistency | completion % target | planned vs completed |
  | running | distance or duration target per week | running executions |
  | custom | free title, manual progress updates | manual |
- [x] Status actions: pause, resume, mark achieved, abandon. Each is confirmed. Nothing is ever hard-deleted without a confirm.

### 7. Equipment (`equipment`)
- [x] Grouped by category, with toggles for availability (✓ / ✕ as in FS §10).
- [x] Presets: "Full gym", "Home dumbbells", "Bodyweight only", "Travel". Applying a preset shows a diff first.
- [x] Add custom equipment.
- [x] Impact hint: "3 exercises in your workouts need Cable machine", linking to the affected templates. This feeds step 13.

### 8. About / Diagnostics
- [x] Version, build number, DB schema version, seed version.
- [x] "Export diagnostics" writes a JSON with the log ring buffer (already redacted) and counts, **no personal values**.

## Acceptance criteria

- [x] Every setting persists across restart and applies app-wide immediately.
- [x] Switching kg ↔ lb updates every visible weight without changing the DB.
- [x] Goals support the full lifecycle, and achieved goals remain visible in history.
- [x] Toggling equipment off shows how many of the user's exercises are affected.

## Execution log (2026-09-25)

- **Settings hub:** a profile card (avatar, name, "Edit profile"), plus new rows for Training preferences, Redo setup (confirm dialog) and Export diagnostics.
- **Profile** (`settings/profile`): React Hook Form + `profileFormSchema` (`src/types/forms.ts`): name, height in the user's length unit (converted to cm; 100–250 cm), date of birth (`YYYY-MM-DD`, real dates only), week start Monday/Sunday. Explicit Save, and `useUnsavedGuard` asks "Discard changes?" on back, gesture or hardware back (built on `usePreventRemove` from `expo-router/react-navigation`).
- **Units:** writes the profile units only and invalidates profile, weights, measurements and goals, so every visible value re-renders. A live example line shows the new formatting. A test proves stored `value_kg` is unchanged after switching.
- **Appearance:** System/Dark/Light, with dark and light preview cards rendered from the real schemes, and six accent swatches (radio role, check mark) with the logo in the accent.
- **Language:** System / English / Français (instant).
- **Training preferences** (`settings/training`, new route): default rest (15 s steps), weight increment (kg or lb, stored in kg), and toggles for auto-rest, keep awake, haptics, countdown beeps and voice cues. They are stored in the typed settings registry for steps 18–19.
- **Goals:** list (active/paused first, then achieved/abandoned history). `goals/[id]` handles both create (`id = new`) and edit. Type chips: weight, measurement, frequency, consistency, running, **muscle**, custom. Muscle and custom need no numeric target; muscle is kept so goals created in onboarding keep their type when edited. Targets are entered in display units and stored canonically (kg, cm/%, sessions/week, %, km/week), and starting values are prefilled from the latest weigh-in or measurement. Actions pause / resume / mark achieved / abandon / delete are each confirmed. A progress readout arrives with step 24.
- **Equipment:** grouped by category with toggles. `equipmentRepo.usage()` counts exercises in active templates per item, so an unavailable item shows "2 exercises in your workouts need this". Presets Full gym / Home dumbbells / Bodyweight / **Travel** show a diff first (`presetDiff`: turn on / turn off lists; custom items untouched). You can add and delete custom equipment.
- **About:** version and build (`expo-application`), database schema version, library (seed) version, privacy statement, licences note, Export diagnostics.
- **Redo setup:** starts a `mode: 'redo'` draft prefilled from the profile and latest weight, without the "Skip setup" shortcut. In redo, "Use this plan" warns and then **replaces** the weekly rules, and a weigh-in is only logged when the value changed (tested).
- `goBack(fallback)` (`src/constants/navigation.ts`) is used across these screens, so saving or backing out of a screen opened directly (deep link, notification) no longer hits an empty history.
- Tests: units don't change stored data, equipment usage counts (and archive effect), preset diff, profile/goal form schemas, goal unit conversions and formatting, redo commit. A headless web pass (units preview, profile save, goal create/list, equipment impact hint, appearance/language/training/about render) passed with zero errors after the back fix.
