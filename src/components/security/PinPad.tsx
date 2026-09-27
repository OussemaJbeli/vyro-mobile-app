import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { makeStyles, useTheme } from '@/theme';
import { haptics } from '@/utils/haptics';

const MAX = 6;

/** Large-key PIN pad (4–6 digits): ⌫ deletes, ✓ submits. */
export function PinPad({
  value,
  onChange,
  onSubmit,
  disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (v: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation('settings');
  const styles = useStyles();
  const theme = useTheme();
  const key = (label: string, onPress: () => void, a11y: string, content?: React.ReactNode) => (
    <Pressable
      key={label}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => [styles.key, pressed && styles.pressed, disabled && styles.disabled]}
      testID={`pin-${label}`}
    >
      {content ?? <Text variant="title">{label}</Text>}
    </Pressable>
  );
  return (
    <View style={styles.wrap}>
      <View
        style={styles.dots}
        accessible
        accessibilityLabel={t('lock.pinDots', { count: value.length, max: MAX })}
      >
        {Array.from({ length: MAX }, (_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i < value.length && {
                backgroundColor: theme.colors.primary,
                borderColor: theme.colors.primary,
              },
              i >= 4 && i >= value.length && styles.optional,
            ]}
          />
        ))}
      </View>
      {[
        ['1', '2', '3'],
        ['4', '5', '6'],
        ['7', '8', '9'],
      ].map((row) => (
        <View key={row.join()} style={styles.row}>
          {row.map((d) =>
            key(d, () => value.length < MAX && onChange(value + d), t('lock.digit', { n: d })),
          )}
        </View>
      ))}
      <View style={styles.row}>
        {key(
          'del',
          () => onChange(value.slice(0, -1)),
          t('lock.delete'),
          <Icon name="back" size={26} />,
        )}
        {key('0', () => value.length < MAX && onChange(value + '0'), t('lock.digit', { n: '0' }))}
        {key(
          'ok',
          () => value.length >= 4 && onSubmit(value),
          t('lock.done'),
          <Icon
            name="check"
            size={28}
            color={value.length >= 4 ? theme.colors.primaryInk : theme.colors.textMuted}
          />,
        )}
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  wrap: { alignItems: 'center', gap: t.spacing.md },
  dots: { flexDirection: 'row', gap: t.spacing.md, marginBottom: t.spacing.sm },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: t.colors.border },
  optional: { opacity: 0.4 },
  row: { flexDirection: 'row', gap: t.spacing.lg },
  key: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.surfaceRaised,
  },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.4 },
}));
