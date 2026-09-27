import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { makeStyles, useTheme } from '@/theme';

import { Icon } from './Icon';
import { Text } from './Text';

export type StreakChipProps = {
  days: number;
  /** Overrides the pluralized "7 days" label. */
  label?: string;
  testID?: string;
};

/** 🔥 streak pill (template "Status & Tags"). */
export function StreakChip({ days, label, testID }: StreakChipProps) {
  const t = useTheme();
  const styles = useStyles();
  const { t: tr } = useTranslation();
  const text = label ?? tr('streakDays', { count: days });
  return (
    <View
      accessible
      accessibilityLabel={tr('streakLabel', { text })}
      style={styles.chip}
      {...(testID ? { testID } : {})}
    >
      <Icon name="streak" size={16} color={t.colors.warning} />
      <Text variant="caption" style={styles.label}>
        {text}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: t.spacing.xs,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.xs + 2,
    borderRadius: t.radius.pill,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
  },
  label: { fontVariant: ['tabular-nums'], color: t.colors.text },
}));
