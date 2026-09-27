# Personal Training & Body Progress App — Full Product & Technical Specification

## 1. Document Purpose

This document defines the complete product vision, functional requirements, UX direction, architecture, data model, offline-first behavior, and future AI integration for a personal fitness/lifestyle tracking application.

The implementation agent receiving this document must:

1. Study the entire specification before coding.
2. Convert it into a practical implementation plan.
3. Build the application incrementally from an empty project.
4. Keep the app fully functional offline before any AI/API integration.
5. Use the provided assets, logo, home-screen template, and screenshots as visual references.
6. Preserve the visual quality and intent of the references while being creative where the specification does not prescribe exact UI.
7. Produce a modern, polished, responsive, production-quality mobile application.
8. Keep the architecture ready for future AI integration without making AI a dependency of the core application.

The first release is a **completely local/offline mobile application**. No account, backend, cloud database, or internet connection is required for core functionality.

---

# 2. Product Vision

The application is a personal "training operating system".

It combines:

- Gym training
- Home workouts
- Six-pack/abs workouts
- Running/treadmill programs
- Weekly scheduling
- Exercise and equipment alternatives
- Workout execution
- Workout history
- Body measurements
- Weight tracking
- Progress photos
- Hair progress photos
- Beard progress photos
- Goals
- Personal equipment availability
- Progress analytics
- Notifications/reminders
- Offline local storage
- Future AI analysis and adaptation

The application must not behave like a rigid workout checklist.

The user should be able to define a plan, modify it when reality changes, record what actually happened, and later analyze the difference between planned and actual activity.

The core philosophy is:

> **Plan → Adapt → Execute → Record → Analyze → Improve**

---

# 3. Primary Goals

## 3.1 Main Goal

Create one private application that organizes the user's entire personal training routine and progress history.

## 3.2 Secondary Goals

The application should:

- Reduce forgotten workouts.
- Replace mental/manual workout planning.
- Make treadmill/running interval plans explicit.
- Make gym programs adaptable to available equipment.
- Keep body-progress data organized.
- Keep sensitive progress photos separated from the normal gallery.
- Provide a clear weekly overview.
- Preserve complete historical records.
- Work without internet.
- Be ready for future AI-powered analysis.
- Feel like a polished commercial fitness application rather than a basic CRUD project.

---

# 4. Technology Stack

## 4.1 Mobile Framework

Use:

- React Native
- Expo
- TypeScript

Recommended baseline:

- Current stable Expo SDK compatible with the implementation environment.
- Expo Router for navigation.
- Functional components.
- React hooks.
- Strict TypeScript.

Do not introduce unnecessary framework complexity.

---

# 5. Local-First Architecture

The first version is fully offline.

Architecture:

```text
React Native + Expo
        |
        +-- UI
        |
        +-- Navigation
        |
        +-- State Management
        |
        +-- SQLite
        |
        +-- Private File Storage
        |
        +-- Local Notifications
        |
        +-- Analytics/Charts
        |
        +-- Future AI Service
```

Core principle:

> The application must remain fully useful if the device has no internet connection.

AI is an optional future layer, not a dependency.

---

# 6. Recommended Libraries

The implementation agent should evaluate current stable versions before installation, but the architecture should generally use:

### Core

- Expo
- React Native
- TypeScript
- Expo Router

### Database

Use SQLite through Expo's SQLite support.

Recommended direction:

- `expo-sqlite`

SQLite is the primary structured local data store.

### Local files

Use:

- `expo-file-system`

Sensitive body/progress images should be stored in application-private storage rather than being treated as ordinary gallery images.

### Camera

Use:

- `expo-camera`
- or the current Expo-supported image picker/camera solution when appropriate.

### Notifications

Use:

- `expo-notifications`

### Secure storage

For small secrets/settings that should not live as plain SQLite values:

- `expo-secure-store`

Do not store large datasets or photos in SecureStore.

### State management

Use a lightweight predictable state solution.

Preferred:

- Zustand

Do not put the entire application state into one enormous store.

Separate domain state logically.

### Forms

Use:

- React Hook Form

### Validation

Use:

- Zod

The same schemas can later be useful when communicating with an AI/API service.

### Charts

Use a maintained React Native chart library compatible with Expo.

The exact library can be selected during implementation based on current Expo compatibility.

### Icons

Use:

- Expo-compatible icon system such as `@expo/vector-icons`

---

# 7. Data Architecture

SQLite is the source of truth for structured application data.

Suggested high-level tables:

```text
user_profile
goals
equipment
exercise_library
workout_templates
workout_template_exercises
scheduled_sessions
session_exercises
exercise_sets
running_workouts
running_intervals
body_measurements
weight_entries
progress_photos
photo_categories
notifications
app_settings
```

