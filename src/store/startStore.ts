import { create } from 'zustand';

/** Visual state of the central Start button (UI §10). */
export type StartFabState = 'start' | 'continue' | 'done' | 'rest';

type StartState = {
  fab: StartFabState;
  /** Screen-reader label, e.g. "Continue Upper Body workout". */
  label: string | null;
  setFab: (fab: StartFabState, label?: string | null) => void;
};

/**
 * Step 05 drives this from a dev toggle. Step 20 replaces the source with
 * `resolveStartState()` over today's sessions and the active execution.
 */
export const useStartStore = create<StartState>((set) => ({
  fab: 'start',
  label: null,
  setFab: (fab, label = null) => set({ fab, label }),
}));
