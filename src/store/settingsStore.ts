import { create } from 'zustand';

import { setLanguage } from '@/i18n';
import {
  defaultSettings,
  type SettingKey,
  type Settings,
  type SettingValue,
} from '@/types/settings';
import { setHapticsEnabled } from '@/utils/haptics';
import { logger } from '@/utils/logger';

type Persist = <K extends SettingKey>(key: K, value: SettingValue<K>) => Promise<void>;

type SettingsState = {
  values: Settings;
  hydrated: boolean;
  hydrate: (values: Settings) => void;
  set: <K extends SettingKey>(key: K, value: SettingValue<K>) => Promise<void>;
};

let persist: Persist | null = null;

/** Wires persistence once the database is open (bootstrap, step 10). */
export function bindSettingsPersistence(fn: Persist | null) {
  persist = fn;
}

/** Side effects that must follow a setting everywhere in the app. */
function apply(values: Partial<Settings>) {
  if (values.language !== undefined) setLanguage(values.language).catch(() => {});
  if (values.haptics !== undefined) setHapticsEnabled(values.haptics);
}

/**
 * Synchronous mirror of app_settings for render-time reads (theme, units, haptics…).
 * SQLite stays the source of truth: every change is written through.
 */
export const useSettingsStore = create<SettingsState>((set, get) => ({
  values: defaultSettings,
  hydrated: false,
  hydrate: (values) => {
    set({ values, hydrated: true });
    apply(values);
  },
  set: async (key, value) => {
    const previous = get().values[key];
    set((s) => ({ values: { ...s.values, [key]: value } }));
    apply({ [key]: value } as Partial<Settings>);
    try {
      await persist?.(key, value);
    } catch (e) {
      // Roll back the optimistic change so the UI never shows an unsaved value.
      set((s) => ({ values: { ...s.values, [key]: previous } }));
      apply({ [key]: previous } as Partial<Settings>);
      logger.error('Saving setting failed', { key, error: e });
      throw e;
    }
  },
}));

export const useSetting = <K extends SettingKey>(key: K): SettingValue<K> =>
  useSettingsStore((s) => s.values[key]);
