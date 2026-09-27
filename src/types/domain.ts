/**
 * Domain models (camelCase) with Zod schemas (step 08). Shared by repositories,
 * domain logic and forms (React Hook Form resolvers). Rows are mapped in src/db/mappers.ts.
 */
import { z } from 'zod';

import * as E from './enums';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export const zId = z.string().min(1);
export const zLocalDate = z.string().regex(DATE, 'Expected YYYY-MM-DD');
export const zLocalTime = z.string().regex(TIME, 'Expected HH:mm');
export const zInstant = z.iso.datetime({ offset: true });
const nullable = <T extends z.ZodType>(s: T) => s.nullable();
const zInt = z.number().int();
const zNonNegInt = zInt.nonnegative();
const zText = z.string();

/** id, timestamps and soft delete: every syncable table has these (AD-04). */
export const baseFields = {
  id: zId,
  createdAt: zInstant,
  updatedAt: zInstant,
  deletedAt: nullable(zInstant),
};

export const userProfileSchema = z.object({
  ...baseFields,
  name: nullable(zText),
  heightCm: nullable(z.number().positive()),
  dateOfBirth: nullable(zLocalDate),
  weightUnit: z.enum(E.WEIGHT_UNITS),
  lengthUnit: z.enum(E.LENGTH_UNITS),
  distanceUnit: z.enum(E.DISTANCE_UNITS),
  speedUnit: z.enum(E.SPEED_UNITS),
  weekStartsOn: zInt.min(0).max(6),
  onboardingCompletedAt: nullable(zInstant),
});

export const measurementTypeSchema = z.object({
  ...baseFields,
  slug: nullable(zText),
  name: zText.min(1),
  kind: z.enum(E.MEASUREMENT_KINDS),
  unitOther: nullable(zText),
  orderIndex: zInt,
  isCustom: z.boolean(),
  archivedAt: nullable(zInstant),
});

export const goalSchema = z.object({
  ...baseFields,
  type: z.enum(E.GOAL_TYPES),
  title: zText.min(1),
  targetValue: nullable(z.number()),
  unit: nullable(zText),
  startValue: nullable(z.number()),
  measurementTypeId: nullable(zId),
  startDate: zLocalDate,
  targetDate: nullable(zLocalDate),
  status: z.enum(E.GOAL_STATUSES),
  achievedAt: nullable(zInstant),
  notes: nullable(zText),
});

export const equipmentSchema = z.object({
  ...baseFields,
  slug: nullable(zText),
  name: zText.min(1),
  category: z.enum(E.EQUIPMENT_CATEGORIES),
  available: z.boolean(),
  isCustom: z.boolean(),
  notes: nullable(zText),
  /** Custom icon (semantic icon name) or picture (private relative path), m004. */
  iconKey: nullable(zText),
  imagePath: nullable(
    zText.refine((p) => !p.startsWith('/') && !p.includes('://'), 'Must be relative'),
  ),
});

export const exerciseSchema = z.object({
  ...baseFields,
  slug: nullable(zText),
  name: zText.min(1),
  category: z.enum(E.EXERCISE_CATEGORIES),
  primaryMuscle: zText.min(1),
  secondaryMuscles: z.array(zText),
  tracking: z.enum(E.EXERCISE_TRACKING),
  instructions: nullable(zText),
  defaultSets: nullable(zInt.positive()),
  defaultReps: nullable(zInt.positive()),
  defaultDurationSeconds: nullable(zInt.positive()),
  defaultRestSeconds: nullable(zNonNegInt),
  difficulty: nullable(z.enum(E.DIFFICULTIES)),
  isCustom: z.boolean(),
  archivedAt: nullable(zInstant),
});

export const exerciseEquipmentSchema = z.object({ exerciseId: zId, equipmentId: zId });

export const exerciseAlternativeSchema = z.object({
  exerciseId: zId,
  alternativeId: zId,
  priority: zInt.positive(),
  note: nullable(zText),
});

