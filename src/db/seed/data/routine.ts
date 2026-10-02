/**
 * The owner's training routine (docs/after_1_week_using/new_program.md, 1.2.0): Push / Pull /
 * Legs, each with its treadmill session first (run = warm-up), then the gym. Fixed week:
 * Mon Push · Tue Pull · Wed Legs · Thu Rest · Fri Push · Sat Pull · Sun Legs. The schedule is
 * created by `applyRoutine` (src/db/routine.ts).
 */
import {
  type SeedEquipment,
  type SeedExercise,
  type SeedInterval,
  type SeedTemplate,
} from '../types';

export const routineEquipment: SeedEquipment[] = [
  { slug: 'incline_press_machine', name: 'Incline press machine', category: 'machines' },
  { slug: 'biceps_curl_machine', name: 'Biceps curl machine', category: 'machines' },
  { slug: 'squat_rack', name: 'Squat rack', category: 'free_weights' },
  { slug: 'preacher_bench', name: 'Preacher bench', category: 'accessories' },
  { slug: 'calf_raise_machine', name: 'Calf raise machine', category: 'machines' },
  { slug: 'chest_dip_machine', name: 'Chest dip machine', category: 'machines' },
  {
    slug: 'chest_supported_row_machine',
    name: 'Chest-supported row machine',
    category: 'machines',
  },
];

const lift = (
  x: Pick<SeedExercise, 'slug' | 'name' | 'category' | 'primaryMuscle' | 'equipment'> &
    Partial<SeedExercise>,
): SeedExercise => ({
  secondaryMuscles: [],
  tracking: 'weight_reps',
  defaultSets: 3,
  defaultReps: 10,
  defaultDurationSeconds: null,
  defaultRestSeconds: 90,
  difficulty: 'intermediate',
  instructions: [],
  ...x,
});

