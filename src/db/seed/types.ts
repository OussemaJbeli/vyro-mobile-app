import {
  type DIFFICULTIES,
  type EQUIPMENT_CATEGORIES,
  type EXERCISE_CATEGORIES,
  type EXERCISE_TRACKING,
  type INTERVAL_KINDS,
  type MEASUREMENT_KINDS,
  type TEMPLATE_TYPES,
} from '@/types/enums';

type Of<T extends readonly string[]> = T[number];

export type SeedEquipment = {
  slug: string;
  name: string;
  category: Of<typeof EQUIPMENT_CATEGORIES>;
};

export type SeedExercise = {
  slug: string;
  name: string;
  category: Of<typeof EXERCISE_CATEGORIES>;
  primaryMuscle: string;
  secondaryMuscles: string[];
  tracking: Of<typeof EXERCISE_TRACKING>;
  /** Equipment slugs; ALL are required. Empty = bodyweight. */
  equipment: string[];
  defaultSets: number;
  defaultReps: number | null;
  defaultDurationSeconds: number | null;
  defaultRestSeconds: number | null;
  difficulty: Of<typeof DIFFICULTIES>;
  instructions: string[];
};

export type SeedTemplateExercise = {
  exercise: string;
  sets: number;
  targetReps?: number;
  targetDurationSeconds?: number;
  /** Starting weight (kg); later sessions start from what was actually lifted. */
  targetWeightKg?: number;
  /** Defaults to the exercise's rest. */
  restSeconds?: number;
  notes?: string;
};

export type SeedInterval = {
  kind: Of<typeof INTERVAL_KINDS>;
  durationSeconds: number;
  speedKmh: number;
  inclinePercent: number;
  label: string | null;
};

export type SeedTemplate = {
  key: string;
  name: string;
  type: Of<typeof TEMPLATE_TYPES>;
  durationMinutes: number;
  difficulty: Of<typeof DIFFICULTIES>;
  coverKey: string;
  description: string;
  exercises?: SeedTemplateExercise[];
  intervals?: SeedInterval[];
};

export type SeedData = {
  equipment: SeedEquipment[];
  exercises: SeedExercise[];
  /** exercise slug → alternative slugs, best first (priority = index + 1). */
  alternatives: Record<string, string[]>;
  measurementTypes: {
    slug: string;
    name: string;
    kind: Of<typeof MEASUREMENT_KINDS>;
    orderIndex: number;
  }[];
  photoCategories: { slug: string; parentSlug: string | null; orderIndex: number }[];
  templates: SeedTemplate[];
};
