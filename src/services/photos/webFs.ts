import { toDataUri } from '@/services/media/storedImage';

import { type PhotoFs } from './storage';

/**
 * Web preview photo storage: re-encoded JPEG data URIs in IndexedDB (browser-private),
 * mirrored in memory so `photoUri` stays synchronous. Loaded once at startup.
 */
const DB = 'vyro-photos';
const STORE = 'files';
const cache = new Map<string, string>();

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
  });
}

async function run(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest | void) {
  const db = await open();
  return new Promise<unknown>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'));
  });
}

/** Loads every stored photo into memory (call before showing photos). */
export async function hydrateWebPhotos(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return resolve();
      cache.set(String(cursor.key), String(cursor.value));
      cursor.continue();
    };
    req.onerror = () => reject(req.error ?? new Error('IndexedDB read failed'));
  });
}

export const webPhotoUri = (relative: string) => cache.get(relative) ?? '';

export const webPhotoFs: PhotoFs = {
  async writeImage(sourceUri, relative, maxEdge, quality) {
    const data = await toDataUri(sourceUri, { maxEdge, quality });
    await run('readwrite', (s) => s.put(data, relative));
    cache.set(relative, data);
    // Size of the decoded bytes; dimensions are not needed by the web preview.
    return { width: maxEdge, height: maxEdge, bytes: Math.round((data.length * 3) / 4) };
  },
  async remove(relative) {
    cache.delete(relative);
    await run('readwrite', (s) => s.delete(relative));
  },
  exists: (relative) => cache.has(relative),
  listFiles: () => [...cache.keys()],
};