export const routineExercises: SeedExercise[] = [
  lift({
    slug: 'lever_lying_chest_press',
    name: 'Lever Lying Chest Press',
    category: 'chest',
    primaryMuscle: 'chest',
    secondaryMuscles: ['front_delts', 'triceps'],
    equipment: ['chest_press_machine'],
    defaultReps: 8,
    instructions: [
      'Lie on the machine bench, handles in line with the middle of your chest.',
      'Press up without locking the elbows.',
      'Lower slowly until the handles are just above your chest.',
    ],
  }),
  lift({
    slug: 'incline_bench_press',
    name: 'Incline Bench Press',
    category: 'chest',
    primaryMuscle: 'upper_chest',
    secondaryMuscles: ['front_delts', 'triceps'],
    equipment: ['barbell', 'adjustable_bench'],
    defaultReps: 8,
    instructions: [
      'Bench at 30–45°, grip a little wider than your shoulders.',
      'Lower the bar to your upper chest with control.',
      'Press up and slightly back over your shoulders.',
    ],
  }),
  lift({
    slug: 'lever_preacher_curl',
    name: 'Lever Preacher Curl',
    category: 'arms',
    primaryMuscle: 'biceps',
    secondaryMuscles: ['forearms'],
    equipment: ['biceps_curl_machine'],
    defaultReps: 10,
    defaultRestSeconds: 75,
    difficulty: 'beginner',
    instructions: [
      'Upper arms flat on the pad, elbows in line with the machine axis.',
      'Curl up and squeeze for a second.',
      'Lower all the way with control: no bouncing at the bottom.',
    ],
  }),
  lift({
    slug: 'cable_leaning_lateral_raise',
    name: 'Cable Leaning Lateral Raise',
    category: 'shoulders',
    primaryMuscle: 'side_delts',
    equipment: ['cable_machine'],
    defaultReps: 12,
    defaultRestSeconds: 75,
    instructions: [
      'Hold the low pulley with the far hand, the other hand on the post, leaning away.',
      'Raise the arm out to the side up to shoulder height.',
      'Lower slowly; do all reps, then switch sides.',
    ],
  }),
  lift({
    slug: 'incline_chest_press_machine',
    name: 'Incline Press Machine',
    category: 'chest',
    primaryMuscle: 'upper_chest',
    secondaryMuscles: ['front_delts', 'triceps'],
    equipment: ['incline_press_machine'],
    defaultReps: 8,
    instructions: [
      'Set the seat so the handles start level with your upper chest.',
      'Press up and forward without locking the elbows.',
      'Lower slowly until you feel a stretch across the chest.',
    ],
  }),
  lift({
    slug: 'close_grip_pulldown',
    name: 'Close-Grip Front Pulldown',
    category: 'back',
    primaryMuscle: 'lats',
    secondaryMuscles: ['biceps', 'mid_back'],
    equipment: ['lat_pulldown_machine'],
    defaultReps: 8,
    instructions: [
      'Hold the close-grip handle, chest up, thighs under the pads.',
      'Pull the handle to your upper chest, elbows driving down.',
      'Let the weight up slowly to a full stretch.',
    ],
  }),
  lift({
    slug: 'machine_bicep_curl',
    name: 'Biceps Curl Machine',
    category: 'arms',
    primaryMuscle: 'biceps',
    secondaryMuscles: ['forearms'],
    equipment: ['biceps_curl_machine'],
    defaultReps: 10,
    defaultRestSeconds: 75,
    difficulty: 'beginner',
    instructions: [
      'Rest your upper arms on the pad, elbows in line with the machine axis.',
      'Curl the handles up and squeeze for a second.',
      'Lower all the way down with control.',
    ],
  }),
  lift({
    slug: 'incline_dumbbell_fly',
    name: 'Incline Dumbbell Fly',
    category: 'chest',
    primaryMuscle: 'upper_chest',
    secondaryMuscles: ['front_delts'],
    equipment: ['dumbbells', 'adjustable_bench'],
    defaultReps: 12,
    defaultRestSeconds: 75,
    instructions: [
      'Set the bench to about 30°, dumbbells above the chest, palms facing.',
      'Open the arms in a wide arc with a soft elbow bend until you feel a stretch.',
      'Squeeze the chest to bring the dumbbells back together.',
    ],
  }),
  lift({
    slug: 'machine_chest_dip',
    name: 'Machine Chest Dip',
    category: 'chest',
    primaryMuscle: 'lower_chest',
    secondaryMuscles: ['triceps', 'front_delts'],
    equipment: ['chest_dip_machine'],
    defaultReps: 12,
    instructions: [
      'Sit tall, grip the handles beside the hips.',
      'Lean slightly forward and press down until the arms are almost straight.',
      'Return slowly until you feel a light stretch in the chest.',
    ],
  }),
  lift({
    slug: 'chest_supported_row',
    name: 'Chest-Supported Row',
    category: 'back',
    primaryMuscle: 'mid_back',
    secondaryMuscles: ['lats', 'rear_delts', 'biceps'],
    equipment: ['chest_supported_row_machine'],
    defaultReps: 12,
    instructions: [
      'Chest against the pad, arms long.',
      'Pull the elbows back and squeeze the shoulder blades together.',
      'Lower with control without lifting the chest off the pad.',
    ],
  }),
  lift({
    slug: 'reverse_pec_deck',
    name: 'Reverse Pec Deck',
    category: 'shoulders',
    primaryMuscle: 'rear_delts',
    secondaryMuscles: ['upper_back'],
    equipment: ['pec_deck_machine'],
    defaultReps: 12,
    defaultRestSeconds: 75,
    instructions: [
      'Face the pad, handles at shoulder height.',
      'Open the arms back in a wide arc, leading with the elbows.',
      'Pause, then return slowly.',
    ],
  }),
  lift({
    slug: 'machine_calf_raise',
    name: 'Machine Calf Raise',
    category: 'legs',
    primaryMuscle: 'calves',
    equipment: ['calf_raise_machine'],
    defaultReps: 12,
    defaultRestSeconds: 75,
    difficulty: 'beginner',
    instructions: [
      'Balls of the feet on the platform, heels hanging.',
      'Rise as high as you can and pause.',
      'Lower slowly into a full stretch.',
    ],
  }),
  lift({
    slug: 'ez_bar_curl',
    name: 'EZ-Bar Curl',
    category: 'arms',
    primaryMuscle: 'biceps',
    secondaryMuscles: ['forearms'],
    equipment: ['ez_bar'],
    defaultReps: 8,
    defaultRestSeconds: 120,
    instructions: [
      'Stand tall, elbows at your sides, grip the angled part of the bar.',
      'Curl up without swinging the body.',
      'Lower all the way with control.',
    ],
  }),
  lift({
    slug: 'preacher_curl',
    name: 'Preacher Curl',
    category: 'arms',
    primaryMuscle: 'biceps',
    equipment: ['preacher_bench', 'ez_bar'],
    defaultReps: 10,
    instructions: [
      'Upper arms flat on the pad, armpits against its top.',
      'Curl the bar up and squeeze.',
      'Lower slowly until the arms are almost straight.',
    ],
  }),
  lift({
    slug: 'close_grip_bench_press',
    name: 'Close-Grip Bench Press',
    category: 'arms',
    primaryMuscle: 'triceps',
    secondaryMuscles: ['chest', 'front_delts'],
    equipment: ['barbell', 'flat_bench'],
    defaultReps: 8,
    defaultRestSeconds: 150,
    instructions: [
      'Grip the bar about shoulder-width apart.',
      'Lower to the lower chest, elbows close to the body.',
      'Press up by straightening the arms.',
    ],
  }),
];

