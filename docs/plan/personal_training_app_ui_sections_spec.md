# Personal Training App — UI, Navigation & App Sections Specification

## Purpose

This document defines the mobile app information architecture, navigation, home screen, major sections, UI behavior, and user flows for the Personal Training App.

It is intended to be provided **together with the main project specification** to the implementation AI/agent.

The implementation agent should use this document to understand **how the application should be organized and how the user should move through it**.

The app should feel like a modern, premium, intelligent personal training system — not simply a workout checklist.

Core UX philosophy:

> **Plan → Start → Execute → Record → Review → Improve**

---

# 1. Core Navigation

The application has five primary bottom-navigation destinations:

1. **Home**
2. **Train**
3. **Start**
4. **Progress**
5. **Plan**

The central **Start** button should be visually emphasized as a floating/action button.

```text
┌────────┬────────┬────────────┬──────────┬────────┐
│   🏠   │   🏋   │     ▶      │    📈    │   📅   │
│  Home  │  Train │   START    │ Progress │  Plan  │
└────────┴────────┴────────────┴──────────┴────────┘
```

Navigation meaning:

| Section | Main question |
|---|---|
| Home | What do I need to do today? |
| Train | What workouts and exercises can I do? |
| Start | What am I doing right now? |
| Progress | How am I improving? |
| Plan | What am I doing later? |

Do not add every feature as a bottom-tab item. Body information, gallery, history, AI, settings, notifications, and configuration should be grouped logically.

---

# 2. Home — Daily Command Center

Home is the most important screen.

When the user opens the app, they should immediately understand:

- Current day/date
- Today's planned activities
- What is completed
- What remains
- Whether today is a training or rest day
- What can be started/resumed
- Basic weekly status
- Useful quick actions
- A small amount of progress information

Home should answer:

> **What do I need to know and do today?**

Do not turn Home into a giant analytics dashboard.

---

# 3. Home Header

Recommended:

```text
Good evening 👋

Wednesday, September 24

TODAY
```

Greeting can change according to time of day.

A profile/settings icon should be available in the header.

---

# 4. Today's Main Status Card

This is the dominant Home component.

Example:

```text
┌──────────────────────────────────┐
│ TODAY                            │
│                                  │
│ 3 activities                     │
│                                  │
│ ✓ Running       30 min           │
│ ○ Gym           Upper Body       │
│ ○ Six Pack      12 min           │
│                                  │
│ 1 / 3 completed                  │
│ ███████░░░░░░░                   │
└──────────────────────────────────┘
```

It should communicate:

- Total planned activities
- Completed activities
- Remaining activities
- Activity types
- Progress

Status should not rely on color alone.

---

# 5. Rest Day State

Rest is an intentional planned state, not "nothing happened".

Example:

```text
┌──────────────────────────────────┐
│ TODAY                            │
│                                  │
│             ☕                   │
│        Recovery Day              │
│                                  │
│ No workout scheduled today.      │
│                                  │
│ Next activity                    │
│ Tomorrow · Gym · 18:00           │
│                                  │
│       [ View Schedule ]          │
└──────────────────────────────────┘
```

Never treat a planned rest day as a skipped workout.

---

# 6. Today's Activities

Show detailed activities below the main status card.

Example:

```text
TODAY'S ACTIVITIES

┌──────────────────────────────────┐
│ 🏃 Running                       │
│ 30 min · Intervals              │
│ ✓ Completed                      │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│ 🏋 Gym                           │
│ Upper Body · 55 min             │
│ 6 exercises · 4 remaining       │
│                                  │
│ [ Continue ]                     │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│ 🔥 Six Pack                      │
│ Abs · 12 min                    │
│ ○ Not started                    │
└──────────────────────────────────┘
```

Support statuses:

- Planned
- In progress
- Completed
- Modified
- Skipped
- Cancelled

Use text/icons as well as color.

---

# 7. Home Quick Actions

Recommended:

```text
QUICK ACTIONS

┌─────────┐ ┌─────────┐ ┌─────────┐
│   +     │ │   🏃    │ │   ⚖     │
│ Workout │ │ Running │ │ Weight  │
└─────────┘ └─────────┘ └─────────┘

┌─────────┐ ┌─────────┐
│   📏    │ │   📷    │
│ Measure │ │  Photo  │
└─────────┘ └─────────┘
```

Possible quick actions:

- Add workout
- Add running session
- Add weight
- Add body measurement
- Capture progress photo

Keep these fast and compact.

---

# 8. Weekly Status

