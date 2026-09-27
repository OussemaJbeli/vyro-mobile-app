import { PhotoPrivacy } from '@/components/security/PhotoPrivacy';
import { CompareScreen } from '@/components/photos/CompareScreen';

export default function CompareRoute() {
  return (
    <PhotoPrivacy>
      <CompareScreen />
    </PhotoPrivacy>
  );
}
