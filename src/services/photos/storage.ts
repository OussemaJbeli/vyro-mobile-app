import { type ProgressPhoto } from '@/types/domain';
import { newId } from '@/utils/id';
import { logger } from '@/utils/logger';

import { photoPath, purgeable, thumbPath } from './paths';

/** File operations on paths relative to the private root (mockable in tests). */
export type PhotoFs = {
  /** Resize/re-encode `sourceUri` into `relative` (re-encoding strips EXIF/GPS). */
  writeImage: (
    sourceUri: string,
    relative: string,
    maxEdge: number,
    quality: number,
  ) => Promise<{ width: number; height: number; bytes: number | null }>;
  remove: (relative: string) => Promise<void>;
  exists: (relative: string) => boolean;
  /** Every file under photos/ and thumbs/ (relative). */
  listFiles: () => string[];
};

export type PhotoRepoLike = {
  create: (
    input: Omit<ProgressPhoto, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>,
    opts?: { id?: string },
  ) => Promise<ProgressPhoto>;
  softDelete: (id: string) => Promise<void>;
  deleted: () => Promise<ProgressPhoto[]>;
  purge: (id: string) => Promise<void>;
  all: () => Promise<ProgressPhoto[]>;
};

export type SaveMeta = {
  category: string;
  subCategory: string | null;
  capturedAt?: Date;
  weightEntryId?: string | null;
  notes?: string | null;
};

export const ORIGINAL_EDGE = 2048;
export const THUMB_EDGE = 320;

/**
 * Private photo storage (step 23, FS §28): files first, then the row. A failed insert
 * removes the files, so nothing is orphaned. Photos never touch the gallery/MediaStore.
 */
export function createPhotoStore(fs: PhotoFs, repo: PhotoRepoLike, now: () => number = Date.now) {
  return {
    async savePhoto(tempUri: string, meta: SaveMeta): Promise<ProgressPhoto> {
      const id = newId();
      const capturedAt = meta.capturedAt ?? new Date(now());
      const file = photoPath(meta.category, capturedAt, id);
      const thumb = thumbPath(id);
      const written: string[] = [];
      try {
        const original = await fs.writeImage(tempUri, file, ORIGINAL_EDGE, 0.85);
        written.push(file);
        await fs.writeImage(tempUri, thumb, THUMB_EDGE, 0.7);
        written.push(thumb);
        return await repo.create(
          {
            category: meta.category,
            subCategory: meta.subCategory,
            filePath: file,
            thumbPath: thumb,
            width: original.width,
            height: original.height,
            bytes: original.bytes,
            capturedAt: capturedAt.toISOString(),
            weightEntryId: meta.weightEntryId ?? null,
            notes: meta.notes ?? null,
          },
          { id },
        );
      } catch (error) {
        await Promise.all(written.map((p) => fs.remove(p).catch(() => {})));
        throw error;
      }
    },

    /** Soft delete: hidden now, restorable for 7 days, purged from disk afterwards. */
    deletePhoto: (id: string) => repo.softDelete(id),

    /** Startup: remove files (and rows) of photos deleted more than 7 days ago. */
    async purgeExpired(): Promise<number> {
      const expired = purgeable(await repo.deleted(), now());
      for (const p of expired) {
        await fs.remove(p.filePath).catch(() => {});
        await fs.remove(p.thumbPath).catch(() => {});
        await repo.purge(p.id);
      }
      return expired.length;
    },

    /** Privacy settings: "Clear recently deleted photos now" (skips the 7-day window). */
    async purgeAllDeleted(): Promise<number> {
      const all = await repo.deleted();
      for (const p of all) {
        await fs.remove(p.filePath).catch(() => {});
        await fs.remove(p.thumbPath).catch(() => {});
        await repo.purge(p.id);
      }
      return all.length;
    },

    /** Dev report only: files without rows and rows without files. Never deletes rows. */
    async sweepOrphans(): Promise<{ filesWithoutRows: string[]; rowsWithoutFiles: string[] }> {
      const rows = [...(await repo.all()), ...(await repo.deleted())];
      const known = new Set(rows.flatMap((r) => [r.filePath, r.thumbPath]));
      const filesWithoutRows = fs.listFiles().filter((f) => !known.has(f));
      const rowsWithoutFiles = rows.filter((r) => !fs.exists(r.filePath)).map((r) => r.id);
      if (filesWithoutRows.length || rowsWithoutFiles.length) {
        logger.warn('Photo orphans', {
          files: filesWithoutRows.length,
          rows: rowsWithoutFiles.length,
        });
      }
      return { filesWithoutRows, rowsWithoutFiles };
    },
  };
}

export type PhotoStore = ReturnType<typeof createPhotoStore>;