Home should show a compact weekly summary.

Example:

```text
THIS WEEK

4       2       3       126
Gym     Runs    Abs     Minutes
```

Or:

```text
THIS WEEK

████████████████░░░░  80%

5 / 6 planned activities completed
```

Possible metrics:

- Planned activities
- Completed activities
- Gym sessions
- Running sessions
- Abs/home sessions
- Total training time
- Current streak
- Weekly consistency

Do not show every metric on Home.

---

# 9. Streak

A small consistency indicator can be shown:

```text
🔥 7 day streak

4 gym · 2 runs · 3 abs
4h 18m training this week
```

Keep gamification subtle and useful.

---

# 10. Central Start Button

The central bottom button is a core feature and should be visually prominent.

It is context-aware.

Possible states:

```text
▶ START
```

```text
▶ CONTINUE
```

```text
✓ TODAY COMPLETE
```

It should understand the current planned/execution state.

---

# 11. Start — Daily Training Sequence

If today contains:

```text
✓ Running
○ Gym
○ Six Pack
```

pressing Start can open:

```text
TODAY'S TRAINING

✓ Running
   Completed

→ Gym
   Next

○ Six Pack

[ Start Gym ]
```

After Gym:

```text
✓ Running
✓ Gym
→ Six Pack
```

This creates a unified daily execution flow.

---

# 12. Start / Resume Behavior

Execution state must be preserved.

Example:

```text
Upper Body
Bench Press

Set 2 / 4

[ Continue ]
```

If the user leaves the app, the app should resume correctly.

Preserve:

- Current workout
- Current exercise
- Current set
- Recorded sets
- Timer/rest state
- Running interval state
- Pause/resume state

Never lose completed execution data because the user temporarily leaves the screen.

---

# 13. Train Section

Train represents:

> **What workouts and exercises can I do?**

Distinction:

- Train = available workouts
- Plan = when workouts happen
- Start = executing workouts

Recommended:

```text
TRAIN

[ Gym ] [ Running ] [ Six Pack ] [ Other ]

MY WORKOUTS

Upper Body
Leg Day
Push
Pull
Abs
30 min Run
Interval Run

                              +
                           Create
```

Possible sections:

- My Workouts
- Running Workouts
- Home/Abs Workouts
- Templates
- Exercise Library
- Equipment

---

# 14. Create Workout

Allow custom workouts.

Possible flow:

```text
Create Workout

Name
Type
Description
Estimated duration
Difficulty

Exercises

+ Add Exercise

[ Save Workout ]
```

Workouts can then be:

- Started immediately
- Scheduled
- Duplicated
- Edited
- Archived

---

# 15. Exercise Library

Each exercise can include:

- Name
- Category
- Primary muscles
- Secondary muscles
- Equipment
- Instructions
- Default sets/reps/duration
- Difficulty
- Alternatives

Provide search and filtering.

---

# 16. Equipment and Alternatives

Equipment availability is a major feature.

Example:

```text
Equipment

✓ Bench
✓ Dumbbells
✓ Barbell
✗ Cable Machine
✓ Treadmill
```

When equipment is unavailable:

```text
Cable Fly unavailable

Alternatives:

• Dumbbell Fly
• Machine Chest Fly

[ Replace Exercise ]
```

Basic deterministic alternatives should work without AI. AI can later improve recommendations.

---

# 17. Progress Section

Progress combines:

- Body
- Weight
- Measurements
- Private progress photos
- Training history
- Analytics

They all answer:

> **How am I progressing over time?**

Do not make Body, Gallery, History, and Analytics separate primary tabs.

---

# 18. Progress Main Screen

Example:

```text
PROGRESS

Weight
74.6 kg
↓ 0.4 kg this week

[ Weight Trend ]

────────────────────────

BODY

Height
Weight
Measurements

────────────────────────

PHOTOS

Body
Hair
Beard

[ Compare ]

────────────────────────

TRAINING

Workouts
Running
Abs
Consistency
Personal Records

────────────────────────

HISTORY

All activity
```

---

# 19. Body Tracking

Include:

- Height
- Current weight
- Weight history
- Chest
- Waist
- Arms
- Legs
- Hips
- Neck
- Custom measurements

Every measurement has:

- Value
- Unit
- Date
- Optional note

---

# 20. Private Progress Photos

Photos are sensitive and should be treated differently from ordinary media.

Categories:

```text
BODY
├── Front
├── Side
└── Back

HAIR
├── Front
├── Top
└── Side

BEARD
├── Front
├── Left
├── Right
└── Other
```

