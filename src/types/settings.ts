/**
 * Typed registry of app_settings keys (step 10). Each key has a Zod schema and a default;
 * values are stored as JSON. Add keys here as features need them.
 */
import { z } from 'zod';

import { onboardingDraftSchema } from './onboarding';

const ACCENTS = ['lime', 'blue', 'purple', 'orange', 'red', 'teal'] as const;
const TIME = z.string().regex(/^\d{2}:\d{2}$/);

export const settingsRegistry = {
  theme: { schema: z.enum(['system', 'dark', 'light']), default: 'dark' },
  accent: { schema: z.enum(ACCENTS), default: 'lime' },
  language: { schema: z.enum(['system', 'en', 'fr']), default: 'system' },
  haptics: { schema: z.boolean(), default: true },
  'training.defaultRestSeconds': { schema: z.number().int().min(0).max(900), default: 90 },
  'training.weightIncrementKg': { schema: z.number().positive(), default: 2.5 },
  'training.autoStartRest': { schema: z.boolean(), default: true },
  'training.keepAwake': { schema: z.boolean(), default: true },
  'training.countdownBeeps': { schema: z.boolean(), default: true },
  'training.voiceCues': { schema: z.boolean(), default: false },
  'notifications.enabled': { schema: z.boolean(), default: false },
  // Per-category reminders (step 25). Times are local "HH:mm".
  'notifications.sessions': { schema: z.boolean(), default: true },
  'notifications.sessionOffset': { schema: z.number().int().min(0).max(240), default: 15 },
  'notifications.running': { schema: z.boolean(), default: true },
  'notifications.nudge': { schema: z.boolean(), default: true },
  'notifications.nudgeTime': { schema: TIME, default: '09:00' },
  'notifications.missed': { schema: z.boolean(), default: true },
  'notifications.weight': { schema: z.boolean(), default: false },
  'notifications.weightTime': { schema: TIME, default: '07:30' },
  'notifications.weightDays': {
    schema: z.array(z.number().int().min(0).max(6)),
    default: [0, 1, 2, 3, 4, 5, 6] as number[],
  },
  'notifications.measurement': { schema: z.boolean(), default: true },
  'notifications.measurementDay': { schema: z.number().int().min(0).max(6), default: 0 },
  'notifications.measurementTime': { schema: TIME, default: '07:30' },
  'notifications.photo': { schema: z.boolean(), default: false },
  'notifications.photoTime': { schema: TIME, default: '08:00' },
  /** First day of the 2-week photo cycle (set when the reminder is enabled). */
  'notifications.photoAnchor': { schema: z.string().nullable(), default: null },
  'notifications.weekly': { schema: z.boolean(), default: false },
  /** Monthly backup reminder (step 27). */
  'notifications.backup': { schema: z.boolean(), default: false },
  'backup.lastAt': { schema: z.string().nullable(), default: null },
  'notifications.quietStart': { schema: TIME, default: '22:00' },
  'notifications.quietEnd': { schema: TIME, default: '07:00' },
  /** Per-activity tile overrides (Settings → Activities): colour (hex) and icon name. */
  'activity.styles': {
    schema: z.record(
      z.string(),
      z.object({ color: z.string().nullable(), icon: z.string().nullable() }),
    ),
    default: {} as Record<string, { color: string | null; icon: string | null }>,
  },
  /** App lock (step 26). Only effective once a PIN exists (see services/security/lock). */
  'lock.enabled': { schema: z.boolean(), default: false },
  'lock.method': { schema: z.enum(['biometric', 'pin']), default: 'biometric' },
  /** Auto-lock after this many seconds in the background (0 = immediately). */
  'lock.timeout': { schema: z.number().int().min(0).max(3600), default: 60 },
  'lock.scope': { schema: z.enum(['app', 'photos']), default: 'app' },
  'lock.hidePreviews': { schema: z.boolean(), default: true },
  /** During an active workout the timeout extends to 15 min. */
  'lock.extendDuringWorkout': { schema: z.boolean(), default: true },
  /** Block screenshots app-wide (photo screens always block them). */
  'privacy.blockScreenshots': { schema: z.boolean(), default: false },
  /** AI (step 31): master switch, off by default. Keys live in SecureStore, never here. */
  'ai.enabled': { schema: z.boolean(), default: false },
  'ai.provider': { schema: z.enum(['gemini', 'openai', 'anthropic']), default: 'gemini' },
  /** Model override per provider (empty = the provider's documented default). */
  'ai.models': { schema: z.record(z.string(), z.string()), default: {} },
  'ai.tone': { schema: z.enum(['concise', 'detailed']), default: 'concise' },
  'ai.includeNotes': { schema: z.boolean(), default: false },
  /** Consent date per provider (opt-in is per provider). */
  'ai.consent': { schema: z.record(z.string(), z.string()), default: {} },
  /** "Don't show again" for the payload preview, per request type. */
  'ai.skipPreview': { schema: z.record(z.string(), z.boolean()), default: {} },
  /** Profile picture: private relative path (phone) or data URI (web preview). */
  'profile.avatar': { schema: z.string().nullable(), default: null },
  /** In-progress onboarding answers; null when not started or finished. */
  'onboarding.draft': { schema: onboardingDraftSchema.nullable(), default: null },
  seed_version: { schema: z.number().int().nonnegative(), default: 0 },
} as const satisfies Record<string, { schema: z.ZodType; default: unknown }>;

export type SettingKey = keyof typeof settingsRegistry;
export type SettingValue<K extends SettingKey> = z.infer<(typeof settingsRegistry)[K]['schema']>;
export type Settings = { [K in SettingKey]: SettingValue<K> };

export const defaultSettings = Object.fromEntries(
  Object.entries(settingsRegistry).map(([k, v]) => [k, v.default]),
) as Settings;
