import { PhotoPrivacy } from '@/components/security/PhotoPrivacy';
import { useLocalSearchParams } from 'expo-router';

import { PhotoViewer } from '@/components/photos/PhotoViewer';

export default function PhotoViewerRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <PhotoPrivacy>
      <PhotoViewer id={id} />
    </PhotoPrivacy>
  );
}
