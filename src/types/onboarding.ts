/** Onboarding draft (step 11): persisted after every step so a killed app resumes. */
import { z } from 'zod';

export const ONBOARDING_STEPS = [
  'name',
  'units',
  'height',
  'weight',
  'goal',
  'equipment',
  'days',
  'notifications',
  'lock',
  'done',
] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

const goalSchema = z.object({
  kind: z.enum(['lose_weight', 'build_muscle', 'run_better', 'consistency', 'custom']),
  targetWeightKg: z.number().min(25).max(300).nullable(),
  sessionsPerWeek: z.number().int().min(1).max(14).nullable(),
  customTitle: z.string().max(80).nullable(),
});
export type OnboardingGoal = z.infer<typeof goalSchema>;

export const onboardingDraftSchema = z.object({
  /** `redo` = re-run from Settings: a new plan replaces the weekly rules (step 12). */
  mode: z.enum(['first', 'redo']),
  step: z.enum(ONBOARDING_STEPS),
  name: z.string().max(60).nullable(),
  units: z.object({
    weight: z.enum(['kg', 'lb']),
    length: z.enum(['cm', 'in']),
    distance: z.enum(['km', 'mi']),
    speed: z.enum(['kmh', 'mph']),
  }),
  heightCm: z.number().min(100).max(250).nullable(),
  weightKg: z.number().min(25).max(300).nullable(),
  /** First selected goal (kept for the plan family and older drafts). */
  goal: goalSchema.nullable(),
  /** Every selected goal (1.1.0: several can be picked, e.g. lose weight + build muscle). */
  goals: z.array(goalSchema).default([]),
  equipmentPreset: z.enum(['full_gym', 'home_dumbbells', 'bodyweight']),
  /** Equipment ids marked available (null = untouched preset default). */
  equipmentIds: z.array(z.string()).nullable(),
  trainingDays: z.array(z.number().int().min(1).max(7)),
  trainingTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  acceptPlan: z.boolean(),
  /** 'vyro' = the owner's default week (docs/plan/weak.md); 'custom' = pick days. */
  plan: z.enum(['vyro', 'custom']).default('vyro'),
  notifications: z.boolean(),
  appLock: z.boolean(),
});

export type OnboardingDraft = z.infer<typeof onboardingDraftSchema>;
