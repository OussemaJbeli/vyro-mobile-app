import { Image, type ImageSource } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { bundledImage } from '@/constants/bundledImages';
import { coverPhotoUri } from '@/services/photos/covers';
import { useTheme } from '@/theme';
import { withAlpha } from '@/theme/color';

import { Icon, type IconName } from './Icon';

export type CoverType = 'gym' | 'running' | 'home' | 'abs' | 'recovery' | 'rest' | 'other';

const TYPE_ICON: Record<CoverType, IconName> = {
  gym: 'gym',
  running: 'running',
  home: 'home_workout',
  abs: 'abs',
  recovery: 'recovery',
  rest: 'rest',
  other: 'other',
};

export type CoverArtProps = {
  type: CoverType;
  coverKey?: string | null;
  /** A user-chosen local photo (private storage URI). */
  uri?: string | null;
  size?: number;
  /** Icon size for the gradient fallback when `style` sets a custom (e.g. wide) box. */
  iconSize?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Workout thumbnail: chosen photo → bundled `assets/images/workouts/<cover_key>` → themed
 * gradient. Layouts never depend on an image existing.
 */
export function CoverArt({ type, coverKey, uri, size = 56, iconSize, style }: CoverArtProps) {
  const t = useTheme();
  const photo = uri ?? coverPhotoUri(coverKey);
  const source: ImageSource | number | undefined = photo
    ? { uri: photo }
    : (bundledImage('workouts', coverKey) ?? undefined);
  const box = [{ width: size, height: size, borderRadius: t.radius.md }, styles.box, style];

  if (source) {
    return (
      <View style={box}>
        <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" />
      </View>
    );
  }
  return (
    <View style={box}>
      <LinearGradient
        colors={[withAlpha(t.colors.primary, 0.35), t.colors.surfaceRaised]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Icon name={TYPE_ICON[type]} size={iconSize ?? size * 0.45} color={t.colors.primaryInk} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
});