The implementation agent may normalize or adjust the schema when appropriate, but must preserve the concepts and relationships described below.

---

# 8. User Profile

The app is initially designed for one local user.

No authentication is required.

Suggested data:

```text
user_profile
--------------
id
name
height
height_unit
weight_unit
distance_unit
speed_unit
date_of_birth (optional)
created_at
updated_at
```

Do not require personal information that is not necessary.

---

# 9. Goals

Goals should be explicit and historical.

Examples:

- Target weight
- Build muscle
- Improve running endurance
- Improve consistency
- Complete a number of weekly workouts
- Reduce waist measurement
- Maintain weight

Suggested structure:

```text
goals
-----
id
type
title
target_value
unit
start_value
start_date
target_date (optional)
status
notes
created_at
updated_at
```

The user can have multiple goals.

---

# 10. Equipment Management

Equipment availability is important because workouts must be adaptable.

Example:

```text
Available equipment:

✓ Dumbbells
✓ Bench
✓ Treadmill
✓ Barbell

✕ Cable machine
✕ Leg press
```

Suggested table:

```text
equipment
---------
id
name
category
available
notes
created_at
updated_at
```

Exercises should be associated with equipment requirements.

This will later allow AI and local logic to suggest alternatives.

---

# 11. Exercise Library

Exercises should be reusable.

Suggested fields:

```text
exercise_library
----------------
id
name
category
primary_muscle
secondary_muscles
equipment
instructions
default_sets
default_reps
default_duration_seconds
difficulty
is_custom
created_at
updated_at
```

Categories can include:

- Chest
- Back
- Shoulders
- Arms
- Legs
- Core
- Full body
- Cardio
- Mobility

The user must be able to create custom exercises.

---

# 12. Exercise Alternatives

Every important exercise should support alternatives.

Example:

```text
Bench Press
    |
    +-- Dumbbell Bench Press
    +-- Chest Press Machine
```

The application should eventually support:

```text
Original exercise
      |
      +-- Equipment unavailable?
              |
              +-- Find compatible alternative
```

The first version may implement this with explicit alternative mappings.

Later, AI can improve the recommendation.

---

# 13. Workout Templates

A workout template is a reusable plan.

Examples:

- Monday Chest
- Wednesday Back
- Friday Legs
- Home Abs
- Full Body
- Treadmill Interval

Suggested:

```text
workout_templates
-----------------
id
name
type
description
duration_minutes
difficulty
created_at
updated_at
```

Workout exercises:

```text
workout_template_exercises
--------------------------
id
template_id
exercise_id
order_index
sets
target_reps
target_duration_seconds
target_weight
rest_seconds
notes
```

---

# 14. Planned vs Actual

This is a fundamental product concept.

The application must distinguish:

## Planned

What the user intended to do.

## Actual

What the user really completed.

Example:

```text
PLANNED
Running
30 minutes
6 → 9 mph
```

Actual:

```text
ACTUAL
22 minutes
6 → 8 mph
```

Do not overwrite the original plan.

Historical records must remain trustworthy.

---

# 15. Scheduled Sessions

A scheduled session represents something planned for a date/time.

Examples:

- Gym
- Abs
- Running
- Home workout
- Recovery
- Custom activity

Suggested:

```text
scheduled_sessions
------------------
id
workout_template_id
title
type
scheduled_date
start_time
end_time
status
notes
created_at
updated_at
```

Statuses:

```text
planned
in_progress
completed
modified
skipped
cancelled
```

A session marked completed should retain its actual execution details.

---

# 16. Weekly Planner

The planner is one of the core screens.

Example:

```text
MON
🏋 Chest
🔥 Abs

TUE
🏋 Back
🏃 Running

WED
🦵 Legs

THU
🏃 Running
🔥 Abs

FRI
🏋 Shoulders

SAT
🏃 Running

SUN
😴 Recovery
```

The planner should support:

- Day/week navigation.
- Add session.
- Move session.
- Edit session.
- Duplicate session.
- Skip session.
- Mark complete.
- Drag/reorder where practical.
- Quick start.
- Quick reschedule.

The interface should make the current day visually obvious.

---

# 17. Workout Execution

When the user starts a workout, switch from planning mode to execution mode.

Example:

```text
CHEST

1 / 5

Bench Press

Set 1
10 reps
20 kg

[ Complete Set ]

Rest
01:32
```

Execution must be simple.

The user should not need to navigate through multiple complicated screens between sets.

---

# 18. Timer System

Timers are optional per exercise but should be supported.

Types:

- Rest timer
- Exercise duration
- Countdown
- Interval timer
- Running interval timer

The user must be able to skip or modify a timer.

The application must not force timers on exercises that do not need them.

---

# 19. Running / Treadmill Module

Running deserves a dedicated system because the user creates structured speed plans.

A running workout consists of intervals.

