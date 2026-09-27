/**
 * A migration is plain SQL (FS §50): deterministic, reviewable, checksummed.
 * Append-only: once released, never edit a migration; add a new one.
 */
export type Migration = {
  id: number;
  name: string;
  statements: readonly string[];
};
