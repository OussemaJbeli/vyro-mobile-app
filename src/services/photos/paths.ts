/** Private photo layout (AD-13): only these relative paths are stored in the database. */
export const PHOTO_ROOT = 'vyro-private';
export const PURGE_AFTER_DAYS = 7;

export const photoPath = (category: string, capturedAt: Date, id: string) =>
  `photos/${category}/${capturedAt.getFullYear()}/${id}.jpg`;
export const thumbPath = (id: string) => `thumbs/${id}.jpg`;

export function isRelative(p: string): boolean {
  return p.length > 0 && !p.startsWith('/') && !p.includes('://') && !p.split('/').includes('..');
}

/** Relative → absolute URI under the private root (the root differs per install). */
export function resolvePath(rootUri: string, relative: string): string {
  if (!isRelative(relative)) throw new Error(`Not a private relative path: ${relative}`);
  return `${rootUri.replace(/\/+$/, '')}/${PHOTO_ROOT}/${relative}`;
}

/** Soft-deleted photos whose 7-day "Recently deleted" window is over. */
export function purgeable<T extends { deletedAt: string | null }>(
  photos: readonly T[],
  now: number,
): T[] {
  const limit = now - PURGE_AFTER_DAYS * 86_400_000;
  return photos.filter((p) => p.deletedAt !== null && Date.parse(p.deletedAt) <= limit);
}

export type CategoryNode = { slug: string; children: string[] };

/** Flat seeded categories → Body/Hair/Beard with their sub-categories, in order. */
export function categoryTree(
  rows: readonly { slug: string; parentSlug: string | null; orderIndex: number }[],
): CategoryNode[] {
  const byOrder = [...rows].sort((a, b) => a.orderIndex - b.orderIndex);
  return byOrder
    .filter((r) => r.parentSlug === null)
    .map((r) => ({
      slug: r.slug,
      children: byOrder.filter((c) => c.parentSlug === r.slug).map((c) => c.slug),
    }));
}