Example:

```text
Running — 35 min

00:00–05:00
5 mph
Warmup

05:00–15:00
6 mph

15:00–20:00
8 mph

20:00–25:00
6 mph

25:00–30:00
9 mph

30:00–35:00
5 mph
Cooldown
```

Database concept:

```text
running_workouts
----------------
id
name
total_duration_seconds
distance_target
distance_unit
notes
created_at
updated_at
```

```text
running_intervals
-----------------
id
running_workout_id
order_index
duration_seconds
speed
speed_unit
incline
incline_unit
label
```

---

# 20. Running Execution UI

Example:

```text
RUNNING

CURRENT
8.0 mph

02:41 remaining

━━━━━━━━━━━━━━━━

NEXT
6.0 mph

━━━━━━━━━━━━━━━━

✓ Warmup
✓ 6 mph
→ 8 mph
○ 6 mph
○ 9 mph
○ Cooldown
```

The user should be able to:

- Pause
- Resume
- Skip interval
- Repeat interval
- Modify speed
- Modify duration
- Stop workout
- Finish early

Actual execution should be recorded.

---

# 21. Home Workout / Abs Module

Home workouts should behave like regular workouts but can have a simpler setup.

Example:

```text
Abs — 15 min

Crunches
20 reps

Leg Raises
15 reps

Plank
45 sec

Bicycle Crunches
20 reps
```

Support:

- Reps
- Duration
- Sets
- Rest
- Timers
- Completion tracking

The user can schedule these alongside gym workouts.

---

# 22. Recovery / Rest

Rest should be a first-class activity.

Example:

```text
Sunday
Recovery Day

No workout required.
```

The history should distinguish between:

- Planned rest
- Skipped workout

They are not the same thing.

---

# 23. Body Tracking

The Body section tracks physical progress independently from workouts.

Main categories:

```text
Weight
Height
Measurements
Body Photos
Hair
Beard
```

---

# 24. Weight Tracking

Suggested:

```text
weight_entries
--------------
id
value
unit
recorded_at
notes
```

The app should display:

- Current weight
- Previous weight
- Change
- Trend
- Weekly/monthly chart

Avoid misleading conclusions from individual measurements.

---

# 25. Height

Height is usually relatively stable and belongs in the profile.

Allow editing history if necessary, but do not create unnecessary complexity.

---

# 26. Body Measurements

Support custom measurements.

Examples:

- Chest
- Waist
- Hips
- Arm
- Thigh
- Neck
- Calf

Suggested:

```text
body_measurements
-----------------
id
measurement_type
value
unit
recorded_at
notes
```

The user should be able to add custom measurement types.

---

# 27. Progress Photos

Progress photos are sensitive and must be treated differently from ordinary media.

Categories:

```text
Body
  Front
  Side
  Back

Hair
  Front
  Top
  Side

Beard
  Front
  Side
```

Suggested metadata:

```text
progress_photos
---------------
id
category
sub_category
file_uri
captured_at
notes
```

Do not store image binary data inside SQLite.

SQLite stores metadata and a local private file path.

---

# 28. Photo Privacy

Photos should be stored in application-private storage.

Requirements:

- Do not automatically save sensitive photos to the normal gallery unless explicitly requested.
- Allow photo deletion.
- Allow viewing by date.
- Support app lock.
- Support biometric authentication where available.
- Avoid sending photos anywhere automatically.
- AI photo analysis must always be an explicit user action in a future version.

The default assumption is:

> Sensitive photos stay on the device.

---

# 29. Progress Photo Comparison

Provide a comparison mode.

Examples:

```text
September 1       September 24
   FRONT             FRONT
```

Allow:

- Side-by-side
- Before/after slider
- Date selection
- Category filtering

Do not automatically judge physical appearance.

---

# 30. Dashboard

The dashboard should answer:

> "What do I need to do today?"

Suggested structure:

```text
Good evening 👋

Today's Progress
████████░░ 80%

TODAY

18:00
🏋 Chest
45 min
[Start]

21:00
🔥 Abs
15 min
[Start]

BODY

74.6 kg
-0.4 kg this week

STREAK

🔥 6 days

UPCOMING

Tomorrow
🏃 Running — 30 min
```

The actual visual layout should be modern and creative, using the provided home-screen template as the main reference.

---

# 31. History

History should show actual activity.

Examples:

```text
SEP 24

✓ Chest
✓ Abs

SEP 23

✓ Running
22 min

SEP 22

✓ Back

SEP 21

Rest
```

Filters:

- Gym
- Running
- Home
- Abs
- Rest
- Body measurements
- Photos

---

# 32. Analytics

Analytics should be useful but not overwhelming.

Possible metrics:

### Training

- Sessions/week
- Completion rate
- Training frequency
- Muscle-group frequency
- Total workout time

