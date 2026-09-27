import { create } from 'zustand';

import { today } from '@/utils/dates';

export type PlannerView = 'day' | 'week' | 'month';

type PlannerState = {
  selectedDate: string;
  view: PlannerView;
  select: (date: string) => void;
  setView: (view: PlannerView) => void;
};

/** Plan tab UI state (step 16). */
export const usePlannerStore = create<PlannerState>((set) => ({
  selectedDate: today(),
  view: 'week',
  select: (selectedDate) => set({ selectedDate }),
  setView: (view) => set({ view }),
}));
