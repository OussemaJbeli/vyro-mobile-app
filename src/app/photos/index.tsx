import { PhotoPrivacy } from '@/components/security/PhotoPrivacy';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { PhotosSegment } from '@/components/photos/PhotosSegment';
import { Header, ScreenContainer } from '@/components/ui';

export default function PhotosRoute() {
  const { t } = useTranslation('progress');
  return (
    <PhotoPrivacy>
      <ScreenContainer edges={['top', 'bottom']}>
        <Header title={t('photos.title')} onBack={() => router.back()} large={false} />
        <PhotosSegment />
      </ScreenContainer>
    </PhotoPrivacy>
  );
}