### Running

- Total distance
- Total duration
- Average speed
- Interval history

### Body

- Weight trend
- Measurement trends

### Consistency

- Current streak
- Longest streak
- Planned vs completed

Do not create fake precision.

---

# 33. Planned vs Completed Analytics

Example:

```text
This week

Planned
8 sessions

Completed
6 sessions

Completion
75%
```

Also show:

```text
Gym
3 / 3

Running
1 / 2

Abs
2 / 3
```

This is more meaningful than a generic "fitness score".

---

# 34. Goals Dashboard

Show progress toward user-defined goals.

Example:

```text
TARGET WEIGHT

74.6 kg
      ↓
70.0 kg

███████░░░

4.6 kg remaining
```

Do not promise dates unless based on an explicit calculated trend and clearly labeled as an estimate.

---

# 35. Notifications

Notifications are local.

Examples:

```text
18:00
🏋 Chest workout starts in 15 minutes.
```

```text
20:45
🔥 Abs workout scheduled in 15 minutes.
```

```text
07:30
📏 Weekly body measurement reminder.
```

Allow per-activity notification settings.

The user can disable notifications entirely.

---

# 36. Calendar / Scheduling

The scheduling system should support:

- Weekly recurring patterns.
- One-time sessions.
- Rescheduling.
- Skipping.
- Duplication.
- Rest days.
- Time changes.

Do not force the user into a rigid weekly template.

---

# 37. Flexible Scheduling

Example:

The user normally trains chest Monday.

If Monday is unavailable:

```text
Move to Tuesday
```

The application should warn about conflicts where useful.

Example:

```text
Tuesday already contains:
Back + Running

Are you sure you want to add Chest?
```

The user remains in control.

---

# 38. Personalization Engine

The app should maintain a local representation of:

```text
User
Goals
Equipment
Schedule
Workout templates
History
Progress
Preferences
```

This enables future intelligent recommendations.

The local engine should handle deterministic logic.

Examples:

- Equipment availability.
- Schedule conflicts.
- Timer calculations.
- Workout completion.
- Progress calculations.
- Weekly totals.

Do not send these simple operations to AI.

---

# 39. AI Integration — Future Phase

AI is intentionally excluded from the first offline release.

When introduced, it should be a separate service layer.

Example:

```text
AIService
  |
  +-- analyzeProgress()
  +-- analyzeTraining()
  +-- estimateTrend()
  +-- adaptWorkout()
  +-- suggestAlternative()
  +-- summarizeWeek()
```

The application should not directly couple UI components to an AI provider.

---

# 40. AI Provider Abstraction

Use an abstraction such as:

```text
AIProvider
   |
   +-- OpenAIProvider
   +-- OtherProvider
```

The UI should call:

```text
AIService.analyze(...)
```

rather than calling a provider directly.

This makes changing providers easier.

---

# 41. AI Data Privacy

Before sending data to AI:

1. Build a controlled summary.
2. Send only information necessary for the requested analysis.
3. Do not send the entire SQLite database.
4. Do not send private photos automatically.
5. Require explicit user action for sensitive analysis.
6. Clearly show when data is being sent externally.

Example AI payload:

```json
{
  "goal": {
    "type": "weight",
    "target": 70
  },
  "currentWeight": 74.6,
  "weightTrend": -0.4,
  "weeklyTraining": {
    "gym": 4,
    "running": 2,
    "abs": 3
  }
}
```

---

# 42. AI Use Cases

Future AI features can include:

## Weekly analysis

> Analyze my last week.

## Progress analysis

> Analyze my weight trend.

## Workout adaptation

> I don't have a cable machine today. Adapt my workout.

## Schedule adaptation

> I missed Tuesday. Reorganize the rest of my week.

## Running analysis

> Analyze my running progression.

## Consistency analysis

> Compare my planned sessions with my completed sessions.

## Long-term analysis

> Analyze the last 8 weeks.

---

# 43. AI Must Not Become the Source of Truth

The application database remains authoritative.

AI output is:

- analysis
- explanation
- suggestion
- estimation

AI should not silently change:

- workouts
- goals
- measurements
- history
- schedules

If AI proposes a change:

```text
AI Suggestion

Move Leg Day from Thursday to Friday.

[Apply]
[Ignore]
```

The user decides.

---

# 44. AI and Health-Related Information

The application can provide tracking and general informational analysis.

It should avoid presenting uncertain health/fitness estimates as medical facts.

Examples of appropriate wording:

- "Based on your recorded trend..."
- "This is an estimate..."
- "Your recorded activity shows..."
- "Consider discussing persistent concerns with a qualified professional."

Do not present AI predictions as guarantees.

---

# 45. Design Direction

The application should feel:

- Modern
- Premium
- Clean
- Sporty
- Functional
- Fast
- Visual
- Motivating without being childish

