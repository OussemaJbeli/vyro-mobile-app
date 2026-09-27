import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { useTheme, type TypographyVariant } from '@/theme';

export type TextTone = 'default' | 'muted' | 'primary' | 'danger' | 'onPrimary';

export type TextProps = RNTextProps & {
  variant?: TypographyVariant;
  tone?: TextTone;
  align?: 'left' | 'center' | 'right';
};

/** Dense text (rows, metrics) caps font scaling so layouts survive large text settings. */
const MAX_SCALE: Partial<Record<TypographyVariant, number>> = {
  metric: 1.3,
  timer: 1.2,
  overline: 1.4,
  caption: 1.6,
};

export function Text({ variant = 'body', tone = 'default', align, style, ...rest }: TextProps) {
  const t = useTheme();
  const color = {
    default: t.colors.text,
    muted: t.colors.textMuted,
    primary: t.colors.primaryInk,
    danger: t.colors.danger,
    onPrimary: t.colors.onPrimary,
  }[tone];
  return (
    <RNText
      maxFontSizeMultiplier={MAX_SCALE[variant] ?? 1.6}
      {...rest}
      style={[t.typography[variant], { color }, align ? { textAlign: align } : null, style]}
    />
  );
}