/** exercise → alternatives (machines need a dumbbell-or-bodyweight option). */
export const routineAlternatives: Record<string, string[]> = {
  lever_lying_chest_press: ['dumbbell_bench_press', 'push_up'],
  incline_bench_press: ['incline_dumbbell_press', 'push_up'],
  lever_preacher_curl: ['bicep_curl', 'ez_bar_curl'],
  cable_leaning_lateral_raise: ['lateral_raise'],
  incline_chest_press_machine: ['incline_dumbbell_press', 'push_up'],
  close_grip_pulldown: ['lat_pulldown', 'dumbbell_row'],
  machine_bicep_curl: ['bicep_curl', 'ez_bar_curl'],
  incline_dumbbell_fly: ['dumbbell_fly', 'cable_fly'],
  machine_chest_dip: ['dips', 'push_up'],
  chest_supported_row: ['dumbbell_row', 'seated_row'],
  reverse_pec_deck: ['rear_delt_fly', 'face_pull'],
  machine_calf_raise: ['calf_raise'],
  ez_bar_curl: ['bicep_curl', 'cable_curl'],
  preacher_curl: ['bicep_curl', 'cable_curl'],
  close_grip_bench_press: ['skull_crusher', 'tricep_extension'],
};

/** Treadmills here show mph: plans are written in mph, stored in km/h. */
const mph = (v: number) => Math.round(v * 1.609344 * 10000) / 10000;
const seg = (
  kind: SeedInterval['kind'],
  minutes: number,
  speedMph: number,
  inclinePercent: number,
  label: string | null = null,
): SeedInterval => ({
  kind,
  durationSeconds: Math.round(minutes * 60),
  speedKmh: mph(speedMph),
  inclinePercent,
  label,
});
const rounds = (n: number, a: SeedInterval, b: SeedInterval) =>
  Array.from({ length: n }, () => [a, b]).flat();

// Compounds rest 2–3 min, isolation 60–120 s. Target reps = bottom of the range; the note holds
// the range and the progression rule (double progression, 1–2 reps in reserve).
const C = 150;
const I = 90;
const range = (r: string) =>
  `${r} reps · 1–2 reps in reserve · all sets at the top of the range → add weight`;
const each = (r: string) => `${range(r)} · weight per dumbbell`;

