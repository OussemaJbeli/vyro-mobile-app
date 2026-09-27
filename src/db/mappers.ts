/**
 * Row ↔ model mapping (step 08). Rows are snake_case with INTEGER booleans and JSON text;
 * models are camelCase with real booleans and parsed JSON, validated by Zod.
 * Anything invalid becomes AppError('VALIDATION') — never a silent bad value.
 */
import { type z } from 'zod';

import * as S from '@/types/domain';
import { AppError } from '@/utils/errors';

type AnySchema = z.ZodObject<z.ZodRawShape>;

export type TableSpec<M extends AnySchema = AnySchema> = {
  table: string;
  schema: M;
  /** camelCase fields stored as INTEGER 0/1. */
  bool?: readonly string[];
  /** camelCase fields stored as JSON TEXT. */
  json?: readonly string[];
};

const snake = (k: string) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const camel = (k: string) => k.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());

function validation(spec: TableSpec, issues: unknown, message: string): AppError {
  return new AppError('VALIDATION', `${spec.table}: ${message}`, {
    context: { table: spec.table, issues },
  });
}

/** SQL row → validated model. */
export function fromRow<M extends AnySchema>(
  spec: TableSpec<M>,
  row: Record<string, unknown>,
): z.infer<M> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const field = camel(key);
    if (spec.bool?.includes(field))
      out[field] = value === null ? null : value === 1 || value === true;
    else if (spec.json?.includes(field)) {
      if (value === null || value === undefined) out[field] = null;
      else {
        try {
          out[field] = JSON.parse(String(value));
        } catch {
          throw validation(spec, [{ path: [field] }], `malformed JSON in ${field}`);
        }
      }
    } else out[field] = value;
  }
  const parsed = spec.schema.safeParse(out);
  if (!parsed.success) throw validation(spec, parsed.error.issues, 'row failed validation');
  return parsed.data as z.infer<M>;
}

/** Model (or partial model) → SQL values keyed by column. Validates full models first. */
export function toRow<M extends AnySchema>(
  spec: TableSpec<M>,
  model: Partial<z.infer<M>>,
  { partial = false }: { partial?: boolean } = {},
): Record<string, string | number | null> {
  const checked = (partial ? spec.schema.partial() : spec.schema).safeParse(model);
  if (!checked.success) throw validation(spec, checked.error.issues, 'model failed validation');
  const out: Record<string, string | number | null> = {};
  for (const [field, value] of Object.entries(checked.data as Record<string, unknown>)) {
    if (value === undefined) continue;
    const column = snake(field);
    if (spec.bool?.includes(field)) out[column] = value === null ? null : value ? 1 : 0;
    else if (spec.json?.includes(field))
      out[column] = value === null ? null : JSON.stringify(value);
    else out[column] = value as string | number | null;
  }
  return out;
}

/** Registry of every mapped table. Order follows the DDL. */
export const tables = {
  userProfile: { table: 'user_profile', schema: S.userProfileSchema },
  measurementTypes: {
    table: 'measurement_types',
    schema: S.measurementTypeSchema,
    bool: ['isCustom'],
  },
  goals: { table: 'goals', schema: S.goalSchema },
  equipment: { table: 'equipment', schema: S.equipmentSchema, bool: ['available', 'isCustom'] },
  exercises: {
    table: 'exercises',
    schema: S.exerciseSchema,
    bool: ['isCustom'],
    json: ['secondaryMuscles'],
  },
  exerciseEquipment: { table: 'exercise_equipment', schema: S.exerciseEquipmentSchema },
  exerciseAlternatives: { table: 'exercise_alternatives', schema: S.exerciseAlternativeSchema },
  workoutTemplates: {
    table: 'workout_templates',
    schema: S.workoutTemplateSchema,
    bool: ['isSeed'],
  },
  templateExercises: { table: 'workout_template_exercises', schema: S.templateExerciseSchema },
  templateIntervals: { table: 'template_running_intervals', schema: S.templateIntervalSchema },
  scheduleRules: {
    table: 'schedule_rules',
    schema: S.scheduleRuleSchema,
    bool: ['active'],
    json: ['byWeekday'],
  },
  scheduledSessions: {
    table: 'scheduled_sessions',
    schema: S.scheduledSessionSchema,
    bool: ['isException'],
  },
  sessionExecutions: {
    table: 'session_executions',
    schema: S.sessionExecutionSchema,
    bool: ['isRetroactive'],
    json: ['plannedSnapshot', 'runtimeState'],
  },
  sessionExercises: { table: 'session_exercises', schema: S.sessionExerciseSchema },
  exerciseSets: { table: 'exercise_sets', schema: S.exerciseSetSchema, bool: ['isExtra'] },
  intervalLogs: { table: 'running_interval_logs', schema: S.intervalLogSchema, bool: ['isRepeat'] },
  weightEntries: { table: 'weight_entries', schema: S.weightEntrySchema },
  bodyMeasurements: { table: 'body_measurements', schema: S.bodyMeasurementSchema },
  photoCategories: { table: 'photo_categories', schema: S.photoCategorySchema },
  progressPhotos: { table: 'progress_photos', schema: S.progressPhotoSchema },
  notificationSchedules: { table: 'notification_schedules', schema: S.notificationScheduleSchema },
  exerciseMedia: { table: 'exercise_media', schema: S.exerciseMediaSchema },
} as const satisfies Record<string, TableSpec>;

export type TableName = keyof typeof tables;
