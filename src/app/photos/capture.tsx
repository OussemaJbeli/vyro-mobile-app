import { useLocalSearchParams } from 'expo-router';

import { PhotoPrivacy } from '@/components/security/PhotoPrivacy';
import { CaptureScreen } from '@/components/photos/CaptureScreen';

export default function CaptureRoute() {
  const { sub, mode } = useLocalSearchParams<{ sub?: string; mode?: string }>();
  return (
    <PhotoPrivacy>
      <CaptureScreen initialSub={sub ?? null} startWithLibrary={mode === 'library'} />
    </PhotoPrivacy>
  );
}
