import { type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { makeStyles, useTheme } from '@/theme';

import { Icon } from './Icon';
import { Text } from './Text';

export type ListRowProps = {
  title: string;
  subtitle?: string;
  /** Icon tile, thumbnail or avatar. */
  leading?: ReactNode;
  /** Tag, value or custom node. A chevron is added automatically when pressable. */
  trailing?: ReactNode;
  onPress?: () => void;
  /** Opens a context menu (announced as an accessibility action). */
  onLongPress?: () => void;
  showChevron?: boolean;
  accessibilityLabel?: string;
  testID?: string;
};

/** Row used by lists (template workout list, Body Measurements rows). */
export function ListRow({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  onLongPress,
  showChevron = !!onPress,
  accessibilityLabel,
  testID,
}: ListRowProps) {
  const t = useTheme();
  const styles = useStyles();
  const content = (
    <>
      {leading ? <View>{leading}</View> : null}
      <View style={styles.text}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
      {showChevron ? <Icon name="forward" size={20} color={t.colors.textMuted} /> : null}
    </>
  );
  const common = {
    accessibilityLabel: accessibilityLabel ?? [title, subtitle].filter(Boolean).join(', '),
    ...(testID ? { testID } : {}),
  };
  const pressProps = {
    accessibilityRole: 'button' as const,
    onPress,
    ...(onLongPress
      ? {
          onLongPress,
          delayLongPress: 350,
          accessibilityActions: [{ name: 'longpress' as const }],
          onAccessibilityAction: () => onLongPress(),
        }
      : {}),
  };
  // A trailing control (button, toggle) must not sit inside the row's own button: that's
  // invalid nesting (web warns "<button> cannot contain a nested <button>") and it steals
  // taps on native. The row then splits into a pressable area + the trailing control.
  if (onPress && trailing) {
    return (
      <View style={styles.row}>
        <Pressable
          {...pressProps}
          style={({ pressed }) => [styles.row, styles.flex, pressed && styles.pressed]}
          {...common}
        >
          {leading ? <View>{leading}</View> : null}
          <View style={styles.text}>
            <Text variant="bodyStrong" numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </Pressable>
        {trailing}
        {showChevron ? <Icon name="forward" size={20} color={t.colors.textMuted} /> : null}
      </View>
    );
  }
  return onPress ? (
    <Pressable
      {...pressProps}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      {...common}
    >
      {content}
    </Pressable>
  ) : (
    <View accessible style={styles.row} {...common}>
      {content}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    minHeight: t.touch.comfortable + 8,
    paddingVertical: t.spacing.sm,
  },
  text: { flex: 1, gap: 2 },
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
}));
