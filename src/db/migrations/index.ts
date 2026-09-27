import { m001_initial } from './m001_initial';
import { m002_history_indexes } from './m002_history_indexes';
import { m003_exercise_media } from './m003_exercise_media';
import { m004_custom_media } from './m004_custom_media';
import { m005_ai } from './m005_ai';
import { type Migration } from './types';

/** Ordered, append-only list. Run `pnpm db:lock` after adding a migration. */
export const migrations: readonly Migration[] = [
  m001_initial,
  m002_history_indexes,
  m003_exercise_media,
  m004_custom_media,
  m005_ai,
];

export type { Migration } from './types';
