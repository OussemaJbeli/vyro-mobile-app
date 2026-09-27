import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { AppState } from 'react-native';

import { type executionRepo, type StartExecutionInput } from '@/db/repositories/executions';
import {
  hydrate,
  upcomingAlarms,
  type Alarm,
  toRuntime,
  type ExecState,
  type SideEffect,
  type Transition,
} from '@/domain/execution';
import { haptics } from '@/utils/haptics';
import { logger } from '@/utils/logger';

type Repo = ReturnType<typeof executionRepo>;

/** Local notification hooks for rest end / interval change while backgrounded (step 25). */
export type AlarmNotifier = {
  schedule: (alarms: Alarm[], state: ExecState) => Promise<void>;
  cancel: () => Promise<void>;
};

export type RunnerOptions = {
  settings: () => { autoRest: boolean; keepAwake: boolean };
  notifier?: AlarmNotifier;
  now?: () => number;
};

const KEEP_AWAKE_TAG = 'vyro-execution';
const noopNotifier: AlarmNotifier = { schedule: async () => {}, cancel: async () => {} };

/**
 * Thin effects executor around the pure reducer (step 17): persistence (write-ahead, one
 * transaction per transition), haptics, keep-awake, and background alarms.
 */
export function createRunner(repo: Repo, opts: RunnerOptions) {
  const notifier = opts.notifier ?? noopNotifier;
  const now = opts.now ?? Date.now;

  const keepAwake = (on: boolean) => {
    if (on && opts.settings().keepAwake) {
      activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    } else if (!on) {
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
    }
  };

  const runEffects = (effects: SideEffect[]) => {
    for (const e of effects) {
      if (e.kind === 'haptic') {
        if (e.style === 'tap') haptics.tap();
        else if (e.style === 'success') haptics.success();
        else haptics.warning();
      } else keepAwake(e.on);
    }
  };

  const load = async (id: string) =>
    hydrate(await repo.get(id), { autoRest: opts.settings().autoRest });

  return {
    /** The active execution, rebuilt from rows + runtime_state; null when none. */
    async resume(): Promise<ExecState | null> {
      const active = await repo.getActive();
      if (!active) return null;
      const state = await load(active.id);
      if (state.lifecycle === 'active') keepAwake(true);
      return state;
    },

    /** Creates the execution rows from the frozen plan, then saves the first runtime state. */
    async start(input: StartExecutionInput): Promise<ExecState> {
      const x = await repo.start(input);
      const state = await load(x.id);
      await repo.applyTransition(x.id, [], toRuntime(state));
      keepAwake(true);
      return state;
    },

    /** Persists first; the caller publishes the new state only after this resolves. */
    async commit(t: Transition): Promise<void> {
      await repo.applyTransition(t.state.executionId, t.changes, toRuntime(t.state));
    },

    runEffects,

    /** Discard: deleted when nothing was logged, otherwise abandoned with the data kept. */
    async discard(id: string) {
      const result = await repo.discard(id);
      keepAwake(false);
      return result;
    },

    /** Schedules the next timer alarm while backgrounded; ticks on return. Returns unsubscribe. */
    watchAppState(getState: () => ExecState | null, onForeground: () => void) {
      const sub = AppState.addEventListener('change', (status) => {
        const state = getState();
        if (status === 'active') {
          notifier.cancel().catch(() => {});
          if (state) onForeground();
        } else if (status === 'background' && state) {
          notifier
            .schedule(upcomingAlarms(state, now()), state)
            .catch((error: unknown) => logger.warn('Alarm failed', { error }));
        }
      });
      return () => sub.remove();
    },
  };
}

export type ExecutionRunner = ReturnType<typeof createRunner>;
