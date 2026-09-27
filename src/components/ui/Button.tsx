import { ActivityIndicator, Pressable, View, type PressableProps } from 'react-native';

import { withAlpha } from '@/theme/color';
import { makeStyles, useTheme } from '@/theme';
import { haptics } from '@/utils/haptics';

import { GlassFill } from './GlassFill';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

export type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  loading?: boolean;
  fullWidth?: boolean;
};

const HEIGHT: Record<ButtonSize, number> = { sm: 36, md: 44, lg: 52, xl: 64 };

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  disabled = false,
  fullWidth = false,
  onPress,
  accessibilityLabel,
  ...rest
}: ButtonProps) {
  const t = useTheme();
  const styles = useStyles();
  const inactive = disabled || loading;
  const fg = {
    primary: t.colors.onPrimary,
    secondary: t.colors.primaryInk,
    ghost: t.colors.text,
    danger: t.colors.danger,
  }[variant];
  const height = HEIGHT[size];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      // Small buttons keep a 44 dp touch target (FS §74).
      hitSlop={height < t.touch.min ? (t.touch.min - height) / 2 : undefined}
      onPress={(e) => {
        haptics.tap();
        onPress?.(e);
      }}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        { height, paddingHorizontal: size === 'sm' ? t.spacing.lg : t.spacing.xxl },
        fullWidth && styles.fullWidth,
        pressed && !inactive && styles.pressed,
        inactive && styles.disabled,
      ]}
      {...rest}
    >
      {variant === 'primary' ? <GlassFill radius={height / 2} /> : null}
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.content}>
          {icon ? <Icon name={icon} size={size === 'sm' ? 16 : 20} color={fg} /> : null}
          <Text variant="bodyStrong" style={{ color: fg }} numberOfLines={1}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  base: {
    borderRadius: t.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  content: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
  primary: {
    backgroundColor: t.colors.primary,
    overflow: 'hidden',
    // Accent glow (dark only). `boxShadow` replaces the deprecated shadow* props (RN 0.76+).
    boxShadow: t.scheme === 'dark' ? `0 0 14px ${withAlpha(t.colors.primary, 0.45)}` : 'none',
  },
  secondary: { borderWidth: 1.5, borderColor: t.colors.primaryInk },
  ghost: { backgroundColor: 'transparent' },
  danger: { borderWidth: 1.5, borderColor: t.colors.danger },
  fullWidth: { alignSelf: 'stretch' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.45 },
}));
