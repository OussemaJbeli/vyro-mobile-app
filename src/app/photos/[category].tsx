import { PhotoPrivacy } from '@/components/security/PhotoPrivacy';
import { useLocalSearchParams } from 'expo-router';

import { PhotoGridScreen } from '@/components/photos/PhotoGridScreen';

export default function PhotoCategoryRoute() {
  const { category } = useLocalSearchParams<{ category: string }>();
  return (
    <PhotoPrivacy>
      <PhotoGridScreen category={category} />
    </PhotoPrivacy>
  );
}
