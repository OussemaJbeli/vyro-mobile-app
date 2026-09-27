import { render, screen } from '@testing-library/react-native';
import { StyleSheet, View } from 'react-native';

import { accentPresets } from '@/theme/brand';

import { VyroLogo } from '../VyroLogo';
import { VyroMark } from '../VyroMark';

describe('VyroMark', () => {
  it('renders as an accessible image', async () => {
    await render(<VyroMark testID="mark" />);
    expect(screen.getByLabelText('VYRO')).toBeTruthy();
  });

  it('keeps the mark aspect ratio and grows the box when glowing', async () => {
    await render(
      <View>
        <VyroMark size={76} testID="plain" />
        <VyroMark size={76} glow testID="glow" />
      </View>,
    );
    const height = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style).height;
    expect(height('plain')).toBeCloseTo(51, 0);
    expect(height('glow')).toBeGreaterThan(height('plain'));
  });

  it('gives each instance unique gradient ids', async () => {
    const tree = await render(
      <View>
        <VyroMark color={accentPresets.blue} />
        <VyroMark color={accentPresets.red} />
      </View>,
    );
    // The native SVG host tree names gradients `name` and references them via `brushRef`.
    const json = JSON.stringify(tree.toJSON());
    const names = [...json.matchAll(/"name":"([^"]+)"/g)].map((m) => m[1]);
    const refs = new Set([...json.matchAll(/"brushRef":"([^"]+)"/g)].map((m) => m[1]));
    expect(names).toHaveLength(6);
    expect(new Set(names).size).toBe(6);
    refs.forEach((ref) => expect(names).toContain(ref));
  });
});

describe('VyroLogo', () => {
  it('announces the tagline in the stacked variant', async () => {
    await render(<VyroLogo />);
    expect(screen.getByLabelText('VYRO. Train, track, evolve.')).toBeTruthy();
  });

  it('uses a short label for the horizontal variant', async () => {
    await render(<VyroLogo variant="horizontal" testID="logo" />);
    expect(screen.getByTestId('logo').props.accessibilityLabel).toBe('VYRO');
  });
});
