import { fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { accentNames } from '../brand';
import { contrastRatio } from '../contrast';
import { makeStyles } from '../makeStyles';
import { buildColors, statusStyles, type SchemeName } from '../schemes';
import { resolveScheme, ThemeProvider, useTheme, useThemeControls } from '../ThemeProvider';

const SCHEMES: SchemeName[] = ['dark', 'light'];
const AA = 4.5;

describe('contrast guard (6 accents × 2 schemes)', () => {
  it.each(SCHEMES.flatMap((s) => accentNames.map((a) => [s, a] as const)))(
    '%s / %s meets WCAG AA for text pairs',
    (scheme, accent) => {
      const c = buildColors(scheme, accent);
      expect(contrastRatio(c.text, c.bg)).toBeGreaterThanOrEqual(AA);
      expect(contrastRatio(c.textMuted, c.bg)).toBeGreaterThanOrEqual(AA);
      expect(contrastRatio(c.onPrimary, c.primary)).toBeGreaterThanOrEqual(AA);
      expect(contrastRatio(c.primaryInk, c.bg)).toBeGreaterThanOrEqual(AA);
      expect(contrastRatio(c.primaryInk, c.surface)).toBeGreaterThanOrEqual(AA);
    },
  );

  it('never uses raw lime as text on light surfaces', () => {
    const light = buildColors('light', 'lime');
    expect(light.primaryInk).not.toBe(light.primary);
  });

  it('computes known contrast values', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(contrastRatio('#777777', '#777777')).toBe(1);
  });
});

describe('scheme resolution', () => {
  it('follows the system only when preference is system, defaulting to dark', () => {
    expect(resolveScheme('system', 'light')).toBe('light');
    expect(resolveScheme('system', 'dark')).toBe('dark');
    expect(resolveScheme('system', null)).toBe('dark');
    expect(resolveScheme('light', 'dark')).toBe('light');
  });

  it('gives every status an icon and label key, not just a colour', () => {
    Object.values(statusStyles(buildColors('dark', 'lime'))).forEach((s) => {
      expect(s.icon).toBeTruthy();
      expect(s.labelKey).toMatch(/^status:/);
    });
  });
});

describe('ThemeProvider', () => {
  const useStyles = makeStyles((t) => ({ label: { color: t.colors.primary } }));

  function Probe() {
    const theme = useTheme();
    const { setAccent, setPreference } = useThemeControls();
    const styles = useStyles();
    return (
      <>
        <Text testID="label" style={styles.label}>
          {theme.scheme}
        </Text>
        <Pressable testID="blue" onPress={() => setAccent('blue')} />
        <Pressable testID="light" onPress={() => setPreference('light')} />
      </>
    );
  }

  it('switches accent and scheme live', async () => {
    await render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('label')).toHaveTextContent('dark');
    expect(screen.getByTestId('label')).toHaveStyle({ color: '#7EFF00' });

    await fireEvent.press(screen.getByTestId('blue'));
    expect(screen.getByTestId('label')).toHaveStyle({ color: '#3B82F6' });

    await fireEvent.press(screen.getByTestId('light'));
    expect(screen.getByTestId('label')).toHaveTextContent('light');
  });

  it('throws a clear error outside the provider', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(render(<Probe />)).rejects.toThrow('inside <ThemeProvider>');
  });
});
