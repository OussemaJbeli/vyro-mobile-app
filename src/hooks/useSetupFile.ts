import { useQueryClient } from '@tanstack/react-query';

import { makeNamedSafetyCopy } from '@/db/safetyCopy';
import { settingsRepo } from '@/db/repositories/settings';
import { exportSetup, importSetup } from '@/db/setup';
import { readSetupFile, shareSetupFile } from '@/services/setup/files';
import { parseSetup, type SetupFile } from '@/services/setup/format';
import { useSettingsStore } from '@/store/settingsStore';
import { today } from '@/utils/dates';

import { useDatabase } from './database';

/** Setup file (profile, goals, equipment, exercises, workouts, cycle) export/import. */
export function useSetupFile() {
  const db = useDatabase();
  const client = useQueryClient();
  return {
    async exportFile() {
      const file = await exportSetup(db);
      await shareSetupFile(JSON.stringify(file, null, 2), today());
    },
    /** Validates only: throws SetupError with the field that's wrong. */
    async read(uri: string): Promise<SetupFile> {
      return parseSetup(await readSetupFile(uri));
    },
    async apply(file: SetupFile) {
      await makeNamedSafetyCopy(db, 'pre-setup-import').catch(() => {});
      const result = await importSetup(db, file, today());
      useSettingsStore.getState().hydrate(await settingsRepo(db).getAll());
      await client.invalidateQueries();
      return result;
    },
  };
}
