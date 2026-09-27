import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { routes } from '@/constants/routes';
import { invalidates } from '@/hooks/data';
import { useExecutionStore } from '@/store/executionStore';
import { toast } from '@/store/uiStore';
import { logger } from '@/utils/logger';

import { leaveExecution } from './ExecutionShell';

/** Finish (→ completion screen) and discard, shared by the strength and running screens. */
export function useExecutionExit(executionId: string) {
  const { t } = useTranslation(['execution', 'errors']);
  const client = useQueryClient();
  const [finishing, setFinishing] = useState(false);

  const refresh = () =>
    Promise.all(
      invalidates.executionFinished.map((queryKey) =>
        client.invalidateQueries({ queryKey: [...queryKey] }),
      ),
    );

  const finish = async () => {
    setFinishing(true);
    try {
      await useExecutionStore.getState().dispatch({ type: 'FINISH' });
      await refresh();
      router.replace(routes.executeComplete(executionId));
    } catch (error) {
      logger.error('Finish failed', { error });
      setFinishing(false);
      toast.error(t('errors:DB_WRITE_FAILED'));
    }
  };

  const discard = async () => {
    try {
      const result = await useExecutionStore.getState().discard();
      await refresh();
      toast.info(result === 'deleted' ? t('exit.discarded') : t('exit.abandoned'));
      leaveExecution();
    } catch (error) {
      logger.error('Discard failed', { error });
      toast.error(t('errors:DB_WRITE_FAILED'));
    }
  };

  return { finish, discard, finishing };
}