export const workoutTemplateSchema = z.object({
  ...baseFields,
  name: zText.min(1),
  type: z.enum(E.TEMPLATE_TYPES),
  description: nullable(zText),
  durationMinutes: nullable(zInt.positive()),
  difficulty: nullable(z.enum(E.DIFFICULTIES)),
  coverKey: nullable(zText),
  distanceTargetKm: nullable(z.number().positive()),
  isSeed: z.boolean(),
  archivedAt: nullable(zInstant),
  notes: nullable(zText),
});

export const templateExerciseSchema = z.object({
  ...baseFields,
  templateId: zId,
  exerciseId: zId,
  orderIndex: zNonNegInt,
  sets: zInt.positive(),
  targetReps: nullable(zInt.positive()),
  targetDurationSeconds: nullable(zInt.positive()),
  targetWeightKg: nullable(z.number().nonnegative()),
  restSeconds: nullable(zNonNegInt),
  supersetGroup: nullable(zText),
  notes: nullable(zText),
});

export const templateIntervalSchema = z.object({
  ...baseFields,
  templateId: zId,
  orderIndex: zNonNegInt,
  kind: z.enum(E.INTERVAL_KINDS),
  durationSeconds: zInt.positive(),
  speedKmh: nullable(z.number().min(0).max(30)),
  inclinePercent: nullable(z.number()),
  label: nullable(zText),
});

export const scheduleRuleSchema = z.object({
  ...baseFields,
  templateId: nullable(zId),
  title: zText.min(1),
  type: z.enum(E.SESSION_TYPES),
  freq: z.enum(E.RULE_FREQUENCIES),
  interval: zInt.positive(),
  /** ISO weekdays: 1 = Monday … 7 = Sunday. */
  byWeekday: nullable(z.array(zInt.min(1).max(7))),
  byMonthDay: nullable(zInt.min(1).max(31)),
  startDate: zLocalDate,
  endDate: nullable(zLocalDate),
  startTime: nullable(zLocalTime),
  durationMinutes: nullable(zInt.positive()),
  reminderOffsetMinutes: nullable(zNonNegInt),
  active: z.boolean(),
  materializedUntil: nullable(zLocalDate),
});

export const scheduledSessionSchema = z.object({
  ...baseFields,
  ruleId: nullable(zId),
  templateId: nullable(zId),
  title: zText.min(1),
  type: z.enum(E.SESSION_TYPES),
  scheduledDate: zLocalDate,
  startTime: nullable(zLocalTime),
  endTime: nullable(zLocalTime),
  durationMinutes: nullable(zInt.positive()),
  status: z.enum(E.SESSION_STATUSES),
  originalDate: zLocalDate,
  originalStartTime: nullable(zLocalTime),
  rescheduleCount: zNonNegInt,
  isException: z.boolean(),
  orderInDay: zInt,
  reminderOffsetMinutes: nullable(zNonNegInt),
  skipReason: nullable(zText),
  notes: nullable(zText),
});

/** Plan frozen at execution start (AD-07). History renders from this, never the live template. */
export const plannedSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  templateId: nullable(zId),
  name: zText,
  type: z.enum(E.SESSION_TYPES),
  exercises: z.array(
    z.object({
      exerciseId: zId,
      name: zText,
      tracking: z.enum(E.EXERCISE_TRACKING),
      orderIndex: zNonNegInt,
      sets: zInt.positive(),
      targetReps: nullable(zInt.positive()),
      targetDurationSeconds: nullable(zInt.positive()),
      targetWeightKg: nullable(z.number().nonnegative()),
      restSeconds: nullable(zNonNegInt),
      notes: nullable(zText),
    }),
  ),
  intervals: z.array(
    z.object({
      orderIndex: zNonNegInt,
      kind: z.enum(E.INTERVAL_KINDS),
      durationSeconds: zInt.positive(),
      speedKmh: nullable(z.number().min(0)),
      inclinePercent: nullable(z.number()),
      label: nullable(zText),
    }),
  ),
});

/**
 * Execution engine state that is not in the actual rows (step 17): lifecycle, cursor and
 * timers. Times are epoch ms; `*ActiveMs` are on the pause-excluding active clock (AD-10).
 */
