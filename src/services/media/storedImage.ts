import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { PHOTO_ROOT, resolvePath } from '@/services/photos/paths';
import { newId } from '@/utils/id';

/**
 * Pictures the user picks (covers, avatar, equipment, exercise media). On the phone the
 * file is copied into private storage and a relative path is stored; the web preview has
 * no file system, so a resized `data:` URI is stored in the row instead.
 */
export const isWeb = Platform.OS === 'web';

/** Stored reference → displayable URI. */
export function storedImageUri(ref: string): string {
  return ref.startsWith('data:') ? ref : resolvePath(Paths.document.uri, ref);
}

/** Resize + re-encode to a data URI (web). */
export async function toDataUri(
  uri: string,
  { maxEdge, png = false, quality = 0.8 }: { maxEdge: number; png?: boolean; quality?: number },
): Promise<string> {
  const probe = await ImageManipulator.manipulate(uri).renderAsync();
  const ctx = ImageManipulator.manipulate(uri);
  if (Math.max(probe.width, probe.height) > maxEdge) {
    ctx.resize(probe.width >= probe.height ? { width: maxEdge } : { height: maxEdge });
  }
  const out = await (
    await ctx.renderAsync()
  ).saveAsync({
    base64: true,
    compress: quality,
    format: png ? SaveFormat.PNG : SaveFormat.JPEG,
  });
  return `data:image/${png ? 'png' : 'jpeg'};base64,${out.base64 ?? ''}`;
}

export type PickOptions = {
  /** Private folder on the phone, e.g. 'media/avatar'. */
  folder: string;
  /** Longest edge on the web (the phone keeps the picked file). */
  maxEdge: number;
  aspect?: [number, number];
  /** GIFs must not be cropped or re-encoded (they would stop animating). */
  allowGif?: boolean;
};

export type PickedImage = { ref: string; kind: 'image' | 'gif' };

/** Library picker → stored reference, or null when cancelled. */
export async function pickStoredImage({
  folder,
  maxEdge,
  aspect,
  allowGif = false,
}: PickOptions): Promise<PickedImage | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: !!aspect && !allowGif,
    ...(aspect ? { aspect } : {}),
    quality: 0.85,
    base64: isWeb && allowGif,
  });
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;
  const name = (asset.fileName ?? asset.uri).toLowerCase();
  const gif = allowGif && (asset.mimeType === 'image/gif' || name.endsWith('.gif'));
  const png = asset.mimeType === 'image/png' || name.endsWith('.png');

  if (isWeb) {
    if (gif && asset.base64) return { ref: `data:image/gif;base64,${asset.base64}`, kind: 'gif' };
    return { ref: await toDataUri(asset.uri, { maxEdge, png }), kind: 'image' };
  }
  const dir = new Directory(Paths.document, PHOTO_ROOT, ...folder.split('/'));
  if (!dir.exists) dir.create({ intermediates: true });
  const ref = `${folder}/${newId()}.${gif ? 'gif' : png ? 'png' : 'jpg'}`;
  new File(asset.uri).copy(new File(Paths.document, PHOTO_ROOT, ref));
  return { ref, kind: gif ? 'gif' : 'image' };
}

/** Deletes a stored picture (best effort; data URIs live in the row itself). */
export function deleteStoredImage(ref: string | null | undefined) {
  if (!ref || ref.startsWith('data:') || isWeb) return;
  try {
    const f = new File(Paths.document, PHOTO_ROOT, ref);
    if (f.exists) f.delete();
  } catch {
    // Already gone.
  }
}