Avoid:

- Generic template dashboards.
- Excessive gradients.
- Overloaded screens.
- Tiny controls.
- Excessive animations.
- Too many colors.
- Cheap-looking fitness clichés.

The provided logo, home template, and screenshots should guide the visual language.

The implementation agent should preserve:

- Brand identity.
- General spacing philosophy.
- Typography direction.
- Visual hierarchy.
- Main navigation intent.

But it should improve the design where necessary for usability.

---

# 46. Theme System

Create a centralized theme.

Example concepts:

```text
colors
typography
spacing
radius
shadows
icons
button variants
card variants
```

Do not hard-code colors throughout components.

The theme must make it easy to adjust branding later.

Support dark mode if it can be implemented cleanly without compromising the primary design.

---

# 47. Component Architecture

Use reusable components.

Example:

```text
components/
  ui/
    Button
    Card
    Input
    Modal
    Badge
    ProgressBar
    EmptyState
    SectionHeader

  workout/
    WorkoutCard
    ExerciseCard
    SetRow
    RestTimer
    WorkoutProgress

  running/
    IntervalCard
    RunningTimeline
    RunningTimer

  planner/
    DayColumn
    ScheduleCard
    WeekHeader

  progress/
    WeightCard
    MeasurementCard
    PhotoCard
    PhotoComparison

  dashboard/
    TodayCard
    ProgressSummary
    UpcomingCard
```

Avoid giant components.

---

# 48. Suggested Project Structure

```text
src/
  app/
    routes/screens

  components/
    ui/
    workout/
    running/
    planner/
    progress/
    dashboard/

  db/
    migrations/
    schema/
    repositories/

  domain/
    workouts/
    running/
    progress/
    scheduling/
    goals/

  store/
    workoutStore.ts
    plannerStore.ts
    progressStore.ts
    settingsStore.ts

  services/
    notifications/
    photos/
    analytics/
    ai/

  hooks/

  utils/

  types/

  constants/

  theme/
```

The exact Expo Router structure may differ.

---

# 49. Repository Pattern

UI components should not contain raw SQL.

Use repositories:

```text
WorkoutRepository
ExerciseRepository
ScheduleRepository
ProgressRepository
PhotoRepository
GoalRepository
```

Example:

```text
WorkoutRepository.getWorkout(id)
WorkoutRepository.createWorkout(data)
WorkoutRepository.completeWorkout(id)
```

This keeps the database implementation isolated.

---

# 50. Database Migrations

SQLite schema changes must use migrations.

Do not casually delete and recreate the database when the schema changes.

Example:

```text
migration_001_initial
migration_002_running_intervals
migration_003_progress_photos
...
```

The application should check and apply migrations during startup.

---

# 51. Seed Data

The application should contain useful initial exercise data.

Seed examples:

```text
Bench Press
Incline Dumbbell Press
Push Up
Pull Up
Lat Pulldown
Seated Row
Squat
Lunge
Leg Curl
Shoulder Press
Lateral Raise
Bicep Curl
Tricep Extension
Crunch
Leg Raise
Plank
```

The user can modify or extend the library.

---

# 52. First Launch Experience

On first launch:

```text
Welcome

Let's configure your training system.
```

Setup:

1. Name (optional)
2. Height
3. Current weight
4. Units
5. Main goal
6. Available equipment
7. Typical training days
8. Notification permission
9. Optional app lock

Do not make the onboarding excessively long.

The user must be able to skip optional steps.

---

# 53. Main Navigation

Recommended initial navigation:

```text
Home
Plan
Train
Progress
History
```

Settings can be accessed from the profile/settings button.

The implementation agent may adapt the navigation to the supplied home-screen design.

---

# 54. Home Screen Priorities

The first screen should prioritize:

1. Today's workout.
2. Today's schedule.
3. Quick start.
4. Current progress.
5. Upcoming session.
6. Useful quick actions.

Do not make the home screen a giant analytics dashboard.

---

# 55. Quick Actions

Examples:

```text
+ Workout
+ Running
+ Weight
+ Measurement
+ Photo
```

These should be easy to access.

---

# 56. Empty States

Every module needs a useful empty state.

Example:

```text
No workouts yet.

Create your first workout plan
and start tracking your progress.

[Create Workout]
```

Never leave a blank screen.

---

# 57. Error Handling

Errors must be human-readable.

Bad:

```text
SQLite constraint failed: UNIQUE...
```

Good:

```text
We couldn't save this workout.
Your existing session was not changed.
```

Log technical details internally where useful.

---

# 58. Offline Requirements

The application must function with:

```text
Airplane Mode
```

Core features must still work:

- Open app
- View schedule
- Start workouts
- Run timers
- Record sets
- Record running intervals
- Record weight
- Take/store progress photos
- View history
- View analytics
- Edit workouts
- Edit goals