export const runtimeStateSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.enum(['strength', 'running']),
  lifecycle: z.enum(['active', 'paused', 'completed', 'abandoned']),
  startedAt: z.number(),
  pausedAt: z.number().nullable(),
  accumulatedPauseMs: z.number().nonnegative(),
  autoRest: z.boolean(),
  circuit: z.boolean().default(false),
  cursor: z.object({ exercise: zNonNegInt, set: zNonNegInt }).nullable(),
  phase: z.enum(['working', 'resting', 'all_done']),
  rest: z.object({ startActiveMs: z.number(), durationMs: z.number(), forSetId: zId }).nullable(),
  workTimer: z.object({ startActiveMs: z.number(), targetMs: z.number() }).nullable(),
  current: z
    .object({ index: zNonNegInt, startActiveMs: z.number(), startedAt: z.number() })
    .nullable(),
  /** Tracking per session exercise (substitutions and added exercises can change it). */
  tracking: z.record(z.string(), z.enum(E.EXERCISE_TRACKING)),
  /** Interval targets changed with "± duration", in seconds. */
  targets: z.record(z.string(), zInt.positive()),
});

export const sessionExecutionSchema = z.object({
  ...baseFields,
  scheduledSessionId: nullable(zId),
  templateId: nullable(zId),
  type: z.enum(E.SESSION_TYPES),
  title: zText.min(1),
  status: z.enum(E.EXECUTION_STATUSES),
  outcome: nullable(z.enum(E.EXECUTION_OUTCOMES)),
  startedAt: zInstant,
  endedAt: nullable(zInstant),
  activeSeconds: nullable(zNonNegInt),
  pausedSeconds: nullable(zNonNegInt),
  plannedSnapshot: plannedSnapshotSchema,
  runtimeState: nullable(runtimeStateSchema),
  isRetroactive: z.boolean(),
  perceivedEffort: nullable(zInt.min(1).max(10)),
  distanceKm: nullable(z.number().nonnegative()),
  notes: nullable(zText),
});

export const sessionExerciseSchema = z.object({
  ...baseFields,
  executionId: zId,
  exerciseId: zId,
  plannedExerciseId: nullable(zId),
  orderIndex: zNonNegInt,
  plannedSets: nullable(zInt.positive()),
  plannedReps: nullable(zInt.positive()),
  plannedDurationSeconds: nullable(zInt.positive()),
  plannedWeightKg: nullable(z.number().nonnegative()),
  plannedRestSeconds: nullable(zNonNegInt),
  status: z.enum(E.SESSION_EXERCISE_STATUSES),
  substitutionReason: nullable(zText),
  notes: nullable(zText),
});

export const exerciseSetSchema = z.object({
  ...baseFields,
  sessionExerciseId: zId,
  setIndex: zNonNegInt,
  plannedReps: nullable(zNonNegInt),
  plannedWeightKg: nullable(z.number().nonnegative()),
  plannedDurationSeconds: nullable(zNonNegInt),
  actualReps: nullable(zNonNegInt),
  actualWeightKg: nullable(z.number().nonnegative()),
  actualDurationSeconds: nullable(zNonNegInt),
  restTakenSeconds: nullable(zNonNegInt),
  status: z.enum(E.SET_STATUSES),
  isExtra: z.boolean(),
  completedAt: nullable(zInstant),
});

export const intervalLogSchema = z.object({
  ...baseFields,
  executionId: zId,
  orderIndex: zNonNegInt,
  kind: z.enum(E.INTERVAL_KINDS),
  label: nullable(zText),
  plannedDurationSeconds: nullable(zInt.positive()),
  plannedSpeedKmh: nullable(z.number().nonnegative()),
  plannedInclinePercent: nullable(z.number()),
  actualDurationSeconds: nullable(zNonNegInt),
  actualSpeedKmh: nullable(z.number().nonnegative()),
  actualInclinePercent: nullable(z.number()),
  status: z.enum(E.INTERVAL_LOG_STATUSES),
  isRepeat: z.boolean(),
  startedAt: nullable(zInstant),
  endedAt: nullable(zInstant),
});

export const weightEntrySchema = z.object({
  ...baseFields,
  valueKg: z.number().gt(0).lt(500),
  unitEntered: z.enum(E.WEIGHT_UNITS),
  recordedAt: zInstant,
  notes: nullable(zText),
});

