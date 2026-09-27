import { useEffect } from 'react';

import { resolveStartState } from '@/domain/execution';
import { useSessionsForDate } from '@/hooks/data';
import { useExecutionStore } from '@/store/executionStore';
import { useStartStore } from '@/store/startStore';
import { i18n } from '@/i18n';
import { today } from '@/utils/dates';

/** Today's sessions + the active execution → Start state (step 20). */
export function useStartState() {
  const day = today();
  const sessions = useSessionsForDate(day);
  const active = useExecutionStore((s) => s.state);
  const state = resolveStartState(
    sessions.data ?? [],
    active ? { executionId: active.executionId, title: active.title } : null,
  );
  return { day, sessions, active, state };
}

/** Keeps the centre FAB in sync everywhere (mounted once by the tabs layout). */
export function useStartFabSync() {
  const { state } = useStartState();
  const setFab = useStartStore((s) => s.setFab);
  const fab = state.fab === 'empty' ? 'start' : state.fab;
  const label =
    state.primary?.kind === 'resume'
      ? i18n.t('execution:start.continueA11y', { title: state.primary.label })
      : null;
  useEffect(() => {
    setFab(fab, label);
  }, [fab, label, setFab]);
}
