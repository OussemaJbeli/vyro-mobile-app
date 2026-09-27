/**
 * Form schemas (step 12). Screens validate with these through React Hook Form; the
 * repositories validate again with the domain schemas before writing.
 */
import { z } from 'zod';

import { type UserProfile } from './domain';

export type ProfileInput = Partial<
  Pick<
    UserProfile,
    | 'name'
    | 'heightCm'
    | 'dateOfBirth'
    | 'weekStartsOn'
    | 'weightUnit'
    | 'lengthUnit'
    | 'distanceUnit'
    | 'speedUnit'
  >
>;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const isRealDate = (v: string) => {
  if (!DATE.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
};

/** Text-field values as typed; converted to canonical values on save. */
export const profileFormSchema = z.object({
  name: z.string().max(60),
  height: z
    .string()
    .refine(
      (v) => v.trim() === '' || Number.isFinite(Number(v.replace(',', '.'))),
      'invalidHeight',
    ),
  dateOfBirth: z.string().refine((v) => v.trim() === '' || isRealDate(v.trim()), 'invalidDate'),
  weekStartsOn: z.union([z.literal(0), z.literal(1)]),
});
export type ProfileForm = z.infer<typeof profileFormSchema>;

export const GOAL_FORM_TYPES = [
  'weight',
  'measurement',
  'frequency',
  'consistency',
  'running',
  'muscle',
  'custom',
] as const;

/** Goal types tracked without a numeric target. */
export const QUALITATIVE_GOALS: readonly string[] = ['muscle', 'custom'];

export const goalFormSchema = z
  .object({
    type: z.enum(GOAL_FORM_TYPES),
    title: z.string().trim().min(1, 'required').max(80),
    target: z.string(),
    start: z.string(),
    measurementTypeId: z.string().nullable(),
    startDate: z.string().refine(isRealDate, 'invalidDate'),
    targetDate: z.string().refine((v) => v.trim() === '' || isRealDate(v.trim()), 'invalidDate'),
    notes: z.string().max(500),
  })
  .superRefine((v, ctx) => {
    const needsTarget = !QUALITATIVE_GOALS.includes(v.type);
    if (needsTarget && !Number.isFinite(Number(v.target.replace(',', '.')))) {
      ctx.addIssue({ code: 'custom', path: ['target'], message: 'required' });
    }
    if (needsTarget && v.target.trim() === '')
      ctx.addIssue({ code: 'custom', path: ['target'], message: 'required' });
    if (v.type === 'measurement' && !v.measurementTypeId) {
      ctx.addIssue({ code: 'custom', path: ['measurementTypeId'], message: 'required' });
    }
    if (v.targetDate.trim() && v.targetDate.trim() <= v.startDate) {
      ctx.addIssue({ code: 'custom', path: ['targetDate'], message: 'targetAfterStart' });
    }
  });
export type GoalForm = z.infer<typeof goalFormSchema>;

const optionalInt = (max: number) =>
  z
    .string()
    .refine(
      (v) => v.trim() === '' || (/^\d+$/.test(v.trim()) && Number(v) >= 0 && Number(v) <= max),
      'invalid',
    );

export const exerciseFormSchema = z.object({
  name: z.string().trim().min(1, 'required').max(60),
  category: z.enum([
    'chest',
    'back',
    'shoulders',
    'arms',
    'legs',
    'core',
    'full_body',
    'cardio',
    'mobility',
  ]),
  primaryMuscle: z.string().min(1, 'required'),
  secondaryMuscles: z.array(z.string()),
  tracking: z.enum(['weight_reps', 'reps', 'duration', 'distance_duration']),
  equipmentIds: z.array(z.string()),
  sets: optionalInt(20),
  reps: optionalInt(200),
  duration: optionalInt(7200),
  rest: optionalInt(900),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).nullable(),
  instructions: z.string().max(1500),
  alternatives: z.array(z.string()),
});
export type ExerciseForm = z.infer<typeof exerciseFormSchema>;
