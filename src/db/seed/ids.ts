/**
 * Stable ids for seeded rows. They make re-seeding idempotent (INSERT OR IGNORE)
 * even after the user renames a row, and keep ids identical across devices for future sync.
 */
export const seedId = {
  equipment: (slug: string) => `seed-eq-${slug}`,
  exercise: (slug: string) => `seed-ex-${slug}`,
  measurementType: (slug: string) => `seed-mt-${slug}`,
  template: (key: string) => `seed-tpl-${key}`,
  templateExercise: (key: string, i: number) => `seed-te-${key}-${i}`,
  templateInterval: (key: string, i: number) => `seed-ti-${key}-${i}`,
};

/** i18n key suffix of a seeded row, or null for user-created rows. */
export function seedKey(id: string): string | null {
  const m = /^seed-(?:eq|ex|mt|tpl)-(.+)$/.exec(id);
  return m?.[1] ?? null;
}