AI naturally requires internet and is not part of offline core functionality.

---

# 59. Backup / Export

Because the application is local-only, export is important.

Implement a data export mechanism.

Preferred format:

```text
JSON
```

Export should include structured data but should not expose private image files unless explicitly selected.

Example:

```text
personal-training-backup.json
```

Potential future export:

```text
ZIP
 ├── data.json
 └── photos/
```

But photo export must be an explicit action.

---

# 60. Import

Support restoring structured data from an exported JSON backup.

Before importing:

```text
This will add/replace local data.

[Cancel]
[Continue]
```

Do not silently destroy existing data.

---

# 61. Data Integrity

Important principles:

- Never overwrite historical completed sessions unnecessarily.
- Preserve timestamps.
- Preserve original planned values.
- Preserve actual values separately.
- Use IDs for relationships.
- Use ISO timestamps consistently.
- Validate data before database writes.
- Handle partial failures safely.

---

# 62. Performance

The app should feel fast.

Requirements:

- Avoid unnecessary full-database queries.
- Use indexed columns for frequently queried dates and IDs.
- Lazy-load historical photos.
- Do not load every progress image at once.
- Use thumbnails where useful.
- Keep animations short and purposeful.
- Avoid unnecessary global re-renders.

---

# 63. Security / Privacy

This is a private personal application.

Sensitive data includes:

- Body photos
- Hair photos
- Beard photos
- Measurements
- Weight
- Training history

Requirements:

- Store sensitive photos privately.
- Do not upload automatically.
- Do not log sensitive data.
- Do not include sensitive values in analytics/crash logs.
- Support app lock where possible.
- Use SecureStore for sensitive small configuration values when appropriate.

---

# 64. No Backend in V1

Do not create:

- Laravel backend
- Node backend
- PostgreSQL
- Firebase
- Supabase
- Authentication server

unless required by a future feature.

The entire V1 application should work locally.

This keeps development simple and preserves privacy.

---

# 65. Future Cloud Architecture

If cloud sync is eventually required:

```text
Mobile App
    |
    +-- Local SQLite
    |
    +-- Sync Engine
            |
            ▼
       Backend API
            |
            ▼
        Cloud DB
```

Local SQLite should remain the primary offline cache.

Do not design V1 in a way that makes future synchronization impossible.

Use stable IDs and timestamps from the beginning.

---

# 66. AI Architecture Later

Future architecture:

```text
Mobile App
   |
   +-- SQLite
   |
   +-- AI Service
          |
          +-- Prompt Builder
          +-- Data Summarizer
          +-- Provider Adapter
          |
          +-- AI Provider API
```

The AI service should receive summarized data rather than raw database dumps.

---

# 67. Suggested Screens

At minimum:

```text
01 Splash
02 Onboarding
03 Home
04 Weekly Planner
05 Day Details
06 Workout Details
07 Workout Execution
08 Exercise Details
09 Running Workout Builder
10 Running Execution
11 Home/Abs Workout
12 Progress Dashboard
13 Weight History
14 Measurements
15 Progress Photos
16 Photo Comparison
17 History
18 Goals
19 Equipment
20 Exercise Library
21 Settings
22 Notifications
23 Backup / Export
24 App Lock
```

Some screens may be combined if the final UX is better.

---

# 68. Workout Builder

Allow:

- Name
- Type
- Exercises
- Sets
- Reps
- Duration
- Rest
- Notes
- Exercise order
- Alternatives

Support drag/reorder.

Allow duplication of an existing workout.

---

# 69. Running Builder

Allow:

- Workout name
- Interval list
- Duration
- Speed
- Incline
- Label
- Warmup/cooldown
- Reordering
- Duplicate interval
- Delete interval

Show total calculated duration.

Example:

```text
Total
35:00
```

---

# 70. Progress Dashboard

Suggested sections:

```text
Current Weight
Weight Trend

Measurements
Recent Changes

Training
This Week

Consistency
Planned vs Completed

Photos
Latest Comparisons
```

Charts should be readable and not overloaded.

---

# 71. History Detail

When opening a completed workout, show:

```text
Chest
September 24

Duration
47 min

Exercises
Bench Press
4 × 10
...

Planned vs Actual
...

Notes
...
```

---

# 72. Notes

Allow notes on:

- Workouts
- Exercises
- Body measurements
- Weight
- Progress photos
- Running sessions

Notes can later be summarized by AI.

---

# 73. Search

Search should eventually cover:

- Exercises
- Workouts
- History

Do not implement a complicated search engine in V1.

Simple local search is sufficient.

---

# 74. Accessibility

Support:

- Readable text sizes.
- Sufficient contrast.
- Large touch targets.
- Clear states not based only on color.
- Screen reader labels for important controls.
- Avoid overly small buttons.

