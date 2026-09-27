import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';

import { makeStyles, useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

/** Template quick action: outlined rounded square with an accent icon, one label below. */
export function ActionTile({
  icon,
  label,
  onPress,
  testID,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  const t = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
      {...(testID ? { testID } : {})}
    >
      <View style={styles.tile}>
        <LinearGradient
          colors={[t.colors.primarySoft, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Icon name={icon} size={26} color={t.colors.primaryInk} />
      </View>
      <Text variant="caption" numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Template "This Week" mini stat: number in a small ring (or a text value), label below. */
export function MiniStat({
  value,
  label,
  ring = true,
}: {
  value: string;
  label: string;
  ring?: boolean;
}) {
  const styles = useStyles();
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${value} ${label}`}>
      {ring ? (
        <View style={styles.ring}>
          <Text variant="bodyStrong">{value}</Text>
        </View>
      ) : (
        <Text variant="bodyStrong" style={styles.plain} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
      )}
      <Text variant="caption" tone="muted" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  wrap: { flex: 1, alignItems: 'center', gap: t.spacing.xs },
  tile: {
    width: 58,
    height: 58,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: t.colors.borderAccent,
    backgroundColor: t.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pressed: { opacity: 0.75, transform: [{ scale: 0.96 }] },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: t.spacing.sm,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
  },
  ring: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: t.colors.borderAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plain: { height: 30, lineHeight: 30 },
}));
