import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';
import { withAlpha } from '@/theme/color';

/**
 * Mountain hero layers (assets/images/ASSETS.md): a neutral base with a transparent sky,
 * and an optional white rim mask that is tinted with the current accent. Transparent 1×1
 * placeholders ship until the owner's images replace them (same file names).
 */
const MOUNTAINS = {
  dark: {
    base: require('../../../assets/images/hero/mountain-dark.webp') as number,
    rim: require('../../../assets/images/hero/mountain-dark-rim.png') as number,
  },
  light: {
    base: require('../../../assets/images/hero/mountain-light.webp') as number,
    rim: require('../../../assets/images/hero/mountain-light-rim.png') as number,
  },
};

/** Owner images are 1891×831 (bundled at 1600×703); the layout reserves that ratio. */
const RATIO = 1600 / 703;
/** How far the header mountains extend below the header (hidden by its clipping). */
const HEADER_SINK = -5;

/**
 * Accent-tinted mountain backdrop (template header, Welcome, Home "Today" card).
 * `full` fills a screen (mountains in the lower half); `card` sits at the bottom-right
 * of a card behind its content. Purely decorative: hidden from screen readers.
 */
export function MountainBackdrop({ variant = 'full' }: { variant?: 'full' | 'card' | 'header' }) {
  const t = useTheme();
  const dark = t.scheme === 'dark';
  const layers = dark ? MOUNTAINS.dark : MOUNTAINS.light;
  const box =
    variant === 'card'
      ? styles.cardMountains
      : variant === 'header'
        ? styles.headerMountains
        : styles.fullMountains;
  const fade = variant === 'full' ? null : variant === 'card' ? t.colors.surface : t.colors.bg;
  return (
    <View
      style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {/* Accent glow rising behind the peaks. */}
      <LinearGradient
        colors={[
          'transparent',
          withAlpha(t.colors.primary, dark ? (variant === 'full' ? 0.18 : 0.24) : 0.06),
          'transparent',
        ]}
        locations={
          variant === 'header'
            ? [0, 0.55, 1]
            : variant === 'full'
              ? [0.22, 0.42, 0.56]
              : [0.25, 0.72, 1]
        }
        start={variant === 'header' ? { x: 0.3, y: 0 } : { x: 0.5, y: 0 }}
        end={variant === 'header' ? { x: 1, y: 1 } : { x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.mountains, box]}>
        <Image
          source={layers.base}
          style={styles.layer}
          contentFit="cover"
          contentPosition="bottom"
        />
        {/* Rim glow in the accent colour: tinted mask, screen-blended so it lights the peaks. */}
        <View style={[styles.layer, { opacity: dark ? 0.85 : 0.45, mixBlendMode: 'screen' }]}>
          <Image
            source={layers.rim}
            style={styles.layer}
            contentFit="cover"
            contentPosition="bottom"
            tintColor={t.colors.primary}
          />
        </View>
        {variant === 'full' ? (
          // The peaks dissolve into the background under them (template welcome).
          <LinearGradient
            colors={['transparent', withAlpha(t.colors.bg, 0.85), t.colors.bg]}
            locations={[0.35, 0.8, 0.97]}
            style={styles.layer}
          />
        ) : null}
      </View>
      {fade ? (
        <>
          {/* Keep text readable: fade the image into the surface on the text side (a light
              veil only for the full-width header) and at the bottom. */}
          <LinearGradient
            colors={
              variant === 'header'
                ? [withAlpha(fade, 0.55), withAlpha(fade, 0.15), 'transparent']
                : [fade, withAlpha(fade, 0.6), 'transparent']
            }
            locations={variant === 'header' ? [0, 0.5, 0.85] : [0, 0.35, 0.75]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          {variant === 'header' ? (
            <LinearGradient
              colors={['transparent', fade]}
              locations={[0.88, 1]}
              style={StyleSheet.absoluteFill}
            />
          ) : null}
        </>
      ) : null}
    </View>
  );
}

/** Hero screen backdrop: themed gradient + accent-tinted mountains, then the content. */
export function HeroBackground({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const dark = t.scheme === 'dark';
  return (
    <View style={[styles.fill, { backgroundColor: t.colors.bg }, style]}>
      <LinearGradient
        colors={
          dark
            ? [t.colors.bg, withAlpha(t.colors.primary, 0.08), t.colors.bg]
            : [t.colors.bg, withAlpha(t.colors.primary, 0.04), t.colors.bg]
        }
        locations={[0, 0.45, 0.8]}
        style={StyleSheet.absoluteFill}
      />
      <MountainBackdrop variant="full" />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, overflow: 'hidden' },
  mountains: { position: 'absolute', aspectRatio: RATIO },
  // Welcome: peaks centred under the logo, above the tagline (template).
  fullMountains: { left: '-35%', right: '-35%', top: '24%' },
  cardMountains: { right: '-15%', bottom: 0, height: '100%' },
  // Home header: full width at the image's own ratio, sunk below the header so only the
  // peaks show, rising ~100 dp above the Today card (which overlaps the header's last 40 dp).
  headerMountains: { left: 0, right: 0, bottom: -HEADER_SINK },
  layer: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
});
