# Image assets register

Every photographic or illustrative image the app needs, inspired by `docs/template/template.png`. Brand rasters (icon, splash, logo layers) are generated separately into `assets/brand/` by `pnpm brand:assets`.

Status: ⏳ needed · 🧪 placeholder in use · ✅ final

## Where the template uses images

| Template area                                                      | What is shown                                      | How VYRO handles it                                                                     |
| ------------------------------------------------------------------ | -------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Header banner, behind the logo                                     | Dark rim-lit mountain range                        | **Mountain hero layers** (below), tinted with the selected accent                       |
| Home header (behind the greeting)                                  | Mountain silhouette on the right, glowing ridge    | Same mountain layers, header band fading into the background                            |
| Theme variations → dark / light phones (Welcome)                   | Dark lime-rim mountains / snowy light mountains    | Dark + light mountain layers                                                            |
| Colour customization cards (lime, purple, blue, orange, red, teal) | The same mountains, rim light in each accent       | One set of layers; the app colours the rim with the accent (no image per colour)        |
| Train list, Start "Next Up", UI component row                      | Square workout thumbnails (athlete photos)         | **Workout covers**: `assets/images/workouts/` or uploaded per workout in the app        |
| Start → hero card "Upper Body"                                     | Wide gym-interior photo (dumbbell rack)            | Same workout cover, wide crop                                                           |
| Home header avatar                                                 | User photo                                         | Not a bundled asset (initials avatar; optional user photo later)                        |
| Exercises (library, detail, execution)                             | Not in the template; the app shows a dumbbell icon | `assets/images/exercises/` + images, GIFs and video links added in the app per exercise |

## How the accent-tinted mountains work

Each theme uses **two transparent PNG layers**:

1. **Base** (`mountain-<theme>.png`): the mountains only, with a **fully transparent sky and surroundings**. The rim light is neutral (white/grey), not lime.
2. **Rim mask** (`mountain-<theme>-rim.png`, optional but recommended): **only the lit ridge edges**, pure white on transparent, the same size and alignment as the base.

The app draws a dark (or light) gradient, then an accent-coloured glow behind the peaks, then the base layer, then the rim mask **tinted with the current accent**. Lime, purple, blue, orange, red and teal all come from the same two files. Without the rim mask, the glow alone carries the accent.

Drop the files at the paths below with the exact names. The owner's mountains are in place: originals are kept in `assets/images/hero/_source/` (not bundled), and the bundled copies are resized to 1600 px — bases as WebP (≈160–200 KB), rim masks as white-on-alpha PNG (≈50–60 KB).

## Image register

