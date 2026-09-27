/**
 * The owner's training routine (docs/default programs): a 3-on / 1-off cycle shared by
 * running (16:30), gym (after the run) and six-pack (12:10). Seed v2 adds the rows; the
 * schedule itself is created once by `applyRoutine` (src/db/routine.ts).
 */
import {
  type SeedEquipment,
  type SeedExercise,
  type SeedInterval,
  type SeedTemplate,
} from '../types';

export const routineEquipment: SeedEquipment[] = [
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

// Compounds rest 2–3 min, isolation 60–120 s. Target = bottom of the range (notes hold it).
const C = 150;
const I = 90;
const range = (r: string) => `${r} reps · stop 1–3 reps before failure`;

const baseTemplates: SeedTemplate[] = [
  // Gym: Day 1 → Day 2 → Day 3 → rest.
  {
    key: 'gym_chest_lats',
    name: 'Day 1 · Chest + Lats',
    type: 'gym',
    durationMinutes: 70,
    difficulty: 'intermediate',
    coverKey: 'gym_chest_lats',
    description: 'Chest then lats/back. Warm up 5–10 min plus lighter sets before the bench.',
    exercises: [
      { exercise: 'bench_press', sets: 3, targetReps: 6, restSeconds: 180, notes: range('6–8') },
      {
        exercise: 'incline_dumbbell_press',
        sets: 3,
        targetReps: 8,
        restSeconds: C,
        notes: range('8–10'),
      },
      {
        exercise: 'incline_dumbbell_fly',
        sets: 2,
        targetReps: 10,
        restSeconds: I,
        notes: range('10–15'),
      },
      {
        exercise: 'machine_chest_dip',
        sets: 2,
        targetReps: 10,
        restSeconds: I,
        notes: range('10–15'),
      },
      { exercise: 'lat_pulldown', sets: 3, targetReps: 8, restSeconds: 120, notes: range('8–12') },
      { exercise: 'seated_row', sets: 3, targetReps: 8, restSeconds: 120, notes: range('8–12') },
      {
        exercise: 'chest_supported_row',
        sets: 2,
        targetReps: 10,
        restSeconds: I,
        notes: range('10–12'),
      },
    ],
  },
  {
    key: 'gym_shoulders_legs',
    name: 'Day 2 · Shoulders + Legs',
    type: 'gym',
    durationMinutes: 75,
    difficulty: 'intermediate',
    coverKey: 'gym_shoulders_legs',
    description: 'Shoulders then legs. Lighter warm-up sets before the press and the squat.',
    exercises: [
      {
        exercise: 'dumbbell_shoulder_press',
        sets: 3,
        targetReps: 6,
        restSeconds: C,
        notes: range('6–10'),
      },
      {
        exercise: 'lateral_raise',
        sets: 3,
        targetReps: 12,
        restSeconds: 75,
        notes: range('12–15'),
      },
      {
        exercise: 'cable_lateral_raise',
        sets: 2,
        targetReps: 12,
        restSeconds: 75,
        notes: range('12–15'),
      },
      {
        exercise: 'reverse_pec_deck',
        sets: 3,
        targetReps: 12,
        restSeconds: 75,
        notes: range('12–15'),
      },
      { exercise: 'squat', sets: 3, targetReps: 6, restSeconds: 180, notes: range('6–10') },
      { exercise: 'leg_extension', sets: 2, targetReps: 10, restSeconds: I, notes: range('10–15') },
      { exercise: 'leg_curl', sets: 3, targetReps: 10, restSeconds: I, notes: range('10–15') },
      {
        exercise: 'machine_calf_raise',
        sets: 3,
        targetReps: 10,
        restSeconds: 75,
        notes: range('10–15'),
      },
    ],
  },
  {
    key: 'gym_arms',
    name: 'Day 3 · Biceps + Triceps',
    type: 'gym',
    durationMinutes: 55,
    difficulty: 'intermediate',
    coverKey: 'gym_arms',
    description: 'Biceps then triceps. Full, controlled range on every rep.',
    exercises: [
      { exercise: 'ez_bar_curl', sets: 3, targetReps: 6, restSeconds: 120, notes: range('6–10') },
      { exercise: 'preacher_curl', sets: 3, targetReps: 8, restSeconds: I, notes: range('8–12') },
      { exercise: 'hammer_curl', sets: 2, targetReps: 10, restSeconds: 75, notes: range('10–15') },
      {
        exercise: 'close_grip_bench_press',
        sets: 3,
        targetReps: 6,
        restSeconds: C,
        notes: range('6–10'),
      },
      {
        exercise: 'tricep_extension',
        sets: 3,
        targetReps: 8,
        restSeconds: I,
        notes: range('8–12') + ' · dumbbell or cable',
      },
      {
        exercise: 'tricep_pushdown',
        sets: 2,
        targetReps: 10,
        restSeconds: 75,
        notes: range('10–15'),
      },
    ],
  },

  // Six-pack at 12:10, same 3-on / 1-off days.
  {
    key: 'abs_a',
    name: 'Abs A · Crunch',
    type: 'abs',
    durationMinutes: 12,
    difficulty: 'intermediate',
    coverKey: 'abs_a',
    description: 'Flexion focus: upper and lower abs.',
    exercises: [
      { exercise: 'crunch', sets: 3, targetReps: 15, restSeconds: 45 },
      {
        exercise: 'hanging_leg_raise',
        sets: 3,
        targetReps: 10,
        restSeconds: 45,
        notes: '10–12 reps',
      },
      { exercise: 'plank', sets: 3, targetDurationSeconds: 45, restSeconds: 45 },
    ],
  },
  {
    key: 'abs_b',
    name: 'Abs B · Stability',
    type: 'abs',
    durationMinutes: 12,
    difficulty: 'beginner',
    coverKey: 'abs_b',
    description: 'Anti-rotation and obliques: easy on leg day.',
    exercises: [
      { exercise: 'dead_bug', sets: 3, targetReps: 10, restSeconds: 45, notes: 'Per side' },
      {
        exercise: 'side_plank',
        sets: 3,
        targetDurationSeconds: 30,
        restSeconds: 30,
        notes: 'Per side',
      },
      { exercise: 'russian_twist', sets: 3, targetReps: 20, restSeconds: 45 },
    ],
  },
  {
    key: 'abs_c',
    name: 'Abs C · Power',
    type: 'abs',
    durationMinutes: 12,
    difficulty: 'intermediate',
    coverKey: 'abs_c',
    description: 'Harder moves: rollouts, rotation, full range.',
    exercises: [
      { exercise: 'ab_wheel_rollout', sets: 3, targetReps: 8, restSeconds: 60, notes: '8–10 reps' },
      { exercise: 'bicycle_crunch', sets: 3, targetReps: 20, restSeconds: 45 },
      { exercise: 'v_up', sets: 3, targetReps: 12, restSeconds: 45 },
    ],
  },

  // Running at 16:30. Two 3-day blocks (8-day cycle with the rest days).
  {
    key: 'run_speed_intervals',
    name: 'Speed Intervals',
    type: 'running',
    durationMinutes: 25,
    difficulty: 'advanced',
    coverKey: 'run_speed_intervals',
    description: '8 × (1 min fast + 1 min easy). Hard but controlled, not all-out.',
    intervals: [
      seg('warmup', 5, 4.5, 1),
      ...rounds(8, seg('sprint', 1, 9, 1, 'Fast'), seg('recovery', 1, 6, 1, 'Easy')),
      seg('cooldown', 4, 4.5, 1),
    ],
  },
  {
    key: 'run_incline_endurance',
    name: 'Incline Endurance',
    type: 'running',
    durationMinutes: 30,
    difficulty: 'intermediate',
    coverKey: 'run_incline_endurance',
    description: 'Steady incline run: aerobic endurance and calorie burn.',
    intervals: [seg('warmup', 5, 4.25, 1), seg('run', 20, 6, 3), seg('cooldown', 5, 4.25, 1)],
  },
  {
    key: 'run_incline_power',
    name: 'Incline Power',
    type: 'running',
    durationMinutes: 35,
    difficulty: 'advanced',
    coverKey: 'run_incline_power',
    description: '5 × (3 min steep + 2 min easy): leg strength and conditioning.',
    intervals: [
      seg('warmup', 5, 4.5, 1),
      ...rounds(5, seg('run', 3, 5.25, 7, 'Hill'), seg('walk', 2, 4, 1, 'Easy')),
      seg('cooldown', 5, 4, 1),
    ],
  },
  {
    key: 'run_speed_endurance',
    name: 'Speed Endurance',
    type: 'running',
    durationMinutes: 34,
    difficulty: 'advanced',
    coverKey: 'run_speed_endurance',
    description: '4 × (4 min fast + 2 min easy): hold a fast pace for longer.',
    intervals: [
      seg('warmup', 7 / 3, 4, 1, '4 mph'),
      seg('warmup', 7 / 3, 5, 1, '5 mph'),
      seg('warmup', 7 / 3, 6, 1, '6 mph'),
      ...rounds(4, seg('run', 4, 7.25, 1, 'Fast'), seg('recovery', 2, 4.5, 1, 'Easy')),
      seg('cooldown', 3, 4, 1),
    ],
  },
  {
    key: 'run_easy_strides',
    name: 'Easy Run + Strides',
    type: 'running',
    durationMinutes: 30,
    difficulty: 'beginner',
    coverKey: 'run_easy_strides',
    description: 'Easy aerobic run with short relaxed strides: fresh legs for squats.',
    intervals: [
      seg('warmup', 5, 4.5, 1),
      seg('run', 14, 5.5, 1),
      ...rounds(6, seg('sprint', 1 / 3, 7.5, 1, 'Stride'), seg('walk', 2 / 3, 4, 1, 'Walk')),
      seg('cooldown', 5, 4, 1),
    ],
  },
  {
    key: 'run_long_aerobic',
    name: 'Long Aerobic Run',
    type: 'running',
    durationMinutes: 40,
    difficulty: 'intermediate',
    coverKey: 'run_long_aerobic',
    description: 'Aerobic base. Add 2–5 min to the middle part every few weeks (up to 35 min).',
    intervals: [seg('warmup', 5, 4.25, 1), seg('run', 30, 5.75, 2.5), seg('cooldown', 5, 4, 1)],
  },
];

/** The owner's gym standard (1.1.0): 3 sets of 15 on every lift; weights carry over. */
export const GYM_SETS = 3;
export const GYM_REPS = 15;

export const routineTemplates: SeedTemplate[] = baseTemplates.map((tpl) =>
  tpl.type === 'gym'
    ? {
        ...tpl,
        exercises: (tpl.exercises ?? []).map((e) => ({
          ...e,
          sets: GYM_SETS,
          targetReps: GYM_REPS,
          notes: 'Same weight as last time, or add a little when all 15 reps feel clean',
        })),
      }
    : tpl,
);

type Day = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/**
 * The owner's week (docs/plan/weak.md), the same every week (ISO weekdays, 1 = Monday).
 * The gym starts when the run is done: run start + run length + 5 min, rounded up to 5.
 */
const WEEK: { day: Day; abs?: string; run?: [key: string, time: string]; gym?: string }[] = [
  { day: 1, abs: '12:10', run: ['run_speed_intervals', '16:30'], gym: 'gym_chest_lats' },
  { day: 2, abs: '12:10', run: ['run_incline_endurance', '16:30'], gym: 'gym_shoulders_legs' },
  { day: 3, abs: '16:10', run: ['run_incline_power', '14:30'], gym: 'gym_arms' },
  { day: 4 },
  { day: 5, abs: '16:10', run: ['run_speed_endurance', '14:30'], gym: 'gym_chest_lats' },
  { day: 6, abs: '12:10', run: ['run_easy_strides', '16:30'], gym: 'gym_shoulders_legs' },
  { day: 7, abs: '12:10', run: ['run_long_aerobic', '14:30'], gym: 'gym_arms' },
];
const ABS_BY_GYM: Record<string, string> = {
  gym_chest_lats: 'abs_a',
  gym_shoulders_legs: 'abs_b',
  gym_arms: 'abs_c',
};

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
export const routineWeek: RuleSpec[] = WEEK.flatMap(({ day, abs, run, gym }): RuleSpec[] =>
  !run || !gym
    ? [{ key: null, days: [day], time: null }]
    : [
        { key: ABS_BY_GYM[gym]!, days: [day], time: abs ?? '12:10' },
        { key: run[0], days: [day], time: run[1] },
        { key: gym, days: [day], time: afterRun(run[0], run[1]) },
      ],
);
