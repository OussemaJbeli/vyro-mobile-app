import { deleteStoredImage, pickStoredImage, storedImageUri } from '@/services/media/storedImage';
import { useSetting, useSettingsStore } from '@/store/settingsStore';
import { logger } from '@/utils/logger';

/** Default profile picture until the user picks one (assets/images/avatar/avatar.png). */
const DEFAULT_AVATAR = require('../../assets/images/avatar/avatar.png') as number;

/** Profile picture: displayable URI (or null), the default picture, pick/remove actions. */
export function useAvatar() {
  const ref = useSetting('profile.avatar');
  const set = useSettingsStore((s) => s.set);
  return {
    uri: ref ? storedImageUri(ref) : null,
    fallback: DEFAULT_AVATAR,
    pick: async () => {
      try {
        const picked = await pickStoredImage({
          folder: 'media/avatar',
          maxEdge: 400,
          aspect: [1, 1],
        });
        if (!picked) return;
        await set('profile.avatar', picked.ref);
        deleteStoredImage(ref);
      } catch (error) {
        logger.warn('Avatar pick failed', { error });
      }
    },
    remove: async () => {
      await set('profile.avatar', null);
      deleteStoredImage(ref);
    },
  };
}
