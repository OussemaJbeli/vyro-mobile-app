import { type PhotoCategory, type ProgressPhoto } from '@/types/domain';

import { type Database } from '../client';
import { tables } from '../mappers';

import {
  findById,
  findMany,
  insertModel,
  pageByTime,
  patchModel,
  softDeleteModel,
  type NewModel,
  type Page,
} from './base';

const spec = tables.progressPhotos;

/** Photo metadata only. Private files are handled by the photo service (step 23). */
export function photoRepo(db: Database) {
  return {
    /** User-created group (e.g. "Arms"): a top-level category with its own name. */
    createGroup: async (name: string): Promise<PhotoCategory> => {
      const next = await db.get<{ n: number | null }>(
        'SELECT MAX(order_index) AS n FROM photo_categories WHERE parent_slug IS NULL',
      );
      const row = {
        slug: `group-${Date.now().toString(36)}`,
        parentSlug: null,
        orderIndex: (next?.n ?? 0) + 1,
        name,
      };
      await db.run(
        'INSERT INTO photo_categories (slug, parent_slug, order_index, name) VALUES (?, ?, ?, ?)',
        [row.slug, null, row.orderIndex, name],
      );
      return row;
    },
    renameGroup: (slug: string, name: string) =>
      db.run('UPDATE photo_categories SET name = ? WHERE slug = ?', [name, slug]),
    categories: (): Promise<PhotoCategory[]> =>
      findMany(db, tables.photoCategories, '', [], 'ORDER BY parent_slug IS NOT NULL, order_index'),
    list: (
      category: string,
      cursor: string | null = null,
      limit = 60,
    ): Promise<Page<ProgressPhoto>> =>
      pageByTime(
        db,
        spec,
        'captured_at',
        'deleted_at IS NULL AND category = ?',
        [category],
        cursor,
        limit,
      ),
    get: (id: string) => findById(db, spec, id),
    create: (input: NewModel<typeof spec>, opts: { id?: string } = {}) =>
      insertModel(db, spec, input, opts),
    /** Every active photo, newest first (gallery grids, comparison pickers). */
    all: (): Promise<ProgressPhoto[]> =>
      findMany(db, spec, 'deleted_at IS NULL', [], 'ORDER BY captured_at DESC'),
    /** Latest active photo of a sub-category (ghost overlay). */
    latestIn: async (subCategory: string): Promise<ProgressPhoto | null> =>
      (
        await findMany(
          db,
          spec,
          'deleted_at IS NULL AND sub_category = ?',
          [subCategory],
          'ORDER BY captured_at DESC LIMIT 1',
        )
      )[0] ?? null,
    /** "Recently deleted" → back to the gallery. */
    restore: (id: string) =>
      patchModel(db, spec, id, { deletedAt: null }, { includeDeleted: true }),
    /** After the 7-day window, once the files are gone. */
    purge: async (id: string) => {
      await db.run('DELETE FROM progress_photos WHERE id = ? AND deleted_at IS NOT NULL', [id]);
    },
    updateNotes: (id: string, notes: string | null) => patchModel(db, spec, id, { notes }),
    softDelete: (id: string) => softDeleteModel(db, spec, id),
    /** Soft-deleted photos, for "Recently deleted" and the purge job (step 23). */
    deleted: (): Promise<ProgressPhoto[]> =>
      findMany(db, spec, 'deleted_at IS NOT NULL', [], 'ORDER BY deleted_at DESC'),
  };
}
