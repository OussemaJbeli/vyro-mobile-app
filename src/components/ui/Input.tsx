import { forwardRef, useState } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { makeStyles, useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type InputProps = Omit<TextInputProps, 'style'> & {
  label?: string;
  helper?: string;
  error?: string;
  leftIcon?: IconName;
  rightIcon?: IconName;
  /** Numeric keyboard (decimal pad). */
  numeric?: boolean;
};

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, helper, error, leftIcon, rightIcon, numeric, onFocus, onBlur, ...rest },
  ref,
) {
  const t = useTheme();
  const styles = useStyles();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? t.colors.danger : focused ? t.colors.primaryInk : t.colors.border;

  return (
    <View style={styles.wrap}>
      {label ? (
        <Text variant="caption" tone="muted">
          {label}
        </Text>
      ) : null}
      <View style={[styles.field, { borderColor }]}>
        {leftIcon ? <Icon name={leftIcon} size={20} color={t.colors.textMuted} /> : null}
        <TextInput
          ref={ref}
          accessibilityLabel={rest.accessibilityLabel ?? label}
          placeholderTextColor={t.colors.textMuted}
          selectionColor={t.colors.primaryInk}
          keyboardType={numeric ? 'decimal-pad' : rest.keyboardType}
          style={styles.input}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {rightIcon ? <Icon name={rightIcon} size={20} color={t.colors.textMuted} /> : null}
      </View>
      {error || helper ? (
        <Text
          variant="caption"
          tone={error ? 'danger' : 'muted'}
          accessibilityLiveRegion={error ? 'polite' : 'none'}
        >
          {error ?? helper}
        </Text>
      ) : null}
    </View>
  );
});

const useStyles = makeStyles((t) => ({
  wrap: { gap: t.spacing.xs + 2 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    minHeight: t.touch.comfortable,
    paddingHorizontal: t.spacing.lg,
    borderRadius: t.radius.lg,
    borderWidth: 1,
    backgroundColor: t.colors.surface,
  },
  input: { flex: 1, ...t.typography.body, color: t.colors.text, paddingVertical: t.spacing.sm },
}));
