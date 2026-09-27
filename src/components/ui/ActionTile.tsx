import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';

import { makeStyles, useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

/**
 * Template quick action (docs/template/ui.png): bordered card with an accent icon, title,
 * short subtitle and a round arrow.
 */
export function ActionTile({
  icon,
  label,
  subtitle,
  onPress,
  testID,
}: {
  icon: IconName;
  label: string;
  subtitle?: string;
  onPress: () => void;
  testID?: string;
}) {
  const t = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${label}, ${subtitle}` : label}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      {...(testID ? { testID } : {})}
    >
      <LinearGradient
        colors={[t.colors.primarySoft, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Icon name={icon} size={30} color={t.colors.primary} />
      <View style={styles.cardText}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {label}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="muted" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={styles.arrow}>
        <Icon name="forward" size={16} color={t.colors.primary} />
      </View>
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
  card: {
    flex: 1,
    minWidth: 0,
    gap: t.spacing.sm,
    padding: t.spacing.md,
    borderRadius: t.radius.lg,
    borderWidth: 1,
    borderColor: t.colors.borderAccent,
    backgroundColor: t.colors.surface,
    overflow: 'hidden',
  },
  cardText: { gap: 2, minHeight: 44 },
  arrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: t.colors.borderAccent,
    backgroundColor: t.colors.primarySoft,
  },
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