---

# 75. Animations

Animations should communicate state.

Useful examples:

- Workout completion.
- Progress ring updates.
- Timer transitions.
- Screen transitions.
- Checkbox/set completion.
- Photo comparison slider.

Avoid excessive animation.

The app should feel premium, not distracting.

---

# 76. Important UX Principle: Fast During Training

When the user is physically training, interaction must be minimal.

The workout screen should prioritize:

```text
What exercise?
What set?
What weight/reps?
Rest timer?
Next?
```

Avoid requiring unnecessary typing during a workout.

---

# 77. Important UX Principle: Planning Can Be Detailed

Planning screens can be more detailed.

This is where the user can configure:

- Exercises
- Sets
- Reps
- Timers
- Equipment
- Schedule
- Running intervals

Execution screens should be simplified.

---

# 78. Important UX Principle: History Must Be Trustworthy

Never silently rewrite the past.

If a workout was modified:

```text
Planned:
30 min

Actual:
22 min
```

Keep both.

This will be extremely valuable for future analytics and AI.

---

# 79. Future Smart Adaptation

A future local rules engine can handle simple adaptations before AI.

Example:

```text
IF equipment unavailable
THEN show mapped alternatives
```

```text
IF session conflicts with another session
THEN show schedule conflict
```

```text
IF user skipped a session
THEN offer reschedule
```

AI should be used for more complex reasoning.

---

# 80. Future AI Weight Trend Analysis

The app may eventually calculate:

```text
Current weight
Historical weight trend
Training frequency
Goal target
```

Then ask AI for interpretation.

The app should display:

```text
Estimated trend:
-0.4 kg/week

Estimated time to target:
approximately 11–12 weeks

This is an estimate based on recorded trend.
```

Do not guarantee the result.

---

# 81. Future AI Weekly Coach

Possible screen:

```text
WEEKLY INSIGHT

You completed:
6 / 8 sessions

Gym:
3 / 3

Running:
1 / 2

Abs:
2 / 3

AI SUMMARY

Your planned and completed training differed mainly
because two sessions were skipped.

Suggestions:
• Move running to Saturday.
• Keep your next planned rest day.
• Review your running interval progression.
```

Every recommendation should be actionable and explainable.

---

# 82. Development Strategy

The implementation agent must build in phases.

## Phase 1 — Foundation

- Initialize Expo project.
- TypeScript.
- Expo Router.
- Theme.
- Basic navigation.
- Reusable UI components.
- SQLite setup.
- Migration system.
- Seed data.

## Phase 2 — Profile / Settings

- User profile.
- Units.
- Goals.
- Equipment.
- Preferences.

## Phase 3 — Exercise / Workout System

- Exercise library.
- Workout templates.
- Workout builder.
- Exercise alternatives.
- Workout execution.
- Sets/reps/rest.

## Phase 4 — Planner

- Weekly planner.
- Scheduling.
- Rescheduling.
- Session states.
- Planned vs actual.

## Phase 5 — Running

- Running builder.
- Intervals.
- Running execution.
- Timers.
- Actual tracking.

## Phase 6 — Progress

- Weight.
- Measurements.
- Progress photos.
- Photo comparison.
- Private file storage.

## Phase 7 — Analytics / History

- History.
- Charts.
- Planned vs actual.
- Consistency.
- Goals progress.

## Phase 8 — Notifications

- Local reminders.
- Workout reminders.
- Measurement reminders.

## Phase 9 — Backup

- JSON export.
- Import.
- Data validation.

## Phase 10 — Polish

- Animations.
- Empty states.
- Error states.
- Accessibility.
- Performance.
- Visual refinement.

## Phase 11 — AI Integration

Only after the offline application is stable.

---

# 83. Definition of Done for V1

The application is considered complete when the user can:

1. Install/open the application.
2. Configure profile and goals.
3. Configure equipment.
4. Browse exercises.
5. Create workouts.
6. Schedule workouts.
7. View the weekly plan.
8. Start a gym workout.
9. Record sets/reps.
10. Use rest timers.
11. Create a running interval plan.
12. Execute the running plan.
13. Create home/abs workouts.
14. Schedule home workouts.
15. Record weight.
16. Record measurements.
17. Capture private progress photos.
18. Compare photos.
19. View history.
20. View analytics.
21. Receive local reminders.
22. Export data.
23. Import data.
24. Use all core features with no internet.
25. Close/reopen the app without losing data.

---

# 84. Quality Requirements

Before finalizing, test:

### Functional

- Create.
- Edit.
- Delete.
- Complete.
- Skip.
- Reschedule.
- Duplicate.

### Database

- Fresh install.
- Existing database migration.
- Invalid data.
- Interrupted writes.

### Offline

