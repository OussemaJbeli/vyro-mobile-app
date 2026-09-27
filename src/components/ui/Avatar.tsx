import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { makeStyles, useTheme } from '@/theme';

import { Icon } from './Icon';
import { Text } from './Text';

export type AvatarProps = {
  name?: string | null;
  /** Local file URI (never remote in V1). */
  uri?: string | null;
  /** Bundled fallback picture (e.g. the default avatar) when there is no `uri`. */
  fallbackSource?: number | null;
  size?: number;
  onPress?: () => void;
  accessibilityLabel?: string;
};

export const initialsOf = (name?: string | null) =>
  (name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

export function Avatar({
  name,
  uri,
  fallbackSource,
  size = 40,
  onPress,
  accessibilityLabel,
}: AvatarProps) {
  const t = useTheme();
  const styles = useStyles();
  const { t: tr } = useTranslation();
  const initials = initialsOf(name);
  const circle = { width: size, height: size, borderRadius: size / 2 };
  const source = uri ? { uri } : (fallbackSource ?? null);
  const content = source ? (
    <Image source={source} style={circle} contentFit="cover" />
  ) : (
    <View style={[styles.fallback, circle]}>
      {initials ? (
        <Text variant="bodyStrong" style={{ color: t.colors.primaryInk }}>
          {initials}
        </Text>
      ) : (
        <Icon name="profile" size={size * 0.6} color={t.colors.primaryInk} />
      )}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? tr('profileAndSettings')}
      onPress={onPress}
      hitSlop={size < t.touch.min ? (t.touch.min - size) / 2 : undefined}
    >
      {content}
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: t.colors.borderAccent,
    backgroundColor: t.colors.surfaceRaised,
  },
}));