export const routineTemplates: SeedTemplate[] = [
  // Day 1 — Push (chest, shoulders, triceps): 23 working sets.
  {
    key: 'gym_push',
    name: 'Push · Chest + Shoulders + Triceps',
    type: 'gym',
    durationMinutes: 75,
    difficulty: 'intermediate',
    coverKey: 'gym_push',
    description:
      'After the Real Speed run. Start at the listed weights; progress by reps, then weight.',
    exercises: [
      {
        exercise: 'lever_lying_chest_press',
        sets: 3,
        targetReps: 6,
        targetWeightKg: 35,
        restSeconds: C,
        notes: range('6–10'),
      },
      {
        exercise: 'incline_bench_press',
        sets: 3,
        targetReps: 8,
        targetWeightKg: 25,
        restSeconds: C,
        notes: `Barbell, total weight · ${range('8–12')}`,
      },
      {
        exercise: 'decline_bench_press',
        sets: 2,
        targetReps: 8,
        targetWeightKg: 20,
        restSeconds: C,
        notes: `Barbell, total weight · ${range('8–12')}`,
      },
      {
        exercise: 'pec_deck',
        sets: 2,
        targetReps: 10,
        targetWeightKg: 30,
        restSeconds: I,
        notes: range('10–15'),
      },
      {
        exercise: 'dumbbell_shoulder_press',
        sets: 3,
        targetReps: 6,
        targetWeightKg: 10,
        restSeconds: C,
        notes: each('6–10'),
      },
      {
        exercise: 'lateral_raise',
        sets: 3,
        targetReps: 10,
        targetWeightKg: 10,
        restSeconds: I,
        notes: each('10–15'),
      },
      {
        exercise: 'cable_leaning_lateral_raise',
        sets: 2,
        targetReps: 12,
        targetWeightKg: 15,
        restSeconds: I,
        notes: `Per side · ${range('12–15')}`,
      },
      {
        exercise: 'tricep_pushdown',
        sets: 3,
        targetReps: 8,
        targetWeightKg: 40,
        restSeconds: I,
        notes: range('8–12'),
      },
      {
        exercise: 'overhead_cable_extension',
        sets: 2,
        targetReps: 10,
        targetWeightKg: 25,
        restSeconds: I,
        notes: range('10–15'),
      },
    ],
  },
  // Day 2 — Pull (back/lats, biceps, upper back): 15 working sets.
  {
    key: 'gym_pull',
    name: 'Pull · Back + Biceps',
    type: 'gym',
    durationMinutes: 55,
    difficulty: 'intermediate',
    coverKey: 'gym_pull',
    description: 'After the Speed Endurance run. Drop upright rows if they bother your shoulders.',
    exercises: [
      {
        exercise: 'lat_pulldown',
        sets: 3,
        targetReps: 6,
        targetWeightKg: 45,
        restSeconds: C,
        notes: `Wide grip · ${range('6–10')}`,
      },
      {
        exercise: 'seated_row',
        sets: 3,
        targetReps: 8,
        targetWeightKg: 40,
        restSeconds: C,
        notes: range('8–12'),
      },
      {
        exercise: 'close_grip_pulldown',
        sets: 2,
        targetReps: 8,
        targetWeightKg: 40,
        restSeconds: C,
        notes: range('8–12'),
      },
      {
        exercise: 'ez_bar_curl',
        sets: 3,
        targetReps: 6,
        targetWeightKg: 20,
        restSeconds: I,
        notes: range('6–10'),
      },
      {
        exercise: 'lever_preacher_curl',
        sets: 2,
        targetReps: 10,
        targetWeightKg: 15,
        restSeconds: I,
        notes: range('10–15'),
      },
      {
        exercise: 'upright_row',
        sets: 2,
        targetReps: 10,
        restSeconds: I,
        notes: `Controlled weight · ${range('10–15')} · skip if the shoulders hurt`,
      },
    ],
  },
  // Day 3 — Legs (quads, hamstrings, calves, posterior chain): 14 working sets.
  {
    key: 'gym_legs',
    name: 'Legs · Quads + Hamstrings + Calves',
    type: 'gym',
    durationMinutes: 55,
    difficulty: 'intermediate',
    coverKey: 'gym_legs',
    description: 'After the easy run. Never trade depth or control for more weight.',
    exercises: [
      {
        exercise: 'hack_squat',
        sets: 3,
        targetReps: 6,
        targetWeightKg: 80,
        restSeconds: 180,
        notes: range('6–10'),
      },
      {
        exercise: 'leg_press',
        sets: 3,
        targetReps: 8,
        targetWeightKg: 100,
        restSeconds: C,
        notes: range('8–12'),
      },
      {
        exercise: 'leg_curl',
        sets: 3,
        targetReps: 10,
        targetWeightKg: 40,
        restSeconds: I,
        notes: `Prone · ${range('10–15')}`,
      },
      {
        exercise: 'machine_calf_raise',
        sets: 3,
        targetReps: 10,
        targetWeightKg: 90,
        restSeconds: I,
        notes: range('10–15'),
      },
      {
        exercise: 'back_extension',
        sets: 2,
        targetReps: 12,
        restSeconds: I,
        notes: `45° bench, bodyweight · ${range('12–15')}`,
      },
    ],
  },

  // Running (mph, before the gym: it doubles as the warm-up).
  {
    key: 'run_real_speed',
    name: 'Real Speed',
    type: 'running',
    durationMinutes: 24,
    difficulty: 'advanced',
    coverKey: 'run_real_speed',
    description:
      '6 × (1 min @ 11 mph + 2 min @ 6 mph). Keep 11 mph until the rounds feel controlled.',
    intervals: [
      seg('warmup', 3, 5.5, 1),
      ...rounds(6, seg('sprint', 1, 11, 1), seg('recovery', 2, 6, 1)),
      seg('cooldown', 3, 5.5, 1),
    ],
  },
  {
    key: 'run_tempo_endurance',
    name: 'Speed Endurance',
    type: 'running',
    durationMinutes: 22,
    difficulty: 'advanced',
    coverKey: 'run_tempo_endurance',
    description: '3 × 4 min @ 8.5–9 mph with 2 min @ 6 mph between: hold a fast pace for longer.',
    intervals: [
      seg('warmup', 3, 5.5, 1),
      seg('run', 4, 8.75, 1, '8.5–9 mph'),
      seg('recovery', 2, 6, 1),
      seg('run', 4, 8.75, 1, '8.5–9 mph'),
      seg('recovery', 2, 6, 1),
      seg('run', 4, 8.75, 1, '8.5–9 mph'),
      seg('cooldown', 3, 5.5, 1),
    ],
  },
  {
    key: 'run_easy_16',
    name: 'Easy Controlled Run',
    type: 'running',
    durationMinutes: 16,
    difficulty: 'beginner',
    coverKey: 'run_easy_16',
    description: 'Intentionally easy: aerobic work and recovery before legs. Not another HIIT.',
    intervals: [seg('warmup', 3, 5.5, 1), seg('run', 10, 6, 1), seg('cooldown', 3, 5.5, 1)],
  },
];

