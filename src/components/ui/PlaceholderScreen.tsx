import { router, useNavigation } from 'expo-router';
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { type IconName } from './Icon';
import { Header, ScreenContainer } from './Layout';
import { EmptyState } from './States';

export type PlaceholderScreenProps = {
  title: string;
  /** Roadmap step that builds this screen. */
  step: string;
  icon?: IconName;
  /** Tab roots have no back button and leave the bottom edge to the tab bar. */
  tab?: boolean;
  children?: ReactNode;
};

/** Temporary screen for routes not built yet, so the whole route map is navigable (step 05). */
export function PlaceholderScreen({
  title,
  step,
  icon,
  tab = false,
  children,
}: PlaceholderScreenProps) {
  const navigation = useNavigation();
  const { t } = useTranslation('placeholder');
  const canGoBack = !tab && navigation.canGoBack();
  return (
    <ScreenContainer edges={tab ? ['top'] : ['top', 'bottom']}>
      <Header title={title} large={tab} {...(canGoBack ? { onBack: () => router.back() } : {})} />
      <EmptyState {...(icon ? { icon } : {})} title={t('title', { step })} body={t('body')} />
      {children}
    </ScreenContainer>
  );
}