Photos should be stored in private app storage by default.

SQLite stores photo metadata/file URI, not image binaries.

Do not automatically upload photos.

Do not automatically copy them to the normal gallery.

Future AI photo analysis must require explicit user action.

---

# 21. Photo Comparison

Support:

- Side-by-side
- Before/after
- Slider comparison

Example:

```text
BODY PROGRESS

Before                Current
────────              ────────
Photo                 Photo

January 10            September 24

        [ Compare ]
```

Allow selecting dates.

---

# 22. Training History

History belongs under Progress and should show actual activity.

Filters:

```text
ALL

[ Gym ] [ Running ] [ Abs ] [ Rest ] [ Body ]
```

Show:

- Date
- Activity type
- Duration
- Completion status
- Key metrics
- Notes

Always preserve the difference between planned and actual activity.

Never overwrite the original plan when the user changes what they actually did.

---

# 23. Progress Analytics

Possible analytics:

- Sessions per week
- Completion rate
- Muscle group frequency
- Total workout time
- Running distance
- Running duration
- Average speed
- Weight trend
- Measurement trends
- Planned vs completed
- Current streak
- Longest streak
- Personal records

Keep charts clean and readable.

---

# 24. Plan Section

Plan answers:

> **What am I doing later?**

It is the complete scheduling system.

Example:

```text
PLAN

September 2026

<       WEEK       >

Mon  Tue  Wed  Thu  Fri  Sat  Sun
 ●    ●    ●    ○    ●    ○    ○

TODAY

Wednesday

18:00  🏋 Gym
20:00  🔥 Six Pack

UPCOMING

Thu
Rest

Fri
🏃 Running

Sat
🏋 Gym

                         + Add
```

Allow:

- Day
- Week
- Month

views.

---

# 25. Scheduling Capabilities

Support:

- One-time activities
- Daily repetition
- Weekly repetition
- Monthly repetition
- Custom repetition
- Selected weekdays
- Time of day
- Rest days
- Rescheduling
- Skipping
- Duplicating
- Editing
- Conflict warnings

Example:

```text
WHAT?

○ Gym
○ Running
○ Six Pack
○ Rest
○ Other

WHEN?

Date
Time

REPEAT?

Never
Daily
Weekly
Monthly
Custom

DAYS

☑ Mon
☐ Tue
☑ Wed
☐ Thu
☑ Fri
```

---

# 26. Planned vs Actual

Scheduling and execution must remain separate.

Example:

```text
PLANNED

Wednesday 18:00
Gym — Upper Body
```

Actual:

```text
ACTUAL

Wednesday 19:10
Gym — Upper Body
Modified
```

Keep the original plan for historical analysis.

This enables:

- Planned vs completed
- Planned vs actual time
- Rescheduling frequency
- Missed activities
- Consistency

---

# 27. AI Coach

AI should be a cross-app intelligence layer rather than necessarily a permanent bottom-tab.

Access it from:

### Home
```text
✨ Ask your coach
```

### Progress
```text
✨ Analyze my progress
```

### Workout
```text
✨ Adapt this workout
```

### Running
```text
✨ Analyze my running
```

### Schedule
```text
✨ Improve my schedule
```

Also provide a dedicated AI Coach screen accessible from Home/Profile.

---

# 28. AI Coach Screen

Example:

```text
AI COACH

Good evening 👋

I analyzed your recent activity.

You completed 5/6 planned
activities this week.

Your running volume increased
compared with last week.

────────────────────────

What would you like to know?

[ Analyze my week ]
[ Analyze my progress ]
[ Improve my schedule ]
[ Adapt my workouts ]
[ Running analysis ]

────────────────────────

Ask anything...

"How is my progress?"
```

Support both:

- Free-form chat
- Action-based reports/analysis

---

# 29. AI Actions Require Approval

AI must not silently modify the user's data or schedule.

Example:

```text
AI SUGGESTION

Your Friday workout conflicts
with your current schedule.

Suggested change:

Friday → Rest
Saturday → Gym

[ Apply Change ]
[ Ignore ]
```

User approval is required for:

- Moving workouts
- Replacing exercises
- Changing schedules
- Modifying workouts

---

# 30. AI Architecture

The UI should use an internal abstraction:

```text
AIService

+ analyzeProgress()
+ analyzeTraining()
+ estimateTrend()
+ adaptWorkout()
+ suggestAlternative()
+ summarizeWeek()
```

The UI should not directly depend on one provider.

Conceptually:

