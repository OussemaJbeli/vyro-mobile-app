import { Pressable, View } from 'react-native';

import { makeStyles, useTheme } from '@/theme';
import { haptics } from '@/utils/haptics';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type IconTileProps = {
  icon: IconName;
  label?: string;
  /** Circle diameter. */
  size?: number;
  /** `accent` tints the circle like the template's activity icons. */
  tone?: 'default' | 'accent';
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
};

/** Circular outline tile with an optional label below (Quick Actions, activity icons). */
export function IconTile({
  icon,
  label,
  size = 56,
  tone = 'default',
  onPress,
  accessibilityLabel,
  testID,
}: IconTileProps) {
  const t = useTheme();
  const styles = useStyles();
  const circle = (
    <View
      style={[
        styles.circle,
        { width: size, height: size },
        tone === 'accent' && {
          backgroundColor: t.colors.primarySoft,
          borderColor: t.colors.borderAccent,
        },
      ]}
    >
      <Icon
        name={icon}
        size={Math.round(size * 0.46)}
        color={tone === 'accent' ? t.colors.primaryInk : t.colors.text}
      />
    </View>
  );
  const inner = (
    <>
      {circle}
      {label ? (
        <Text variant="caption" tone="muted" numberOfLines={1} align="center">
          {label}
        </Text>
      ) : null}
    </>
  );
  const a11y = {
    ...((accessibilityLabel ?? label) ? { accessibilityLabel: accessibilityLabel ?? label } : {}),
    ...(testID ? { testID } : {}),
  };
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
      {...a11y}
    >
      {inner}
    </Pressable>
  ) : (
    <View style={styles.wrap} {...a11y}>
      {inner}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  wrap: { alignItems: 'center', gap: t.spacing.xs + 2, minWidth: t.touch.min },
  circle: {
    borderRadius: t.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
  },
  pressed: { opacity: 0.7 },
}));
