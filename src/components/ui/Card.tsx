import { type ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { withAlpha } from '@/theme/color';
import { makeStyles } from '@/theme';

export type CardVariant = 'default' | 'accent' | 'hero';

export type CardProps = {
  children: ReactNode;
  variant?: CardVariant;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Surface container. `accent` = lime-tinted border (template Today/Weight cards). */
export function Card({
  children,
  variant = 'default',
  onPress,
  accessibilityLabel,
  style,
  testID,
}: CardProps) {
  const styles = useStyles();
  const body = [styles.base, styles[variant], style];
  const common = { ...(testID ? { testID } : {}) };
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        {...(accessibilityLabel ? { accessibilityLabel } : {})}
        onPress={onPress}
        style={({ pressed }) => [body, pressed && styles.pressed]}
        {...common}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View style={body} {...common}>
      {children}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  base: {
    borderRadius: t.radius.xl,
    padding: t.spacing.lg,
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.border,
    overflow: 'hidden',
  },
  default: {},
  accent: {
    borderColor: t.colors.borderAccent,
    boxShadow: t.scheme === 'dark' ? `0 0 18px ${withAlpha(t.colors.primary, 0.1)}` : 'none',
  },
  hero: { borderColor: t.colors.borderAccent, padding: t.spacing.xl, minHeight: 160 },
  pressed: { opacity: 0.9 },
}));
