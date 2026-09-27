import { sha256 } from '@noble/hashes/sha2.js';

/** Backup file format (step 27, FS §59). Raw rows per table, parents before children. */
export const BACKUP_FORMAT = 'vyro-backup';
export const FORMAT_VERSION = 1;

export const TABLES = [
  'user_profile',
  'app_settings',
  'measurement_types',
  'goals',
  'equipment',
  'exercises',
  'exercise_equipment',
  'exercise_alternatives',
  'exercise_media',
  'workout_templates',
  'workout_template_exercises',
  'template_running_intervals',
  'schedule_rules',
  'scheduled_sessions',
  'session_executions',
  'session_exercises',
  'exercise_sets',
  'running_interval_logs',
  'weight_entries',
  'body_measurements',
  'photo_categories',
  'progress_photos',
] as const;
export type TableName = (typeof TABLES)[number];

/** Never exported: in-progress onboarding answers (lock secrets and OS ids are not in these tables). */
export const EXCLUDED_SETTINGS = ['onboarding.draft'];

export type Row = Record<string, string | number | null>;

export type Backup = {
  format: typeof BACKUP_FORMAT;
  formatVersion: number;
  appVersion: string;
  schemaVersion: number;
  exportedAt: string;
  includesPhotos: boolean;
  counts: Record<string, number>;
  data: Record<TableName, Row[]>;
  checksum: string;
};

/** Stable JSON (sorted keys) so the checksum doesn't depend on key order. */
export function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .sort()
    .filter((k) => obj[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`)
    .join(',')}}`;
}

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

export const checksumOf = (data: unknown) =>
  `sha256:${hex(sha256(new TextEncoder().encode(canonical(data))))}`;

export class BackupError extends Error {
  constructor(
    readonly code:
      'NOT_BACKUP' | 'NEWER_VERSION' | 'CHECKSUM' | 'INVALID_ROW' | 'FOREIGN_KEY' | 'PARSE',
    readonly detail?: string,
  ) {
    super(`${code}${detail ? `: ${detail}` : ''}`);
  }
}
