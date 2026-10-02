# Changelog

## 1.2.0 — 2026-10-02

### New training program (docs/after_1_week_using/new_program.md)
- Push / Pull / Legs replaces Chest + Lats / Shoulders + Legs / Biceps + Triceps.
- Fixed week: Mon Push · Tue Pull · Wed Legs · Thu Rest · Fri Push · Sat Pull · Sun Legs.
- Each day: the run first (your warm-up), then the gym 5 minutes after it ends.
- New runs: Real Speed (24 min, 6 × 1 min @ 11 mph), Speed Endurance (22 min, 3 × 4 min @
  8.5–9 mph), Easy Controlled Run (16 min @ 6 mph).
- Starting weights, sets and rep ranges from the program; double progression in the notes.
  After the first session each lift starts from what you actually lifted.
- New exercises with demo videos: Incline Press Machine, Close-Grip Front Pulldown, Biceps Curl
  Machine. Six-pack sessions removed from the plan.

### Exercise changes (after the first sessions)
- Push: Lever Lying Chest Press (replaces Chest Press Machine), Incline Bench Press (barbell,
  replaces Incline Press Machine), new Decline Bench Press 2 × 8–12 @ 20 kg, new Cable Leaning
  Lateral Raise 2 × 12–15 @ 15 kg. Push is now 23 working sets (~75 min).
- Pull: Lever Preacher Curl replaces Biceps Curl Machine.
- Lateral Raise now shows the dumbbell video (it showed the cable version).
- Routine workouts are re-synced from the program when it changes, so swaps reach existing installs.

### Fixes
- Exercise videos that failed to load now retry on their own instead of staying blank.

## 1.1.0 — 2026-09-27

### Onboarding
- New welcome screen: glowing summit art, "Train smarter. Live stronger.", feature row, Get Started.
- Goals: pick several (e.g. lose weight + build muscle); each becomes its own goal.
- Weekly plan: the VYRO week (six-pack, run, gym at set times, Thursday rest) is the default;
  "Custom days" keeps the old day picker. Choosing custom or no plan is never overwritten.

### Security
- PIN setup and unlock take well under a second (was up to minutes on mid-range phones), with a
  visible "Securing your PIN… / Checking…" spinner. Existing PINs are upgraded on first unlock.

### Home
- Taller mountain hero with more room above the name, a bigger name on a soft translucent panel.
- Today card, Quick Actions and This Week restyled after docs/template/ui.png (wide covers,
  duration + intensity, "Next" / "Pending" pills, date pill, subtitles and arrows).

### Training
- Gym lifts default to 3 × 15. Each set pre-fills last session's weight and shows the change
  (e.g. "+2 kg · +20 % vs last time").
- Sample workouts that aren't in the routine (Upper Body, Leg Day, Push, Pull…) are removed.

### Fixes
- Camera permission was missing from 1.0.0 (Take photo couldn't ask); it's back.
- Text fields in bottom sheets (search, names, notes) stay above the keyboard.

### Workouts
- Exercise demo videos loop during sets and rest, and resume after the screen is locked.

## 1.0.0 — 2026-09-27

First release. Everything stays on the device: no account, no tracking, works offline.

### Plan
- Week view (Monday–Sunday) and month view with history; every day scored Excellent / Good /
  Bad from the work actually logged, plus a monthly status.
- Default routine filled every week (six-pack, running, gym at set times); any day can be
  moved, re-timed, skipped or changed.
- Recurring activities, conflict warnings, quick reschedule.

### Train
- Exercise library (75+ exercises) with equipment, alternatives, images, GIFs and video links.
- Gym, home and abs workout builder; running interval builder with presets (mph or km/h).
- Equipment availability, custom icons and pictures; workout covers.

### Workout
- Gym/abs execution: sets, weight/reps, rest timer, swaps, notes, exercise pictures.
- Treadmill runner: glowing interval ring, speed/incline adjust, ±30 s, skip, repeat, cues.
- Survives app kills: resumes exactly where you were.

### Progress
- Weight and body measurements with trends; weekly stats and analytics; history with
  edits.
- Private progress photos (camera or library) in groups, compare before/after.

### Settings & privacy
- Profile picture, units, languages (English, French), themes and accent colours, custom
  activity colours and icons.
- App lock (PIN + biometrics), screenshot blocking on photo screens.
- Local reminders; backup and restore (JSON or ZIP with photos).
