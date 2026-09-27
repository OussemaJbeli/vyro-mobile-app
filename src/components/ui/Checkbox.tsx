import { Pressable, View } from 'react-native';

import { makeStyles, useTheme } from '@/theme';
import { haptics } from '@/utils/haptics';

import { Icon } from './Icon';
import { Text } from './Text';

type BaseProps = {
  label: string;
  disabled?: boolean;
  testID?: string;
};

export type CheckboxProps = BaseProps & { checked: boolean; onChange: (checked: boolean) => void };

export function Checkbox({ label, checked, onChange, disabled, testID }: CheckboxProps) {
  const t = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled: !!disabled }}
      disabled={disabled}
      onPress={() => {
        haptics.tap();
        onChange(!checked);
      }}
      style={[styles.row, disabled && styles.disabled]}
      {...(testID ? { testID } : {})}
    >
      <View style={[styles.box, checked && styles.boxOn]}>
        {checked ? <Icon name="check" size={16} color={t.colors.onPrimary} /> : null}
      </View>
      <Text>{label}</Text>
    </Pressable>
  );
}

export type RadioProps = BaseProps & { selected: boolean; onSelect: () => void };

export function Radio({ label, selected, onSelect, disabled, testID }: RadioProps) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled: !!disabled }}
      disabled={disabled}
      onPress={() => {
        haptics.tap();
        onSelect();
      }}
      style={[styles.row, disabled && styles.disabled]}
      {...(testID ? { testID } : {})}
    >
      <View style={[styles.circle, selected && styles.circleOn]}>
        {selected ? <View style={styles.dot} /> : null}
      </View>
      <Text>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, minHeight: t.touch.min },
  box: {
    width: 24,
    height: 24,
    borderRadius: t.radius.sm - 2,
    borderWidth: 2,
    borderColor: t.colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: t.colors.primary, borderColor: t.colors.primary },
  circle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: t.colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleOn: { borderColor: t.colors.primaryInk },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: t.colors.primaryInk },
  disabled: { opacity: 0.45 },
}));
