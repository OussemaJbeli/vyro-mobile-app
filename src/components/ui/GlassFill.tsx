import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import { brand } from '@/theme/brand';
import { darken, lighten, withAlpha } from '@/theme/color';

/**
 * Glass / 3D fill for accent surfaces (primary buttons, FAB, selected chips): a vertical
 * accent gradient (light top → base → deeper bottom), a glossy highlight on the upper half
 * and a thin light rim. The parent sets the border radius and `overflow: 'hidden'`.
 */
export function GlassFill({ color, radius }: { color?: string; radius: number }) {
  const t = useTheme();
  const base = color ?? t.colors.primary;
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        { borderRadius: radius, overflow: 'hidden', pointerEvents: 'none' },
      ]}
    >
      <LinearGradient
        colors={[lighten(base, 0.28), base, darken(base, 0.22)]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* Gloss: soft white sheen on the top half. */}
      <LinearGradient
        colors={[withAlpha(brand.white, 0.42), withAlpha(brand.white, 0.08), 'transparent']}
        locations={[0, 0.45, 0.6]}
        style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
      />
      {/* Rim light + inner bottom shade for depth. */}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: radius,
            borderWidth: 1,
            borderTopColor: withAlpha(brand.white, 0.55),
            borderLeftColor: withAlpha(brand.white, 0.25),
            borderRightColor: withAlpha(brand.white, 0.15),
            borderBottomColor: withAlpha(darken(base, 0.45), 0.6),
          },
        ]}
      />
    </View>
  );
}
