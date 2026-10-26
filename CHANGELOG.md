# Changelog

## 1.4.0 — 2026-10-25

### Your cycle, your way (Plan → Edit cycle)
- Day groups: each training day pairs a run (first) with a gym workout. Rename a day, pick any
  run or gym workout for it, reorder the days, add or remove one. Rest follows the last day.
- Saved changes redraw the plan ahead and keep you on the same day group today.
- The cycle starts with Day 1 on the day you set the app up (no longer tied to Sunday).

### Setup file (Settings → Backup)
- Export one editable JSON with profile, body + goals, equipment, custom exercises, workouts
  (exercises, sets, reps, weights, rest, run intervals in mph or km/h) and the cycle days.
- Import it back after editing: validated first (the wrong field is named), a safety copy is
  made, history and statistics are never changed. A new current weight is logged as a weigh-in.

## 1.3.0 — 2026-10-15

### Fixes and additions (2026-10-16)
- Plan empty after onboarding: a missing plan choice now means the VYRO plan, and an empty
  plan is rebuilt on the next start (a stale "custom" choice with no plan no longer blocks it).
- Starting weights updated from docs/plan/pro_plan.md; a program update keeps your place in
  the cycle.
- Progress → Overview "Forecast": training calories (7 days), adherence and missed days
  (28 days), planned kcal/week, and an estimated date to reach your weight goal with a chart
  (weekly weigh-ins, dashed projection, target line).

### Plan: a cycle that waits for you
- Push → Pull → Legs → Rest, repeating. A training day only moves the cycle on when its gym
  workout is completed; a missed day comes back the next day (missed Monday's Pull → Tuesday
  is Pull). Rest comes after 3 completed days.
- Starts on Sunday with Push; the week view starts on Sunday.
- Each day: the run first (your warm-up), the gym right after. Run times per weekday stay as
  before (16:30, or 14:30 on Wed/Fri/Sun).

### New workouts (docs/plan/pro_plan.md)
- Push 21 sets: incline chest press, lying chest press, decline chest press, pec deck,
  dumbbell shoulder press, lateral raise, pushdown, overhead cable extension.
- Pull 16 sets: lat pulldown, seated cable row, cable one-arm twisting row, lever seated row,
  lever preacher curl, dumbbell hammer curl.
- Legs 15 sets: hack squat, Smith deadlift, leg press, leg curl, calf raise, back extension.
- New exercises with demo videos: Decline Chest Press, Cable One Arm Twisting Seated Row,
  Lever Seated Row, Smith Deadlift. Hammer Curl now shows the dumbbell video.
- Lifts without a starting weight start from what you lifted before.

### Fixes
- Web preview: diagnostics and backups download through the browser instead of crashing.

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
