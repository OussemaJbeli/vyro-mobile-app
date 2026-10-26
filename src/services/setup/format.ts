import { z } from 'zod';

import {
  DIFFICULTIES,
  EQUIPMENT_CATEGORIES,
  EXERCISE_CATEGORIES,
  EXERCISE_TRACKING,
  GOAL_TYPES,
  INTERVAL_KINDS,
  TEMPLATE_TYPES,
} from '@/types/enums';

/**
 * The setup file (1.4.0): everything you'd want to edit by hand — profile, body + goals,
 * equipment, custom exercises, workouts (exercises, sets, reps, weights, rest, run intervals)
 * and the VYRO cycle days. History, sessions, weigh-in history and statistics are never in it
 * and never touched by an import.
 *
 * Keys: built-in rows use their stable key ("bench_press", "gym_push"); your own rows use
 * their id. A new key on import creates a new row.
 */
export const SETUP_FORMAT = 'vyro-setup';
export const SETUP_VERSION = 1;

const opt = <T extends z.ZodTypeAny>(s: T) => s.nullable().optional();
const num = z.number().finite();

export const setupSchema = z.object({
  format: z.literal(SETUP_FORMAT),
  version: z.literal(SETUP_VERSION),
  exportedAt: z.string().optional(),
  profile: z
    .object({
      name: opt(z.string().max(60)),
      heightCm: opt(num.min(100).max(250)),
      dateOfBirth: opt(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
      units: z
        .object({
          weight: z.enum(['kg', 'lb']),
          length: z.enum(['cm', 'in']),
          distance: z.enum(['km', 'mi']),
          speed: z.enum(['kmh', 'mph']),
        })
        .optional(),
      weekStartsOn: z.union([z.literal(0), z.literal(1)]).optional(),
    })
    .optional(),
  body: z
    .object({
      /** Current weight; a different value logs a new weigh-in (history isn't edited). */
      weightKg: opt(num.min(25).max(300)),
      goals: z
        .array(
          z.object({
            type: z.enum(GOAL_TYPES),
            title: z.string().min(1).max(80),
            targetValue: opt(num),
            unit: opt(z.string().max(20)),
            targetDate: opt(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
          }),
        )
        .optional(),
    })
    .optional(),
  equipment: z
    .array(
      z.object({
        key: z.string().min(1),
        name: z.string().min(1).max(40),
        category: z.enum(EQUIPMENT_CATEGORIES).optional(),
        available: z.boolean(),
      }),
    )
    .optional(),
  exercises: z
    .array(
      z.object({
        key: z.string().min(1),
        name: z.string().min(1).max(60),
        category: z.enum(EXERCISE_CATEGORIES),
        primaryMuscle: z.string().min(1),
        secondaryMuscles: z.array(z.string()).default([]),
        tracking: z.enum(EXERCISE_TRACKING),
        equipment: z.array(z.string()).default([]),
        defaultSets: opt(z.number().int().positive()),
        defaultReps: opt(z.number().int().positive()),
        defaultDurationSeconds: opt(z.number().int().positive()),
        defaultRestSeconds: opt(z.number().int().nonnegative()),
        difficulty: opt(z.enum(DIFFICULTIES)),
        instructions: z.array(z.string()).default([]),
      }),
    )
    .optional(),
  workouts: z
    .array(
      z.object({
        key: z.string().min(1),
        name: z.string().min(1).max(60),
        type: z.enum(TEMPLATE_TYPES),
        description: opt(z.string().max(300)),
        durationMinutes: opt(z.number().int().positive()),
        exercises: z
          .array(
            z.object({
              exercise: z.string().min(1),
              sets: z.number().int().positive(),
              reps: opt(z.number().int().positive()),
              weightKg: opt(num.nonnegative()),
              durationSeconds: opt(z.number().int().positive()),
              restSeconds: opt(z.number().int().nonnegative()),
              notes: opt(z.string().max(300)),
            }),
          )
          .default([]),
        intervals: z
          .array(
            z.object({
              kind: z.enum(INTERVAL_KINDS),
              seconds: z.number().int().positive(),
              /** One of the two, as you like: treadmill mph or km/h. */
              speedMph: opt(num.min(0).max(18)),
              speedKmh: opt(num.min(0).max(30)),
              inclinePercent: opt(num.min(-5).max(30)),
              label: opt(z.string().max(40)),
            }),
          )
          .default([]),
      }),
    )
    .optional(),
  cycle: z
    .object({
      days: z
        .array(
          z.object({
            key: z.string().min(1),
            name: z.string().max(30),
            run: opt(z.string()),
            gym: opt(z.string()),
          }),
        )
        .min(1),
    })
    .optional(),
});

export type SetupFile = z.infer<typeof setupSchema>;

export class SetupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SetupError';
  }
}

/** Parses + validates a setup file; the message points at the first wrong field. */
export function parseSetup(text: string): SetupFile {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new SetupError('This file is not valid JSON.');
  }
  const r = setupSchema.safeParse(json);
  if (!r.success) {
    const issue = r.error.issues[0]!;
    throw new SetupError(`${issue.path.join('.') || 'file'}: ${issue.message}`);
  }
  return r.data;
}
