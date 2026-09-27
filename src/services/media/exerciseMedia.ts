import { deleteStoredImage, pickStoredImage, storedImageUri } from './storedImage';

/** Exercise images/GIFs live in private storage like photos (AD-13); data URIs on web. */
export const mediaSupported = true;

export const mediaUri = storedImageUri;

/** Picks an image or GIF (GIFs keep their animation). Returns null when cancelled. */
export async function pickExerciseMedia(): Promise<{
  kind: 'image' | 'gif';
  filePath: string;
} | null> {
  const picked = await pickStoredImage({
    folder: 'media/exercises',
    maxEdge: 1200,
    allowGif: true,
  });
  return picked ? { kind: picked.kind, filePath: picked.ref } : null;
}

export const deleteMediaFile = (relative: string) => deleteStoredImage(relative);

/** Equipment picture (PNG keeps transparency). */
export async function pickEquipmentImage(): Promise<string | null> {
  const picked = await pickStoredImage({ folder: 'media/equipment', maxEdge: 512, aspect: [1, 1] });
  return picked?.ref ?? null;
}