| Asset                     | File (exact path)                           | Used in                                  | Size / format                                                      | Prompt                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Licence / source                                             | Status   |
| ------------------------- | ------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | -------- |
| Dark mountain — base      | `assets/images/hero/mountain-dark.webp`     | Welcome (dark), Home header              | 2400×1350 PNG-24 with alpha, ≤ 250 KB (quantize with pngquant)     | Wide cinematic mountain range at night, sharp jagged alpine peaks and ridges filling the lower 60% of the frame, dramatic rim lighting along the ridgelines in **neutral white**, deep near-black slopes (#01070C to #0B1A12), subtle mist in the valleys, photoreal, high detail, **completely transparent background: no sky, no stars, no moon, nothing above or around the mountains**, clean alpha edges, no text, no logos, no people, centred composition that can be cropped left or right, PNG with transparency | Owner-generated (originals in `assets/images/hero/_source/`) | ✅ final |
| Dark mountain — rim mask  | `assets/images/hero/mountain-dark-rim.png`  | Same (tinted with the accent)            | Same size and alignment as the base, PNG with alpha, ≤ 60 KB       | Using the exact same mountain range and framing as the dark mountain base image, render **only the thin glowing rim light along the ridgelines and peak edges** as pure white (#FFFFFF) strokes with a soft falloff, everything else fully transparent, no mountain body, no sky, no texture, perfect pixel alignment with the base layer, PNG with transparency (tip: derive it from the base in an editor by selecting the brightest ridge highlights)                                                                  | Owner-generated (originals in `assets/images/hero/_source/`) | ✅ final |
| Light mountain — base     | `assets/images/hero/mountain-light.webp`    | Welcome (light theme), light Home header | 2400×1350 PNG-24 with alpha, ≤ 250 KB                              | Wide cinematic snowy mountain range in soft daylight, sharp alpine peaks with fresh snow and cool blue-grey shadows, crisp ridgelines with a gentle **neutral white** highlight, light haze in the valleys, photoreal, bright and clean, mountains filling the lower 60% of the frame, **completely transparent background: no sky, no clouds, no sun, nothing above or around the mountains**, clean alpha edges, no text, no logos, no people, PNG with transparency                                                    | Owner-generated (originals in `assets/images/hero/_source/`) | ✅ final |
| Light mountain — rim mask | `assets/images/hero/mountain-light-rim.png` | Same (tinted with the accent, subtler)   | Same size and alignment as the light base, PNG with alpha, ≤ 60 KB | Using the exact same snowy mountain range and framing as the light mountain base image, render **only the sunlit ridge edges** as pure white (#FFFFFF) thin strokes with a soft falloff, everything else fully transparent, perfect pixel alignment with the base layer, PNG with transparency                                                                                                                                                                                                                            | Owner-generated (originals in `assets/images/hero/_source/`) | ✅ final |

## Content images: drop-in folders

Save a file with the exact name below and it shows up on the next reload, with no code change. The app reads these folders (`src/constants/bundledImages.ts`, Metro `require.context`). `.webp` is preferred; `.png` and `.jpg` also work. If a new file doesn't appear, restart `npx expo start`.

| Folder                     | File name              | Size / format                                                                                 | Shown in                                        | Priority                                                                       |
| -------------------------- | ---------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------ |
| `assets/images/workouts/`  | `<cover_key>.webp`     | 1200×800 (3:2), WebP q80, ≤ 200 KB, subject in the centre third (squares are cropped from it) | Train list, workout detail, Start hero, Next Up | photo picked in the app → this file → gradient + icon                          |
| `assets/images/exercises/` | `<exercise slug>.webp` | 1200×900 (4:3), WebP q80, ≤ 180 KB, subject centred                                           | Exercise library rows, exercise detail header   | image added in the app → this file → category icon                             |
| `assets/images/equipment/` | `<equipment slug>.png` | 1024×1024, **transparent** PNG or WebP with alpha, ≤ 150 KB                                   | Equipment list, exercise equipment rows         | picture picked in the app → icon picked in the app → this file → category icon |

### Style: works with every accent colour

The app never tints photos, so the images stay **neutral**: charcoal-navy shadows, cool-white rim light, near-monochrome grade. The selected accent (lime, purple, blue…) comes from the UI around them, so a neutral image looks right with every accent. The subject goes in each row of the tables below. **Always append the style block below** to the subject.

**Photo style (workouts + exercises), append to every prompt:**

> cinematic premium fitness photography, low-key lighting, deep charcoal-navy background (#05080C to #111820), neutral cool-white rim light with soft silver highlights, desaturated near-monochrome colour grade (no colour casts, no green, no neon, no coloured gels), subtle atmospheric haze, fine film grain, shallow depth of field, athlete's face hidden (turned away, shadowed or cropped out), no text, no logos, no brand names, no watermark

**Equipment style, append to every prompt:**

> premium product render of a single piece of gym equipment, three-quarter view, matte black and graphite metal with brushed-steel details, soft neutral studio key light and a thin cool-white rim light, subtle contact shadow, object centred with 8% padding, isolated on a fully transparent background (PNG alpha), no floor, no room, no people, no text, no logos, no brand names

Tips: generate at 3:2 or 4:3 and keep one seed/style reference for the whole set so the lighting matches; use the same athlete build and outfit (plain black training clothes, no logos) across all images.

### Workout covers: the 12 workouts in your routine

| File                                                   | Name                     | Prompt                                                                                                                                                                                 |
| ------------------------------------------------------ | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `assets/images/workouts/gym_chest_lats.webp` ✅        | Day 1 · Chest + Lats     | Athlete lying on a flat bench pressing a loaded barbell, seen from the side at bench height, chalk dust in the rim light, cable station blurred behind, 3:2 landscape, + photo style   |
| `assets/images/workouts/gym_shoulders_legs.webp` ✅    | Day 2 · Shoulders + Legs | Athlete in a squat rack at the bottom of a barbell back squat, seen from a low three-quarter angle behind, plates catching the rim light, 3:2 landscape, + photo style                 |
| `assets/images/workouts/gym_arms.webp` ✅              | Day 3 · Biceps + Triceps | Close crop of a muscular arm curling an EZ bar, veins and triceps outline lit by the rim light, torso and face out of frame, 3:2 landscape, + photo style                              |
| `assets/images/workouts/abs_a.webp` ✅                 | Abs A · Crunch           | Athlete doing a crunch on a mat, seen from the side at floor level, abdominal lines lit by the rim light, 3:2 landscape, + photo style                                                 |
| `assets/images/workouts/abs_b.webp` ✅                 | Abs B · Stability        | Athlete holding a side plank on a mat, body forming a straight diagonal line, seen from the front at floor level, silhouette against haze, 3:2 landscape, + photo style                |
| `assets/images/workouts/abs_c.webp` ✅                 | Abs C · Power            | Athlete extended in an ab-wheel rollout, seen from the side at floor level, long straight body line lit along the back and arms, 3:2 landscape, + photo style                          |
| `assets/images/workouts/run_speed_intervals.webp` ✅   | Speed Intervals          | Runner sprinting on a treadmill, motion blur on the legs and belt, seen from a low side angle, treadmill console glow kept neutral white, 3:2 landscape, + photo style                 |
| `assets/images/workouts/run_incline_endurance.webp` ✅ | Incline Endurance        | Runner at a steady pace on a treadmill raised to a visible incline, seen from behind at a slight angle, calm focused mood, 3:2 landscape, + photo style                                |
| `assets/images/workouts/run_incline_power.webp` ✅     | Incline Power            | Runner driving up a steep treadmill incline, strong forward lean and powerful leg drive, seen from the side, sweat catching the rim light, 3:2 landscape, + photo style                |
| `assets/images/workouts/run_speed_endurance.webp` ✅   | Speed Endurance          | Runner holding a fast stride on a treadmill, arms mid-swing, long exposure streaks behind, seen from a three-quarter front angle with the face in shadow, 3:2 landscape, + photo style |
| `assets/images/workouts/run_easy_strides.webp` ✅      | Easy Run + Strides       | Relaxed runner jogging lightly on a treadmill, soft haze, calmer and brighter mood than the other runs, 3:2 landscape, + photo style                                                   |
| `assets/images/workouts/run_long_aerobic.webp` ✅      | Long Aerobic Run         | Wide shot of a lone runner on a treadmill in front of a large dark window at dusk, city lights heavily blurred and desaturated, long-distance mood, 3:2 landscape, + photo style       |

### Exercises in your routine

| File                                                   | Name                           | Prompt                                                                                                                                |
| ------------------------------------------------------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `assets/images/exercises/bench_press.webp`             | Bench Press                    | Athlete lowering a barbell to the chest on a flat bench, side view, 4:3, + photo style                                                |
| `assets/images/exercises/incline_dumbbell_press.webp`  | Incline Dumbbell Press         | Athlete pressing two dumbbells on a 30° incline bench, three-quarter view, 4:3, + photo style                                         |
| `assets/images/exercises/incline_dumbbell_fly.webp`    | Incline Dumbbell Fly           | Athlete on an incline bench with dumbbells opened wide in a fly, arms slightly bent, front three-quarter view, 4:3, + photo style     |
| `assets/images/exercises/machine_chest_dip.webp`       | Machine Chest Dip              | Athlete seated in a chest dip machine pressing the handles down, torso leaning slightly forward, 4:3, + photo style                   |
| `assets/images/exercises/lat_pulldown.webp`            | Lat Pulldown                   | Athlete pulling a wide lat bar down to the upper chest, seen from behind, back muscles lit, 4:3, + photo style                        |
| `assets/images/exercises/seated_row.webp`              | Seated Cable Row               | Athlete pulling a cable handle to the stomach on a seated row, side view, shoulder blades squeezed, 4:3, + photo style                |
| `assets/images/exercises/chest_supported_row.webp`     | Chest-Supported Row            | Athlete with the chest on the pad of a row machine pulling the handles back, side view, 4:3, + photo style                            |
| `assets/images/exercises/dumbbell_shoulder_press.webp` | Seated Dumbbell Shoulder Press | Seated athlete pressing two dumbbells overhead from an upright bench, seen from behind, 4:3, + photo style                            |
| `assets/images/exercises/lateral_raise.webp`           | Dumbbell Lateral Raise         | Standing athlete raising two dumbbells out to the sides at shoulder height, front view with the face in shadow, 4:3, + photo style    |
| `assets/images/exercises/cable_lateral_raise.webp`     | Cable Lateral Raise            | Athlete raising a low cable handle out to the side with one arm, side-on to the cable stack, 4:3, + photo style                       |
| `assets/images/exercises/reverse_pec_deck.webp`        | Reverse Pec Deck               | Athlete facing a pec deck machine opening the arms backwards, seen from behind, rear shoulders lit, 4:3, + photo style                |
| `assets/images/exercises/squat.webp`                   | Barbell Squat                  | Athlete at the bottom of a barbell back squat in a rack, low three-quarter rear view, 4:3, + photo style                              |
| `assets/images/exercises/leg_extension.webp`           | Leg Extension                  | Athlete seated in a leg extension machine with legs straight, quads lit, side view, 4:3, + photo style                                |
| `assets/images/exercises/leg_curl.webp`                | Leg Curl                       | Athlete on a lying leg curl machine curling the pad towards the glutes, side view, 4:3, + photo style                                 |
| `assets/images/exercises/machine_calf_raise.webp`      | Machine Calf Raise             | Close crop of calves rising on a calf raise machine platform, heels lifted, 4:3, + photo style                                        |
| `assets/images/exercises/ez_bar_curl.webp`             | EZ-Bar Curl                    | Standing athlete curling an EZ bar to the chest, elbows at the sides, front three-quarter view, face out of frame, 4:3, + photo style |
| `assets/images/exercises/preacher_curl.webp`           | Preacher Curl                  | Athlete curling an EZ bar on a preacher bench, arms on the pad, side view, 4:3, + photo style                                         |
| `assets/images/exercises/hammer_curl.webp`             | Hammer Curl                    | Athlete curling two dumbbells with a neutral grip, close crop of the arms and forearms, 4:3, + photo style                            |
| `assets/images/exercises/close_grip_bench_press.webp`  | Close-Grip Bench Press         | Athlete pressing a barbell with a narrow grip on a flat bench, elbows tucked, side view, 4:3, + photo style                           |
| `assets/images/exercises/tricep_extension.webp`        | Overhead Tricep Extension      | Athlete holding one dumbbell overhead with both hands, elbows bent behind the head, seen from behind, 4:3, + photo style              |
| `assets/images/exercises/tricep_pushdown.webp`         | Tricep Pushdown                | Athlete pushing a cable bar down at a high pulley, arms straight, triceps lit, side view, 4:3, + photo style                          |
| `assets/images/exercises/crunch.webp`                  | Crunch                         | Athlete on a mat with shoulders lifted in a crunch, side view at floor level, 4:3, + photo style                                      |
| `assets/images/exercises/hanging_leg_raise.webp`       | Hanging Leg Raise              | Athlete hanging from a pull-up bar with legs raised to 90°, side silhouette, 4:3, + photo style                                       |
| `assets/images/exercises/plank.webp`                   | Plank                          | Athlete holding a forearm plank on a mat, straight line from head to heels, side view at floor level, 4:3, + photo style              |
| `assets/images/exercises/dead_bug.webp`                | Dead Bug                       | Athlete on the back with one arm and the opposite leg extended, top-down view, 4:3, + photo style                                     |
| `assets/images/exercises/side_plank.webp`              | Side Plank                     | Athlete in a side plank on one forearm, hips lifted, front view at floor level, 4:3, + photo style                                    |
| `assets/images/exercises/russian_twist.webp`           | Russian Twist                  | Athlete seated on a mat leaning back, feet raised, twisting the torso to one side, three-quarter view, 4:3, + photo style             |
| `assets/images/exercises/ab_wheel_rollout.webp`        | Ab-Wheel Rollout               | Athlete kneeling and rolling an ab wheel forward into a long extension, side view, 4:3, + photo style                                 |
| `assets/images/exercises/bicycle_crunch.webp`          | Bicycle Crunch                 | Athlete on the back bringing elbow to opposite knee, other leg extended, side view, 4:3, + photo style                                |
| `assets/images/exercises/v_up.webp`                    | V-Up                           | Athlete folded into a V shape on a mat, hands reaching for the feet, side silhouette, 4:3, + photo style                              |

Any other exercise works the same way: `assets/images/exercises/<slug>.webp`. The slugs are in `src/db/seed/data/content.ts`.

### Equipment used by your routine

| File                                                      | Name                        | Prompt                                                                                  |
| --------------------------------------------------------- | --------------------------- | --------------------------------------------------------------------------------------- |
| `assets/images/equipment/barbell.png`                     | Barbell                     | An Olympic barbell with knurled grips, slightly angled, + equipment style               |
| `assets/images/equipment/weight_plates.png`               | Weight plates               | A small stack of black bumper plates with steel centre rings, + equipment style         |
| `assets/images/equipment/dumbbells.png`                   | Dumbbells                   | A pair of hexagonal black dumbbells with steel handles, + equipment style               |
| `assets/images/equipment/ez_bar.png`                      | EZ bar                      | An EZ curl bar with angled grips, + equipment style                                     |
| `assets/images/equipment/flat_bench.png`                  | Flat bench                  | A padded flat weight bench, + equipment style                                           |
| `assets/images/equipment/adjustable_bench.png`            | Adjustable bench            | An adjustable bench with the back set to an incline, + equipment style                  |
| `assets/images/equipment/preacher_bench.png`              | Preacher bench              | A preacher curl bench with an angled arm pad, + equipment style                         |
| `assets/images/equipment/squat_rack.png`                  | Squat rack                  | A squat rack / power rack with a barbell resting on the hooks, + equipment style        |
| `assets/images/equipment/chest_dip_machine.png`           | Chest dip machine           | A seated chest dip machine with a weight stack, + equipment style                       |
| `assets/images/equipment/lat_pulldown_machine.png`        | Lat pulldown machine        | A lat pulldown station with a wide bar and knee pads, + equipment style                 |
| `assets/images/equipment/seated_row_machine.png`          | Seated row machine          | A seated cable row station with a V-handle and foot plate, + equipment style            |
| `assets/images/equipment/chest_supported_row_machine.png` | Chest-supported row machine | A chest-supported row machine with a padded chest rest and handles, + equipment style   |
| `assets/images/equipment/cable_machine.png`               | Cable machine               | A dual adjustable cable crossover station, + equipment style                            |
| `assets/images/equipment/pec_deck_machine.png`            | Pec deck                    | A pec deck / reverse fly machine, + equipment style                                     |
| `assets/images/equipment/leg_extension_machine.png`       | Leg extension machine       | A leg extension machine with a padded seat and shin pad, + equipment style              |
| `assets/images/equipment/leg_curl_machine.png`            | Leg curl machine            | A lying leg curl machine, + equipment style                                             |
| `assets/images/equipment/calf_raise_machine.png`          | Calf raise machine          | A standing calf raise machine with shoulder pads and a foot platform, + equipment style |
| `assets/images/equipment/pull_up_bar.png`                 | Pull-up bar                 | A wall-mounted pull-up bar, + equipment style                                           |
| `assets/images/equipment/ab_wheel.png`                    | Ab wheel                    | An ab roller wheel with two foam handles, + equipment style                             |
| `assets/images/equipment/exercise_mat.png`                | Exercise mat                | A rolled-out black exercise mat, half rolled, + equipment style                         |
| `assets/images/equipment/treadmill.png`                   | Treadmill                   | A modern treadmill with a slim console, side three-quarter view, + equipment style      |

### Workout screen backgrounds

Shown very faintly (24% in dark, 12% in light) behind the timer screens, faded into the background at the top and bottom. Portrait, calm, with **no strong subject in the centre** (the timer ring sits there).

| File                                      | Screen             | Prompt                                                                                                                                                                                                                                                                                                                                     |
| ----------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `assets/images/execution/running.webp` ✅ | Running timer      | Portrait 9:16 cinematic background, empty modern treadmill zone at night seen from a low angle, rows of treadmills fading into darkness, large dark windows with heavily blurred distant city lights, long soft light streaks suggesting speed along the lower third, lots of empty dark space in the upper and middle area, + photo style |
| `assets/images/execution/gym.webp` ✅     | Gym workout (sets) | Portrait 9:16 cinematic background, empty premium gym at night, dumbbell racks and a barbell on the floor in soft focus along the bottom third, overhead light beams through light haze, lots of empty dark space in the upper and middle area, + photo style                                                                              |
| `assets/images/execution/abs.webp` ✅     | Six-pack workout   | Portrait 9:16 cinematic background, quiet dark training studio floor with a rolled-out mat and an ab wheel in soft focus at the bottom, a single soft overhead light pool, faint haze, lots of empty dark space in the upper and middle area, + photo style                                                                                |

Size: 1080×1920, WebP q75, ≤ 200 KB.

## Exercise demo videos (personal import)

`assets/videos/exercises/<slug>.mp4` (short silent loops) play on the exercise screen and during gym/abs workouts; `assets/images/exercises/<slug>.png` are the thumbnails. 104 of them were imported for personal use with `node scripts/lyfta/scrape.mjs` (targets in `scripts/lyfta/targets.mjs`, data in `scripts/lyfta/data/exercises.json`). They are Gymvisual media licensed to Lyfta: git-ignored, never publish or ship them. Missing: `foam_roll`, `cable_woodchopper` (no page on Lyfta) — they keep their icons.

## Exercise media (added in the app)

Every exercise, seeded or custom, has a **Media** section on its detail screen:

- **Images and GIFs**: picked from the library and copied into private storage. GIFs animate.
- **Video links**: YouTube (shows the video thumbnail and opens in YouTube) or any other `https://` link.
- The first image becomes the exercise thumbnail and replaces a bundled image.
- Media is included in backups: rows always, files in the "Data + photos" ZIP.

## Rules

- Until a real image exists, `CoverArt` renders a themed gradient with a category icon, and the equipment/exercise rows show icons. Layouts never depend on an image.
- Keep bundled images within the sizes above; convert large PNG photos to WebP (e.g. `npx sharp-cli -i in.png -o out.webp -f webp -q 80`).
- Record the licence and source of every image before shipping it publicly.
- Never bundle images of identifiable people without a licence. That is why the prompts hide faces.
