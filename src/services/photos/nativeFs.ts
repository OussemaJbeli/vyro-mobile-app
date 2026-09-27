import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Platform } from 'react-native';

import { PHOTO_ROOT, resolvePath } from './paths';
import { type PhotoFs } from './storage';
import { webPhotoFs, webPhotoUri } from './webFs';

/** Private photo files on the phone (backups, screenshot blocking and exports need them). */
export const photosSupported = Platform.OS !== 'web';

export const photoUri = (relative: string) =>
  photosSupported ? resolvePath(Paths.document.uri, relative) : webPhotoUri(relative);

const fileAt = (relative: string) => new File(Paths.document, PHOTO_ROOT, relative);

function listRecursive(dir: Directory, prefix: string): string[] {
  if (!dir.exists) return [];
  return dir
    .list()
    .flatMap((entry) =>
      entry instanceof Directory
        ? listRecursive(entry, `${prefix}${entry.name}/`)
        : [`${prefix}${entry.name}`],
    );
}

/** expo-file-system + expo-image-manipulator implementation of the photo store's FS. */
export const nativePhotoFs: PhotoFs = {
  async writeImage(sourceUri, relative, maxEdge, quality) {
    const probe = await ImageManipulator.manipulate(sourceUri).renderAsync();
    const long = Math.max(probe.width, probe.height);
    const ctx = ImageManipulator.manipulate(sourceUri);
    if (long > maxEdge) {
      ctx.resize(probe.width >= probe.height ? { width: maxEdge } : { height: maxEdge });
    }
    const image = await ctx.renderAsync();
    // Re-encoding to JPEG writes a new file without the original EXIF/GPS metadata.
    const out = await image.saveAsync({ compress: quality, format: SaveFormat.JPEG });
    const target = fileAt(relative);
    const dir = target.parentDirectory;
    if (!dir.exists) dir.create({ intermediates: true });
    const tmp = new File(out.uri);
    tmp.move(target);
    return { width: out.width, height: out.height, bytes: target.size ?? null };
  },
  async remove(relative) {
    const f = fileAt(relative);
    if (f.exists) f.delete();
  },
  exists: (relative) => fileAt(relative).exists,
  listFiles: () => {
    const root = new Directory(Paths.document, PHOTO_ROOT);
    return [
      ...listRecursive(new Directory(root, 'photos'), 'photos/'),
      ...listRecursive(new Directory(root, 'thumbs'), 'thumbs/'),
    ];
  },
};

/** The photo store's file system for this platform. */
export const photoFs: PhotoFs = photosSupported ? nativePhotoFs : webPhotoFs;
