import { useTranslation } from 'react-i18next';

import { AISettings } from '@/components/ai/AISettings';
import { Header, ScreenContainer } from '@/components/ui';
import { goBack } from '@/constants/navigation';
import { routes } from '@/constants/routes';

/** Settings → AI assistant (step 31). */
export default function AiScreen() {
  const { t } = useTranslation('settings');
  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <Header title={t('ai.title')} onBack={() => goBack(routes.settings)} />
      <AISettings />
    </ScreenContainer>
  );
}