Enable airplane mode and test every core feature.

### Photos

- Camera.
- Permissions.
- Private storage.
- Delete.
- Compare.
- Large image handling.

### Notifications

- Schedule.
- Cancel.
- Reschedule.
- Permission denied.

### Performance

Test with:

- Hundreds of workout sessions.
- Hundreds of history records.
- Many progress photos.

---

# 85. APK / Build Requirements

The final project must be configured so it can be built into an Android APK.

The implementation agent should provide:

- Development run instructions.
- Android build instructions.
- APK generation instructions.
- Release configuration.
- App icon.
- Splash screen.
- App name.
- Package identifier.

The project must be exportable without requiring a custom backend.

---

# 86. App Branding

Brand assets will be provided separately.

Expected available assets may include:

```text
logo
home template
screenshots
other visual references
```

Use them as references and integrate them into the final application.

Do not replace the supplied branding with generic fitness branding.

The implementation agent should creatively fill gaps while preserving the supplied identity.

---

# 87. Product Personality

The application should feel like:

> A private, intelligent personal training command center.

Not:

> A generic gym checklist.

The visual experience should communicate:

- Progress
- Control
- Consistency
- Personalization
- Privacy
- Simplicity
- Performance

---

# 88. What Makes This Application Different

The key differentiators are:

### 1. Everything in one place

Gym + running + home + body + schedule + history.

### 2. Flexible execution

The plan can change without destroying the original plan.

### 3. Equipment-aware workouts

The application understands what equipment is available.

### 4. Structured running plans

Running sessions are explicit interval programs instead of mental plans.

### 5. Private progress tracking

Sensitive photos remain local/private.

### 6. Planned vs actual history

The application understands what was intended versus what actually happened.

### 7. Offline-first

No account or internet is required.

### 8. AI-ready

AI can later analyze structured personal history instead of receiving disconnected information.

---

# 89. Final Architecture Summary

```text
                    PERSONAL TRAINING APP
                             |
              ┌──────────────┴──────────────┐
              |                             |
           FRONTEND                      LOCAL DATA
              |                             |
     React Native + Expo                  SQLite
          TypeScript                        |
              |                             |
       Expo Router                  ┌───────┼────────┐
              |                     |       |        |
       ┌──────┼──────┐           Plans   History  Progress
       |      |      |                     |
      Home   Plan   Train                   |
       |      |      |                     |
       └──────┼──────┘                     |
              |                             |
       ┌──────┼─────────────┐               |
       |      |             |               |
      Gym   Running        Home             |
                     / Abs                 |
                                             |
                                      Private Files
                                             |
                                      Body / Hair /
                                      Beard Photos
                                             |
                                             |
                                      Future AI Layer
                                             |
                                    ┌────────┴────────┐
                                    |                 |
                                Analysis          Adaptation
                                    |                 |
                                    └────────┬────────┘
                                             |
                                          User
```

---

# 90. Final Implementation Principle

Do not try to build every future feature immediately.

The correct order is:

```text
SOLID LOCAL DATA
       ↓
GOOD WORKOUT UX
       ↓
GOOD PLANNER
       ↓
GOOD PROGRESS TRACKING
       ↓
GOOD HISTORY
       ↓
POLISH
       ↓
AI
```

The app must already be genuinely useful before AI is introduced.

AI should make an already excellent personal training tracker smarter, not compensate for a weak foundation.

---

# 91. Implementation Agent Instructions

Before writing code, the implementation agent should:

1. Read this entire document.
2. Inspect every supplied asset.
3. Inspect the provided home-screen template and screenshots.
4. Extract the visual language from those references.
5. Create a concise implementation plan.
6. Identify any technical conflicts with current Expo APIs.
7. Select compatible package versions.
8. Define the SQLite schema and migrations.
9. Define TypeScript domain models.
10. Establish the navigation architecture.
11. Establish the design system.
12. Then begin implementation phase by phase.

Do not skip directly to building random screens.

The final result should be coherent as one application.

---

# 92. Expected Final Result

The final application should feel like a polished, modern personal fitness platform that can be used every day.

A typical day should look like:

```text
Open App
   ↓
See today's plan
   ↓
Start workout
   ↓
Execute / adapt workout
   ↓
Record actual result
   ↓
Finish
   ↓
History updated
   ↓
Progress updated
   ↓
Tomorrow's plan visible
```

Over weeks:

```text
Daily Activity
      ↓
Structured History
      ↓
Progress Trends
      ↓
Better Planning
      ↓
Future AI Analysis
      ↓
Smarter Personalization
```

The long-term objective is:

> **One private application that understands the user's training routine, schedule, equipment, execution history, body-progress history, and goals well enough to help organize and analyze their personal training life.**

The application should remain user-controlled, local-first, privacy-conscious, and useful without AI.
