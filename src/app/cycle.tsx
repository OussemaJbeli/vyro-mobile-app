import { useTranslation } from 'react-i18next';

import { CycleEditor } from '@/components/planner/CycleEditor';
import { Header, ScreenContainer } from '@/components/ui';
import { goBack } from '@/constants/navigation';
import { routes } from '@/constants/routes';

/** Plan → Edit cycle: the VYRO day groups. */
export default function CycleScreen() {
  const { t } = useTranslation('plan');
  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <Header title={t('cycle.title')} onBack={() => goBack(routes.plan)} />
      <CycleEditor />
    </ScreenContainer>
  );
}