type Day = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/**
 * The same week every week (ISO weekdays, 1 = Monday). Run first (it's the warm-up), gym
 * right after; per-day run times from docs/plan/weak.md.
 */
const WEEK: { day: Day; run?: [key: string, time: string]; gym?: string }[] = [
  { day: 1, run: ['run_real_speed', '16:30'], gym: 'gym_push' },
  { day: 2, run: ['run_tempo_endurance', '16:30'], gym: 'gym_pull' },
  { day: 3, run: ['run_easy_16', '14:30'], gym: 'gym_legs' },
  { day: 4 },
  { day: 5, run: ['run_real_speed', '14:30'], gym: 'gym_push' },
  { day: 6, run: ['run_tempo_endurance', '16:30'], gym: 'gym_pull' },
  { day: 7, run: ['run_easy_16', '14:30'], gym: 'gym_legs' },
];

const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const hhmm = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** Gym start after a run: end + 5 min, rounded up to the next 5 minutes. */
export function afterRun(runKey: string, runTime: string): string {
  const length = routineTemplates.find((t) => t.key === runKey)?.durationMinutes ?? 30;
  return hhmm(Math.ceil((minutes(runTime) + length + 5) / 5) * 5);
}

/** One rule per activity and weekday (times differ per day); null key = rest day. */
type RuleSpec = { key: string | null; days: Day[]; time: string | null };
export const routineWeek: RuleSpec[] = WEEK.flatMap(({ day, run, gym }): RuleSpec[] =>
  !run || !gym
    ? [{ key: null, days: [day], time: null }]
    : [
        { key: run[0], days: [day], time: run[1] },
        { key: gym, days: [day], time: afterRun(run[0], run[1]) },
      ],
);
