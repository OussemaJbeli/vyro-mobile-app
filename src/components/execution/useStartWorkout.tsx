import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ConfirmDialog } from '@/components/ui';
import { routes } from '@/constants/routes';
import { buildSnapshot, type ExecState, type Tracking } from '@/domain/execution';
import { invalidates, queryKeys, useRepositories } from '@/hooks/data';
import { useExerciseCatalog } from '@/hooks/useExerciseCatalog';
import { useExecutionStore } from '@/store/executionStore';
import { toast } from '@/store/uiStore';
import { type SessionType } from '@/types/enums';
import { logger } from '@/utils/logger';

/** Pre-start swaps (UI §16): planned exercise id → the replacement performed today. */
export type StartSwaps = Record<string, { exerciseId: string; tracking: Tracking }>;

export type StartSource = {
  templateId: string | null;
  scheduledSessionId?: string | null;
  /** Needed without a template (empty workout, custom session). */
  title?: string;
  type?: SessionType;
};

/** Route of a live execution: strength and running have their own screens. */
export const executionRoute = (s: Pick<ExecState, 'executionId' | 'kind'>) =>
  s.kind === 'running' ? routes.executeRun(s.executionId) : routes.execute(s.executionId);

/**
 * Starts a workout from a template or a scheduled session (Train, workout detail, Plan).
 * Only one workout can be active (invariant 1): starting another offers "Continue" instead.
 */
export function useStartWorkout() {
  const { t } = useTranslation(['execution', 'common']);
  const r = useRepositories();
  const client = useQueryClient();
  const catalog = useExerciseCatalog();
  const active = useExecutionStore((s) => s.state);
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);

  const start = async (source: StartSource, swaps: StartSwaps = {}) => {
    const current = useExecutionStore.getState().state;
    if (current) {
      setConflict(true);
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const template = source.templateId
        ? await client.fetchQuery({
            queryKey: queryKeys.template(source.templateId),
            queryFn: () => r.templates.get(source.templateId!),
          })
        : null;
      const type = template?.type ?? source.type ?? 'gym';
      const title = template?.name ?? source.title ?? '';
      const snapshot = template
        ? buildSnapshot(template, (id) => {
            const x = catalog.byId.get(id);
            return x ? { name: x.label, tracking: x.tracking } : undefined;
          })
        : {
            schemaVersion: 1 as const,
            templateId: null,
            name: title,
            type,
            exercises: [],
            intervals: [],
          };
      const state = await useExecutionStore.getState().start({
        scheduledSessionId: source.scheduledSessionId ?? null,
        templateId: template?.id ?? null,
        type,
        title,
        snapshot,
        // Runs open with a 3-2-1 countdown: the clock starts when it ends (skippable).
        ...(type === 'running' ? { startedAt: new Date(Date.now() + 3000).toISOString() } : {}),
      });
      // Swaps are recorded as substitutions: the plan snapshot stays untouched (AD-07).
      for (const [index, e] of state.exercises.entries()) {
        const swap = swaps[e.exerciseId];
        if (!swap) continue;
        await useExecutionStore.getState().dispatch({
          type: 'SUBSTITUTE_EXERCISE',
          exerciseId: swap.exerciseId,
          tracking: swap.tracking,
          reason: t('today.noEquipment'),
          exerciseIndex: index,
        });
      }
      await Promise.all(
        [...invalidates.executionProgress, ...invalidates.schedule].map((queryKey) =>
          client.invalidateQueries({ queryKey }),
        ),
      );
      router.push(executionRoute(state));
    } catch (error) {
      logger.error('Start workout failed', { error });
      toast.error(t('start.failed'));
    } finally {
      setBusy(false);
    }
  };

  const element = (
    <ConfirmDialog
      visible={conflict}
      title={t('start.activeTitle')}
      message={t('start.activeBody', { title: active?.title ?? '' })}
      confirmLabel={t('start.continue')}
      cancelLabel={t('common:cancel')}
      onCancel={() => setConflict(false)}
      onConfirm={() => {
        setConflict(false);
        if (active) router.push(executionRoute(active));
      }}
    />
  );

  return { start, busy, element };
}
