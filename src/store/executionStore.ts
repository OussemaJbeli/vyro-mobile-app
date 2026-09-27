import { create } from 'zustand';

import { type StartExecutionInput } from '@/db/repositories/executions';
import {
  reduce,
  restRemainingMs,
  type Event,
  type ExecExercise,
  type ExecState,
} from '@/domain/execution';
import { type ExecutionRunner } from '@/services/execution/runner';
import { logger } from '@/utils/logger';

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type EngineEvent = DistributiveOmit<Event, 'now'>;

type ExecutionStoreState = {
  state: ExecState | null;
  /** Intervals auto-completed while the app was away ("Resumed — N completed" banner). */
  caughtUp: number;
  bind: (runner: ExecutionRunner | null, clock?: () => number) => void;
  setState: (state: ExecState | null) => void;
  start: (input: StartExecutionInput) => Promise<ExecState>;
  /** Reduce → persist (write-ahead) → publish → side effects. Serialized. */
  dispatch: (event: EngineEvent) => Promise<void>;
  /** Pause-sheet "Discard workout". Serialized with events. */
  discard: () => Promise<'deleted' | 'abandoned' | null>;
  dismissCaughtUp: () => void;
  /** Dev harness only: shifts the engine clock forward (time travel). */
  timeTravel: (ms: number) => void;
};

let runner: ExecutionRunner | null = null;
let now: () => number = Date.now;
let offsetMs = 0;
let queue: Promise<void> = Promise.resolve();

/** Live state of the active execution. The reducer is the only thing that changes it. */
export const useExecutionStore = create<ExecutionStoreState>((set, get) => ({
  state: null,
  caughtUp: 0,

  bind: (r, clock = Date.now) => {
    runner = r;
    now = clock;
    offsetMs = 0;
  },

  setState: (state) => set({ state }),

  start: async (input) => {
    if (!runner) throw new Error('Execution runner not bound');
    const state = await runner.start(input);
    set({ state, caughtUp: 0 });
    return state;
  },

  dispatch: (event) => {
    const run = async () => {
      const current = get().state;
      if (!current || !runner) return;
      const t = reduce(current, { ...event, now: engineNow() } as Event);
      if (t.state === current && !t.changes.length) return runner.runEffects(t.effects);
      await runner.commit(t);
      const done = t.state.lifecycle === 'completed' || t.state.lifecycle === 'abandoned';
      set({ state: done ? null : t.state, caughtUp: get().caughtUp + t.caughtUp });
      runner.runEffects(t.effects);
    };
    queue = queue.then(run).catch((error: unknown) => {
      logger.error('Execution event failed', { error, event: event.type });
      throw error;
    });
    const result = queue;
    queue = queue.catch(() => {});
    return result;
  },

  discard: () => {
    const run = async () => {
      const current = get().state;
      if (!current || !runner) return null;
      const result = await runner.discard(current.executionId);
      set({ state: null, caughtUp: 0 });
      return result;
    };
    const result = queue.then(run);
    queue = result.then(
      () => {},
      () => {},
    );
    return result;
  },

  dismissCaughtUp: () => set({ caughtUp: 0 }),

  timeTravel: (ms) => {
    offsetMs += ms;
  },
}));

/** The engine's clock. Timer displays must use it too, so time travel stays consistent. */
export const engineNow = () => now() + offsetMs;

/** Selectors for the execution screens (steps 18–19). */
export const selectCurrentExercise = (s: ExecState | null): ExecExercise | null =>
  s?.cursor ? (s.exercises[s.cursor.exercise] ?? null) : null;

export const selectRestRemainingMs = (s: ExecState | null, at: number) =>
  s ? restRemainingMs(s, at) : 0;

/** Completed / total planned units (sets or intervals), for progress bars. */
export function selectProgress(s: ExecState | null): { done: number; total: number } {
  if (!s) return { done: 0, total: 0 };
  const units = s.kind === 'running' ? s.intervals : s.exercises.flatMap((e) => e.sets);
  return { done: units.filter((u) => u.status !== 'pending').length, total: units.length };
}
