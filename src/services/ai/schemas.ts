import { z } from 'zod';

/** Structured output of every analysis method (step 31, FS §42). */
export const SUGGESTION_KINDS = [
  'move_session',
  'replace_exercise',
  'adjust_template',
  'add_rest',
  'info',
] as const;

export const suggestionSchema = z.object({
  kind: z.enum(SUGGESTION_KINDS),
  /** JSON string: its shape depends on `kind` (validated again locally before applying). */
  payload: z.string(),
  rationale: z.string(),
});

export const insightSchema = z.object({
  title: z.string().min(1),
  summary: z.string(),
  bullets: z.array(z.string()),
  suggestions: z.array(suggestionSchema),
  confidence: z.enum(['low', 'medium', 'high']),
  disclaimers: z.array(z.string()),
});

export type Suggestion = z.infer<typeof suggestionSchema>;
export type Insight = z.infer<typeof insightSchema>;

/**
 * The same shape as JSON Schema for the providers' structured-output modes. Kept flat and
 * within the common subset: every object `additionalProperties: false`, all fields required,
 * no numeric/string constraints.
 */
export const INSIGHT_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'summary', 'bullets', 'suggestions', 'confidence', 'disclaimers'],
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    bullets: { type: 'array', items: { type: 'string' } },
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'payload', 'rationale'],
        properties: {
          kind: { type: 'string', enum: [...SUGGESTION_KINDS] },
          payload: { type: 'string' },
          rationale: { type: 'string' },
        },
      },
    },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    disclaimers: { type: 'array', items: { type: 'string' } },
  },
};

/** Suggestion payloads the app knows how to apply (validated before anything changes). */
export const moveSessionPayload = z.object({
  sessionId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .optional(),
});
export const addRestPayload = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });
export const replaceExercisePayload = z.object({
  templateId: z.string(),
  fromExerciseId: z.string(),
  toExerciseId: z.string(),
});
