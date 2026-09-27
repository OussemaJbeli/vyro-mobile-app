import * as SplashScreen from 'expo-splash-screen';
import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, ErrorState, ScreenContainer } from '@/components/ui';
import { useDatabaseStatus } from '@/hooks/database';
import { exportDiagnostics } from '@/services/diagnostics';
import { toUserMessage } from '@/utils/errors';

/**
 * Keeps the native splash up while the database opens and migrates. On failure, shows a
 * blocking, human error: the app never runs on a half-migrated schema (step 07).
 */
export function DatabaseGate({ children }: { children: ReactNode }) {
  const status = useDatabaseStatus();
  const { t } = useTranslation('errors');

  useEffect(() => {
    if (status.state !== 'opening') SplashScreen.hideAsync().catch(() => {});
  }, [status.state]);

  if (status.state === 'opening') return null;
  if (status.state === 'error') {
    return (
      <ScreenContainer scroll={false}>
        <ErrorState
          title={t('dbErrorTitle')}
          body={toUserMessage(status.error, (k) => t(k as 'UNKNOWN'))}
        />
        <Button
          label={t('exportDiagnostics')}
          variant="secondary"
          fullWidth
          onPress={() => exportDiagnostics({ error: status.error })}
        />
      </ScreenContainer>
    );
  }
  return children;
}
