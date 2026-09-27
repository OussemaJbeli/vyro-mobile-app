import { useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';

import { makeNamedSafetyCopy } from '@/db/safetyCopy';
import { settingsRepo } from '@/db/repositories/settings';
import { exportAndShare, readImportFile, writePhotoFiles } from '@/services/backup/files';
import { TABLES, type Backup } from '@/services/backup/format';
import { applyBackup, type ImportResult } from '@/services/backup/import';
import { readBackup } from '@/services/backup/validate';
import { useSettingsStore } from '@/store/settingsStore';

import { useDatabase } from './database';

export type PreparedImport = { backup: Backup; photos: Record<string, Uint8Array> };

/** Backup/export/import actions bound to the app database (step 27). */
export function useBackup() {
  const db = useDatabase();
  const client = useQueryClient();
  const appVersion = Constants.expoConfig?.version ?? '0.0.0';

  return {
    /** Row counts and photo bytes, for the size estimate. */
    async stats(): Promise<{ counts: Record<string, number>; photoBytes: number }> {
      const counts: Record<string, number> = {};
      for (const table of TABLES) {
        counts[table] = (await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM ' + table))?.n ?? 0;
      }
      const bytes = await db.get<{ b: number | null }>(
        'SELECT SUM(bytes) AS b FROM progress_photos WHERE deleted_at IS NULL',
      );
      return { counts, photoBytes: bytes?.b ?? 0 };
    },

    async exportBackup(includesPhotos: boolean) {
      const b = await exportAndShare(db, { appVersion, includesPhotos });
      await useSettingsStore.getState().set('backup.lastAt', b.exportedAt);
      return b;
    },

    /** Parse + validate only (no writes). Throws BackupError with a specific code. */
    async prepareImport(
      uri: string,
      name: string,
      strategy: 'merge' | 'replace',
    ): Promise<PreparedImport> {
      const file = await readImportFile(uri, name);
      return { backup: await readBackup(file.text, db, { strategy }), photos: file.photos };
    },

    /** Safety copy → photo files → one DB transaction; files are removed if the DB step fails. */
    async runImport(
      p: PreparedImport,
      strategy: 'merge' | 'replace',
      onProgress?: (done: number, total: number) => void,
    ): Promise<ImportResult> {
      await makeNamedSafetyCopy(db, 'pre-import');
      const rollback = writePhotoFiles(p.photos);
      try {
        const result = await applyBackup(db, p.backup, strategy, onProgress);
        useSettingsStore.getState().hydrate(await settingsRepo(db).getAll());
        await client.invalidateQueries();
        return result;
      } catch (error) {
        rollback();
        throw error;
      }
    },
  };
}
