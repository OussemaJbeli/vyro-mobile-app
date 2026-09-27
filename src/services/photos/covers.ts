import { pickStoredImage, deleteStoredImage, storedImageUri } from '@/services/media/storedImage';

/** Private app storage (AD-13) on the phone; a data URI in the row on the web preview. */
const PHOTO_PREFIX = 'photo:';

/** Covers can be picked everywhere (the web preview stores a resized copy in the row). */
export const canPickCoverPhoto = true;

/** "photo:covers/<id>.jpg" (or "photo:data:…") → displayable URI; null for bundled covers. */
export function coverPhotoUri(coverKey: string | null | undefined): string | null {
  if (!coverKey?.startsWith(PHOTO_PREFIX)) return null;
  return storedImageUri(coverKey.slice(PHOTO_PREFIX.length));
}

/**
 * Lets the user pick a library photo (cropped 3:2 like the Start hero) and keeps a private
 * copy (the original in the gallery is untouched). Returns the cover key, or null.
 */
export async function pickCoverPhoto(): Promise<string | null> {
  const picked = await pickStoredImage({ folder: 'covers', maxEdge: 1200, aspect: [3, 2] });
  return picked ? PHOTO_PREFIX + picked.ref : null;
}

/** Removes a previously copied cover photo (best effort). */
export function deleteCoverPhoto(coverKey: string | null | undefined) {
  if (coverKey?.startsWith(PHOTO_PREFIX)) deleteStoredImage(coverKey.slice(PHOTO_PREFIX.length));
}
