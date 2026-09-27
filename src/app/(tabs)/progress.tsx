import { useTranslation } from 'react-i18next';

import { CoachEntry } from '@/components/ai/CoachEntry';
import { PhotoPrivacy } from '@/components/security/PhotoPrivacy';
import { LatestComparisonCard, PhotosSegment } from '@/components/photos/PhotosSegment';
import { ProgressScreen } from '@/components/progress/ProgressScreen';

/** Progress tab (steps 22–24). */
export default function ProgressTab() {
  const { t } = useTranslation('settings');
  return (
    <ProgressScreen
      photosSegment={
        <PhotoPrivacy>
          <PhotosSegment />
        </PhotoPrivacy>
      }
      overviewExtra={
        <>
          <CoachEntry method="analyzeProgress" label={t('ai.coach.actions.progress')} />
          <LatestComparisonCard />
        </>
      }
    />
  );
}
