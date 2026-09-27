import { View } from 'react-native';

import { makeStyles, useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type StatTileProps = {
  value: string;
  label: string;
  icon?: IconName;
  testID?: string;
};

/** Big number + label ("This Week": 4 Gym · 2 Runs · 3 Abs · 4h 18m). */
export function StatTile({ value, label, icon, testID }: StatTileProps) {
  const t = useTheme();
  const styles = useStyles();
  return (
    <View
      accessible
      accessibilityLabel={`${value} ${label}`}
      style={styles.tile}
      {...(testID ? { testID } : {})}
    >
      {icon ? <Icon name={icon} size={20} color={t.colors.primaryInk} /> : null}
      <Text variant="heading" style={styles.nums}>
        {value}
      </Text>
      <Text variant="caption" tone="muted" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  tile: {
    flex: 1,
    alignItems: 'center',
    gap: t.spacing.xxs,
    paddingVertical: t.spacing.md,
    borderRadius: t.radius.lg,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
  },
  nums: { fontVariant: ['tabular-nums'] },
}));
