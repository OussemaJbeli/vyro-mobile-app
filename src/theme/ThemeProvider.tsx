import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { useSettingsStore } from '@/store/settingsStore';

import { type AccentName } from './brand';
import { buildColors, statusStyles, type SchemeName } from './schemes';
import { iconSize, motion, radius, spacing, touch, typography } from './tokens';

export type ThemePreference = 'system' | 'dark' | 'light';

export type ActivityOverrides = Record<string, { color: string | null; icon: string | null }>;

export function createTheme(
  scheme: SchemeName,
  accent: AccentName,
  overrides: ActivityOverrides = {},
) {
  const base = buildColors(scheme, accent);
  // Custom activity colours from Settings → Activities.
  const activity = { ...base.activity };
  for (const [k, v] of Object.entries(overrides)) {
    if (v.color && k in activity) activity[k as keyof typeof activity] = v.color;
  }
  const colors = { ...base, activity };
  return {
    scheme,
    accent,
    colors,
    status: statusStyles(colors),
    spacing,
    radius,
    typography,
    touch,
    motion,
    iconSize,
  };
}

export type Theme = ReturnType<typeof createTheme>;

type ThemeContextValue = {
  theme: Theme;
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
  setAccent: (a: AccentName) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Dark is the default: the app is designed dark-first (template "Dark (Default)"). */
export function resolveScheme(
  pref: ThemePreference,
  system: string | null | undefined,
): SchemeName {
  if (pref === 'system') return system === 'light' ? 'light' : 'dark';
  return pref;
}

/**
 * Theme preference and accent come from the settings store, which is hydrated from
 * app_settings before the splash hides and persists every change (step 10).
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const preference = useSettingsStore((st) => st.values.theme);
  const accent = useSettingsStore((st) => st.values.accent);
  const overrides = useSettingsStore((st) => st.values['activity.styles']);
  const setSetting = useSettingsStore((st) => st.set);
  const scheme = resolveScheme(preference, system);
  const setPreference = useCallback(
    (p: ThemePreference) => {
      setSetting('theme', p).catch(() => {});
    },
    [setSetting],
  );
  const setAccent = useCallback(
    (a: AccentName) => {
      setSetting('accent', a).catch(() => {});
    },
    [setSetting],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({ theme: createTheme(scheme, accent, overrides), preference, setPreference, setAccent }),
    [scheme, accent, overrides, preference, setPreference, setAccent],
  );

  // The root view colour shows behind screens during transitions: keep it in sync to avoid flashes.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(value.theme.colors.bg).catch(() => {});
  }, [value.theme.colors.bg]);

  return (
    <ThemeContext.Provider value={value}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {children}
    </ThemeContext.Provider>
  );
}

function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}

export const useTheme = (): Theme => useThemeContext().theme;

/** Theme preference controls, for Appearance settings (step 12) and the dev preview. */
export function useThemeControls() {
  const { preference, setPreference, setAccent, theme } = useThemeContext();
  return { preference, setPreference, accent: theme.accent, setAccent };
}
