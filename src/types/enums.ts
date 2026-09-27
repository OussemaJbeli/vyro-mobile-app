/** Enum values shared by the SQL CHECK constraints, Zod schemas and UI (step 08). */
export const WEIGHT_UNITS = ['kg', 'lb'] as const;
export const LENGTH_UNITS = ['cm', 'in'] as const;
export const DISTANCE_UNITS = ['km', 'mi'] as const;
export const SPEED_UNITS = ['kmh', 'mph'] as const;

export const GOAL_TYPES = [
  'weight',
  'measurement',
  'consistency',
  'running',
  'frequency',
  'muscle',
  'custom',
] as const;
export const GOAL_STATUSES = ['active', 'paused', 'achieved', 'abandoned'] as const;

export const EQUIPMENT_CATEGORIES = [
  'free_weights',
  'machines',
  'cardio',
  'bodyweight',
  'accessories',
  'other',
] as const;

export const EXERCISE_CATEGORIES = [
  'chest',
  'back',
  'shoulders',
  'arms',
  'legs',
  'core',
  'full_body',
  'cardio',
  'mobility',
] as const;
export const EXERCISE_TRACKING = ['weight_reps', 'reps', 'duration', 'distance_duration'] as const;
export const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const;

export const TEMPLATE_TYPES = ['gym', 'running', 'home', 'abs', 'recovery', 'other'] as const;
/** Session types add `rest`: a planned rest day is a session, never an absence (AD-17). */
export const SESSION_TYPES = [...TEMPLATE_TYPES, 'rest'] as const;

export const INTERVAL_KINDS = ['warmup', 'run', 'walk', 'sprint', 'recovery', 'cooldown'] as const;

export const RULE_FREQUENCIES = ['daily', 'weekly', 'monthly', 'custom'] as const;
export const SESSION_STATUSES = [
  'planned',
  'in_progress',
  'completed',
  'modified',
  'skipped',
  'cancelled',
] as const;

export const EXECUTION_STATUSES = ['in_progress', 'completed', 'abandoned'] as const;
export const EXECUTION_OUTCOMES = ['as_planned', 'modified', 'partial'] as const;
export const SESSION_EXERCISE_STATUSES = ['pending', 'active', 'done', 'skipped'] as const;
export const SET_STATUSES = ['pending', 'done', 'skipped'] as const;
export const INTERVAL_LOG_STATUSES = ['pending', 'done', 'partial', 'skipped'] as const;

export const MEASUREMENT_KINDS = ['length', 'percent', 'other'] as const;
export const MEASUREMENT_UNITS = ['cm', 'in', 'percent', 'other'] as const;

export const EXERCISE_MEDIA_KINDS = ['image', 'gif', 'video'] as const;

export const NOTIFICATION_KINDS = [
  'session',
  'weight',
  'measurement',
  'photo',
  'weekly_summary',
  'rest_timer',
] as const;

export type TemplateType = (typeof TEMPLATE_TYPES)[number];
export type SessionType = (typeof SESSION_TYPES)[number];
export type SessionStatusValue = (typeof SESSION_STATUSES)[number];
export type IntervalKind = (typeof INTERVAL_KINDS)[number];
export type ExerciseTracking = (typeof EXERCISE_TRACKING)[number];
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];
