/**
 * Bridge so routes and components reach the database through the hooks layer
 * (UI code may not import @/db directly, FS §49).
 */
import { Platform } from 'react-native';

import { type Database } from '@/db/client';

export {
  DatabaseProvider,
  useDatabase,
  useDatabaseStatus,
  type DatabaseStatus,
} from '@/db/DatabaseProvider';
export { DATABASE_NAME } from '@/db/DatabaseProvider';
export { inspectDatabase, resetDatabase, type DbInfo } from '@/db/devTools';

/** Dev only (step 28): large demo dataset + placeholder photo files (1×1 JPEG). */
export async function loadDemoDataset(db: Database) {
  const { loadDemoData } = await import('@/db/demoData');
  const counts = await loadDemoData(db);
  if (Platform.OS !== 'web') {
    const { File, Paths } = await import('expo-file-system');
    const jpeg = Uint8Array.from(atob(TINY_JPEG), (c) => c.charCodeAt(0));
    const rows = await db.all<{ file_path: string; thumb_path: string }>(
      "SELECT file_path, thumb_path FROM progress_photos WHERE file_path LIKE 'photos/demo/%'",
    );
    for (const r of rows) {
      for (const rel of [r.file_path, r.thumb_path]) {
        const f = new File(Paths.document, 'vyro-private', rel);
        if (!f.parentDirectory.exists) f.parentDirectory.create({ intermediates: true });
        if (!f.exists) f.write(jpeg);
      }
    }
  }
  return counts;
}

/** Dev only: data matching docs/template/template.png (UI phase side-by-side). */
export async function loadTemplateScenarioData(db: Database) {
  const { loadTemplateScenario } = await import('@/db/demoData');
  await loadTemplateScenario(db);
}

const TINY_JPEG =
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
