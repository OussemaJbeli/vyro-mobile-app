import { Pressable, type PressableProps } from 'react-native';

import { makeStyles, useTheme } from '@/theme';
import { haptics } from '@/utils/haptics';

import { Icon, type IconName } from './Icon';

export type IconButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  icon: IconName;
  /** Required: an icon-only button has no visible text. */
  accessibilityLabel: string;
  variant?: 'outline' | 'filled' | 'plain';
  size?: number;
};

export function IconButton({
  icon,
  variant = 'outline',
  size = 44,
  onPress,
  disabled,
  ...rest
}: IconButtonProps) {
  const t = useTheme();
  const styles = useStyles();
  const color = variant === 'filled' ? t.colors.onPrimary : t.colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      hitSlop={size < t.touch.min ? (t.touch.min - size) / 2 : undefined}
      onPress={(e) => {
        haptics.tap();
        onPress?.(e);
      }}
      style={({ pressed }) => [
        styles.base,
        { width: size, height: size },
        styles[variant],
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
      {...rest}
    >
      <Icon name={icon} size={Math.round(size * 0.5)} color={color} />
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  base: { borderRadius: t.radius.pill, alignItems: 'center', justifyContent: 'center' },
  outline: { borderWidth: 1, borderColor: t.colors.border, backgroundColor: t.colors.surface },
  filled: { backgroundColor: t.colors.primary },
  plain: {},
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.4 },
}));
