import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { Platform } from 'react-native';

import { type Database } from '@/db/client';
import { PHOTO_ROOT, isRelative } from '@/services/photos/paths';
import { downloadOnWeb } from '@/services/webDownload';

import { buildBackup } from './export';
import { type Backup } from './format';

const FILES_PREFIX = 'files/';
const privateFile = (rel: string) => new File(Paths.document, PHOTO_ROOT, rel);

/** Rough size before exporting: rows × ~250 B, plus photo bytes when included. */
export function estimateBytes(
  counts: Record<string, number>,
  photoBytes: number,
  includesPhotos: boolean,
) {
  const rows = Object.values(counts).reduce((a, b) => a + b, 0);
  return rows * 250 + (includesPhotos ? photoBytes : 0);
}

/** Builds the file in the cache dir, opens the share sheet, then deletes the temp file. */
export async function exportAndShare(
  db: Database,
  opts: { appVersion: string; includesPhotos: boolean },
): Promise<Backup> {
  const backup = await buildBackup(db, opts);
  const day = backup.exportedAt.slice(0, 10);
  const json = JSON.stringify(backup);
  // Web preview: no file system, so the browser downloads the data (rows only; photo files
  // live in IndexedDB there and aren't part of a web backup).
  if (Platform.OS === 'web') {
    downloadOnWeb(`vyro-backup-${day}.json`, json, 'application/json');
    return backup;
  }
  let file: File;
  if (opts.includesPhotos) {
    const entries: Record<string, Uint8Array> = { 'data.json': strToU8(json) };
    const media = backup.data.exercise_media.flatMap((m) =>
      m.file_path ? [String(m.file_path)] : [],
    );
    const equipmentImages = backup.data.equipment.flatMap((e) =>
      e.image_path ? [String(e.image_path)] : [],
    );
    const photoFiles = backup.data.progress_photos.flatMap((p) => [
      String(p.file_path),
      String(p.thumb_path),
    ]);
    // Photos, thumbnails, exercise images/GIFs and equipment pictures, all from private storage.
    for (const rel of [...photoFiles, ...media, ...equipmentImages]) {
      const f = privateFile(rel);
      if (isRelative(rel) && f.exists) entries[FILES_PREFIX + rel] = await f.bytes();
    }
    file = new File(Paths.cache, `vyro-backup-${day}.zip`);
    if (file.exists) file.delete();
    file.write(zipSync(entries, { level: 0 }));
  } else {
    file = new File(Paths.cache, `vyro-backup-${day}.json`);
    if (file.exists) file.delete();
    file.write(json);
  }
  try {
    await Sharing.shareAsync(file.uri, {
      mimeType: opts.includesPhotos ? 'application/zip' : 'application/json',
    });
  } finally {
    if (file.exists) file.delete();
  }
  return backup;
}

export type ImportFile = { text: string; photos: Record<string, Uint8Array> };

/** Reads a picked .json or .zip (data.json + files/…). */
export async function readImportFile(uri: string, name: string): Promise<ImportFile> {
  // Web: the picker gives a blob:/data: URL, read with fetch (no expo-file-system there).
  const web = Platform.OS === 'web';
  const bytes = async () =>
    web ? new Uint8Array(await (await fetch(uri)).arrayBuffer()) : new File(uri).bytes();
  if (name.toLowerCase().endsWith('.zip')) {
    const entries = unzipSync(await bytes());
    const data = entries['data.json'];
    if (!data) throw new Error('data.json missing');
    const photos: Record<string, Uint8Array> = {};
    for (const [k, v] of Object.entries(entries)) {
      const rel = k.startsWith(FILES_PREFIX) ? k.slice(FILES_PREFIX.length) : null;
      // Photo files can only be restored where the private file system exists.
      if (rel && isRelative(rel) && !web) photos[rel] = v;
    }
    return { text: strFromU8(data), photos };
  }
  return { text: web ? await (await fetch(uri)).text() : await new File(uri).text(), photos: {} };
}

/** Writes photo files to private storage first; returns a rollback that removes them. */
export function writePhotoFiles(photos: Record<string, Uint8Array>): () => void {
  const written: File[] = [];
  try {
    for (const [rel, bytes] of Object.entries(photos)) {
      const f = privateFile(rel);
      if (!f.parentDirectory.exists) f.parentDirectory.create({ intermediates: true });
      if (f.exists) continue; // already on this device
      f.write(bytes);
      written.push(f);
    }
  } catch (error) {
    written.forEach((f) => f.exists && f.delete());
    throw error;
  }
  return () => written.forEach((f) => f.exists && f.delete());
}
