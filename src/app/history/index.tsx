import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { HistoryTimeline } from '@/components/progress/HistoryTimeline';
import { Header, ScreenContainer } from '@/components/ui';

export default function HistoryRoute() {
  const { t } = useTranslation('progress');
  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <Header title={t('segments.history')} onBack={() => router.back()} large={false} />
      <HistoryTimeline />
    </ScreenContainer>
  );
}