export const bodyMeasurementSchema = z.object({
  ...baseFields,
  measurementTypeId: zId,
  value: z.number(),
  unitEntered: z.enum(E.MEASUREMENT_UNITS),
  recordedAt: zInstant,
  notes: nullable(zText),
});

export const photoCategorySchema = z.object({
  slug: zText.min(1),
  parentSlug: nullable(zText),
  orderIndex: zInt,
  /** User-created progress-photo groups carry their own name (m004); seeded ones are translated. */
  name: nullable(zText),
});

export const progressPhotoSchema = z.object({
  ...baseFields,
  category: zText.min(1),
  subCategory: nullable(zText),
  /** Relative to the private photo root, never absolute (AD-13). */
  filePath: zText
    .min(1)
    .refine((p) => !p.startsWith('/') && !p.includes('://'), 'Must be relative'),
  thumbPath: zText
    .min(1)
    .refine((p) => !p.startsWith('/') && !p.includes('://'), 'Must be relative'),
  width: nullable(zInt.positive()),
  height: nullable(zInt.positive()),
  bytes: nullable(zInt.nonnegative()),
  capturedAt: zInstant,
  weightEntryId: nullable(zId),
  notes: nullable(zText),
});

/** Exercise image/GIF (private relative file) or video link (step 28 follow-up). */
export const exerciseMediaSchema = z.object({
  ...baseFields,
  exerciseId: zId,
  kind: z.enum(E.EXERCISE_MEDIA_KINDS),
  filePath: nullable(
    zText.refine((p) => !p.startsWith('/') && !p.includes('://'), 'Must be relative'),
  ),
  url: nullable(zText.regex(/^https:\/\//)),
  orderIndex: zInt,
});

export const notificationScheduleSchema = z.object({
  ...baseFields,
  kind: z.enum(E.NOTIFICATION_KINDS),
  targetId: nullable(zText),
  osNotificationId: zText.min(1),
  fireAt: zInstant,
});

export type UserProfile = z.infer<typeof userProfileSchema>;
export type MeasurementType = z.infer<typeof measurementTypeSchema>;
export type Goal = z.infer<typeof goalSchema>;
export type Equipment = z.infer<typeof equipmentSchema>;
export type Exercise = z.infer<typeof exerciseSchema>;
export type ExerciseEquipment = z.infer<typeof exerciseEquipmentSchema>;
export type ExerciseAlternative = z.infer<typeof exerciseAlternativeSchema>;
export type WorkoutTemplate = z.infer<typeof workoutTemplateSchema>;
export type TemplateExercise = z.infer<typeof templateExerciseSchema>;
export type TemplateInterval = z.infer<typeof templateIntervalSchema>;
export type ScheduleRule = z.infer<typeof scheduleRuleSchema>;
export type ScheduledSession = z.infer<typeof scheduledSessionSchema>;
export type PlannedSnapshot = z.infer<typeof plannedSnapshotSchema>;
export type RuntimeState = z.infer<typeof runtimeStateSchema>;
export type SessionExecution = z.infer<typeof sessionExecutionSchema>;
export type SessionExercise = z.infer<typeof sessionExerciseSchema>;
export type ExerciseSet = z.infer<typeof exerciseSetSchema>;
export type IntervalLog = z.infer<typeof intervalLogSchema>;
export type WeightEntry = z.infer<typeof weightEntrySchema>;
export type BodyMeasurement = z.infer<typeof bodyMeasurementSchema>;
export type PhotoCategory = z.infer<typeof photoCategorySchema>;
export type ProgressPhoto = z.infer<typeof progressPhotoSchema>;
export type NotificationSchedule = z.infer<typeof notificationScheduleSchema>;
export type ExerciseMedia = z.infer<typeof exerciseMediaSchema>;

const SYSTEM = { id: true, createdAt: true, updatedAt: true, deletedAt: true } as const;

/** Create input = model without system columns; update input = partial create input. */
export function inputSchemas<S extends z.ZodObject<typeof baseFields & z.ZodRawShape>>(schema: S) {
  const create = schema.omit(SYSTEM);
  return { create, update: create.partial() };
}
