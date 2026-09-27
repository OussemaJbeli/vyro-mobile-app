import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { usePhotoCategories, useRepositories } from '@/hooks/data';
import { photoFs, photoUri } from '@/services/photos/nativeFs';
import { createPhotoStore } from '@/services/photos/storage';

/** The private photo store bound to this app's repositories. */
export function usePhotoStore() {
  const repos = useRepositories();
  const [store] = useState(() => createPhotoStore(photoFs, repos.photos));
  return store;
}

/** "body.front" → "Body · Front" style labels; custom groups use the name the user gave. */
export function useCategoryLabel() {
  const { t } = useTranslation('seed');
  const cats = usePhotoCategories().data ?? [];
  return (slug: string) =>
    cats.find((c) => c.slug === slug)?.name ??
    t(`photo.${slug.replace('.', '_')}` as 'photo.body', { defaultValue: slug });
}

export { photoUri };