```text
UI
 │
 ▼
AIService
 │
 ├── OpenAIProvider
 ├── OtherProvider
 └── FutureProvider
```

AI should receive controlled summaries rather than the entire local database.

Example:

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

Use careful wording such as "based on your recorded trend" and "estimated". Avoid false precision or guarantees.

---

# 31. Profile and Settings

Access through the profile icon in Home.

Recommended:

```text
PROFILE

My Information
Goals
Body
Equipment
Preferences

────────────────

AI

AI Provider
API Configuration
AI Preferences

────────────────

APP

Notifications
Theme
Language
Units
Privacy
App Lock
Backup & Export

────────────────

About
```

---

# 32. Profile

Possible settings:

- Optional name
- Height
- Height unit
- Weight unit
- Distance unit
- Speed unit
- Optional date of birth
- Training preferences

Do not force unnecessary information.

---

# 33. Goals

Possible goals:

- Weight
- Training consistency
- Running
- Workout frequency
- Custom

Each goal may contain:

- Title
- Target value
- Unit
- Start value
- Start date
- Optional target date
- Status
- Notes

---

# 34. AI Provider Configuration

Future settings can support:

```text
AI Provider

Provider:
[ OpenAI / Other ]

API Key:
[ *************** ]

Model:
[ configurable ]

[ Test Connection ]
```

Provider-specific logic must stay behind the AI service abstraction.

API keys/secrets should use secure storage such as Expo SecureStore where appropriate.

Never log API keys.

---

# 35. Theme and Appearance

Support:

- Light
- Dark
- System

Optional:

- Accent color
- Theme presets

Use centralized theme tokens instead of hardcoded colors in screens.

---

# 36. Language

Architecture should support localization.

At minimum:

- English
- French
- Future languages

Avoid hardcoding user-facing strings throughout components.

---

# 37. Notifications

Configurable notification types:

- Workout reminder
- Running reminder
- Measurement reminder
- Weight reminder
- Progress photo reminder
- Schedule reminder

Allow individual categories to be disabled.

---

# 38. App Lock and Privacy

Because the app contains sensitive body/progress information:

- Support app lock
- Support biometrics where available
- Use PIN fallback where appropriate
- Keep private photos in app-private storage
- No backend required for V1
- Do not automatically upload sensitive data

---

# 39. Backup and Export

Support local:

- Structured data export
- Structured data import
- Backup/restore

JSON is suitable for structured data.

Photos should only be included in a backup when explicitly selected.

---

# 40. Home Priority Rules

Highest priority:

1. Today's date
2. Today's status
3. Today's activities
4. Current/resumable activity
5. Start/Continue action

Medium priority:

6. Quick actions
7. Weekly status
8. Streak
9. Upcoming activity

Lower priority:

10. Small progress insight
11. AI insight
12. Secondary information

Do not let analytics push today's activities too far down.

---

# 41. UI Design Direction

The application should feel:

- Modern
- Premium
- Sporty
- Clean
- Intelligent
- Focused
- Visual
- Fast

Avoid:

- Generic fitness clichés
- Excessive gradients
- Too many colors
- Overloaded dashboards
- Tiny controls
- Excessive animation
- Huge walls of text
- Decorative elements that do not improve usability

Use consistent:

- Spacing
- Typography
- Radius
- Icons
- Buttons
- Cards
- Theme tokens

---

# 42. Execution UI vs Planning UI

Planning screens can contain more information.

Execution screens should be extremely focused.

Example gym execution:

```text
BENCH PRESS

Set 2 / 4

Weight
[ 60 kg ]

Reps
[ 10 ]

REST

00:42

[ Complete Set ]
```

Running:

```text
INTERVAL 3 / 8

RUN
06:30

Speed
8.5 km/h

Next
Walk · 02:00

[ Pause ]
[ Skip ]
```

Execution should prioritize:

- Large controls
- Readable numbers
- Timer
- Current exercise/interval
- Next step
- Complete
- Pause
- Skip
- Resume

---

# 43. Mobile Layout

Support common phone sizes.

Use:

- Safe areas
- Scroll views
- Large touch targets
- Bottom sheets where useful
- Responsive spacing
- Dynamic text
- Keyboard-aware forms where needed

---

# 44. Accessibility

The app should:

- Have sufficient contrast
- Avoid relying only on color
- Provide accessible labels
- Use large touch targets
- Support readable text sizes
- Preserve logical screen-reader order
- Provide meaningful button labels

---

# 45. Performance

Home should load quickly.

Requirements:

