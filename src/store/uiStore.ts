import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info';

export type ToastItem = {
  id: number;
  type: ToastType;
  message: string;
  /** Milliseconds before auto-dismiss. */
  duration: number;
  /** Optional inline action (e.g. Undo). */
  action?: { label: string; onPress: () => void };
};

type UiState = {
  toasts: ToastItem[];
  showToast: (t: {
    type?: ToastType;
    message: string;
    duration?: number;
    action?: ToastItem['action'];
  }) => number;
  dismissToast: (id: number) => void;
};

let nextId = 1;

/** Ephemeral UI state only (AD-12). Persistent data never lives here. */
export const useUiStore = create<UiState>((set) => ({
  toasts: [],
  showToast: ({ type = 'info', message, duration = 3000, action }) => {
    const id = nextId++;
    const item: ToastItem = { id, type, message, duration, ...(action ? { action } : {}) };
    // Keep at most 3 queued toasts so a burst of errors can't flood the screen.
    set((s) => ({ toasts: [...s.toasts, item].slice(-3) }));
    return id;
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

/** Imperative helper for mutation hooks and services. */
export const toast = {
  success: (message: string) => useUiStore.getState().showToast({ type: 'success', message }),
  error: (message: string) =>
    useUiStore.getState().showToast({ type: 'error', message, duration: 5000 }),
  info: (message: string) => useUiStore.getState().showToast({ type: 'info', message }),
  /** Success toast with an inline action, shown a little longer (e.g. "Applied · Undo"). */
  withAction: (message: string, label: string, onPress: () => void) =>
    useUiStore
      .getState()
      .showToast({ type: 'success', message, duration: 6000, action: { label, onPress } }),
};
