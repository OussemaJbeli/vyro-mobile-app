import { create } from 'zustand';

type LockState = {
  /** The lock screen is shown (whole app, or photo screens when scoped). */
  locked: boolean;
  /** When the app last went to the background (for the auto-lock timeout). */
  backgroundAt: number | null;
  /** Lock active = setting on AND a PIN exists (a setting alone never locks anyone out). */
  armed: boolean;
  lock: () => void;
  unlock: () => void;
  setArmed: (armed: boolean) => void;
  setBackgroundAt: (at: number | null) => void;
};

export const useLockStore = create<LockState>((set) => ({
  locked: false,
  backgroundAt: null,
  armed: false,
  lock: () => set((s) => (s.armed ? { locked: true } : s)),
  unlock: () => set({ locked: false, backgroundAt: null }),
  setArmed: (armed) => set((s) => ({ armed, locked: armed ? s.locked : false })),
  setBackgroundAt: (backgroundAt) => set({ backgroundAt }),
}));
