import { useMemo } from 'react';
import { StyleSheet } from 'react-native';

import { useTheme, type Theme } from './ThemeProvider';

/**
 * Declares theme-dependent styles once, outside the component:
 *
 *   const useStyles = makeStyles((t) => ({ card: { backgroundColor: t.colors.surface } }));
 *   const styles = useStyles();
 *
 * Styles are rebuilt only when the theme object changes (scheme or accent switch).
 */
export function makeStyles<T extends StyleSheet.NamedStyles<T>>(factory: (theme: Theme) => T) {
  return function useStyles(): T {
    const theme = useTheme();
    return useMemo(() => StyleSheet.create(factory(theme)), [theme]);
  };
}
