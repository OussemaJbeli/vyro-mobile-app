import { create } from 'zustand';

type AppState = {
  /** Loaded at startup (bootstrap) so the entry redirect is synchronous. */
  onboardingCompleted: boolean;
  setOnboardingCompleted: (done: boolean) => void;
};

export const useAppStore = create<AppState>((set) => ({
  onboardingCompleted: false,
  setOnboardingCompleted: (onboardingCompleted) => set({ onboardingCompleted }),
}));
