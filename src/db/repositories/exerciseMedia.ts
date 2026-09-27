import { type ExerciseMedia } from '@/types/domain';

import { type Database } from '../client';
import { tables } from '../mappers';

import { findMany, insertModel, patchModel, softDeleteModel, type NewModel } from './base';

const spec = tables.exerciseMedia;

/** Images, GIFs and video links per exercise. Files are handled by services/media. */
export function exerciseMediaRepo(db: Database) {
  return {
    list: (exerciseId: string): Promise<ExerciseMedia[]> =>
      findMany(
        db,
        spec,
        'deleted_at IS NULL AND exercise_id = ?',
        [exerciseId],
        'ORDER BY order_index, created_at',
      ),

    /** First image/GIF per exercise (library thumbnails): exerciseId → relative path. */
    async thumbnails(): Promise<Record<string, string>> {
      const rows = await findMany(
        db,
        spec,
        "deleted_at IS NULL AND kind IN ('image', 'gif')",
        [],
        'ORDER BY exercise_id, order_index, created_at',
      );
      const out: Record<string, string> = {};
      for (const r of rows) if (r.filePath && !out[r.exerciseId]) out[r.exerciseId] = r.filePath;
      return out;
    },

    async add(input: Omit<NewModel<typeof spec>, 'orderIndex'>): Promise<ExerciseMedia> {
      const last = await db.get<{ n: number | null }>(
        'SELECT MAX(order_index) AS n FROM exercise_media WHERE exercise_id = ? AND deleted_at IS NULL',
        [input.exerciseId],
      );
      return insertModel(db, spec, { ...input, orderIndex: (last?.n ?? -1) + 1 });
    },

    remove: (id: string) => softDeleteModel(db, spec, id),

    /** Makes one item first (its image becomes the thumbnail). */
    makeFirst: (exerciseId: string, id: string) =>
      db.tx(async (tx) => {
        const rows = await findMany(
          tx,
          spec,
          'deleted_at IS NULL AND exercise_id = ?',
          [exerciseId],
          'ORDER BY order_index',
        );
        const ordered = [...rows.filter((r) => r.id === id), ...rows.filter((r) => r.id !== id)];
        for (const [i, r] of ordered.entries()) await patchModel(tx, spec, r.id, { orderIndex: i });
      }),
  };
}