- Do not load every progress photo immediately
- Use thumbnails for photo grids
- Lazy-load heavy content
- Avoid unnecessary re-renders
- Index frequent SQLite queries
- Keep timers responsive
- Preserve execution state correctly

---

# 46. Final Information Architecture

```text
APP
│
├── HOME
│   ├── Today
│   ├── Today's Activities
│   ├── Start/Continue
│   ├── Quick Actions
│   ├── Weekly Status
│   ├── Streak
│   └── AI Insight
│
├── TRAIN
│   ├── Gym
│   ├── Running
│   ├── Six Pack / Home
│   ├── Other
│   ├── My Workouts
│   ├── Templates
│   ├── Exercise Library
│   └── Equipment
│
├── START
│   ├── Daily Sequence
│   ├── Resume
│   ├── Gym Execution
│   ├── Running Execution
│   ├── Home/Abs Execution
│   └── Completion
│
├── PROGRESS
│   ├── Overview
│   ├── Weight
│   ├── Measurements
│   ├── Photos
│   │   ├── Body
│   │   ├── Hair
│   │   └── Beard
│   ├── Compare
│   ├── Training Analytics
│   └── History
│
├── PLAN
│   ├── Day
│   ├── Week
│   ├── Month
│   ├── Scheduled Activities
│   ├── Repetitions
│   ├── Rest Days
│   └── Upcoming
│
├── AI COACH
│   ├── Chat
│   ├── Reports
│   ├── Progress Analysis
│   ├── Training Analysis
│   ├── Running Analysis
│   ├── Schedule Suggestions
│   └── Workout Adaptation
│
└── PROFILE / SETTINGS
    ├── Personal Information
    ├── Goals
    ├── Equipment
    ├── Theme
    ├── Language
    ├── Units
    ├── Notifications
    ├── Privacy
    ├── App Lock
    ├── AI Provider
    └── Backup / Export
```

---

# 47. Recommended Reusable UI Components

Build reusable components rather than independent one-off screens.

Examples:

- `TodayStatusCard`
- `ActivityCard`
- `QuickActionButton`
- `WeeklySummary`
- `StreakCard`
- `StartButton`
- `WorkoutCard`
- `ExerciseCard`
- `ProgressCard`
- `PhotoCategoryCard`
- `CalendarView`
- `ScheduleItem`
- `AIActionCard`
- `AIInsightCard`
- `EmptyState`
- `RestDayCard`
- `ExecutionTimer`
- `SetLogger`
- `RunningIntervalCard`

Use shared design tokens for colors, typography, radius, shadows, spacing, icon sizes, and touch targets.

---

# 48. Separation of Responsibilities

Keep these boundaries clear:

```text
HOME
= summary

TRAIN
= workout creation/library

START
= execution

PROGRESS
= historical data and evolution

PLAN
= scheduling

AI
= analysis and suggestions

SETTINGS
= configuration
```

Examples:

- Creating a workout belongs to Train.
- Scheduling a workout belongs to Plan.
- Performing the workout belongs to Start.
- Reviewing completed activity belongs to Progress.
- Asking AI to analyze it belongs to AI.

Avoid unnecessary duplication.

---

# 49. Complete Daily Experience

Example:

### Home

```text
Good evening 👋

Wednesday, September 24

TODAY

2 / 3 completed

✓ Running
✓ Gym
○ Six Pack

[ CONTINUE ]
```

### Start

```text
Six Pack

Exercise 1 / 5

Crunches
3 × 15

[ Start ]
```

### Completion

```text
TODAY COMPLETE 🎉

3 / 3 activities

Running     30 min
Gym         54 min
Six Pack    12 min

Total
1h 36m

[ View Summary ]
[ Done ]
```

### Progress

```text
THIS WEEK

Gym       4
Running   2
Abs       3

Training
4h 18m

Weight
74.6 kg
```

### AI

```text
[ Analyze my week ]
```

This creates the complete loop:

> **Plan → Execute → Record → Analyze → Improve**

---

# 50. Final Product Vision

The application should feel like a **personal training operating system**.

It should not feel like:

- a simple gym checklist,
- a basic calendar,
- a photo gallery,
- a running timer,
- or a chatbot.

It should unify all of these into one coherent experience.

The central experience is:

> **When I open the app, I immediately understand my day. When I press Start, the app guides me through it. When I'm done, the app records it. Later, Progress shows me what changed, and AI helps me understand what to do next.**

The implementation agent should prioritize this experience above adding unnecessary screens or features.
