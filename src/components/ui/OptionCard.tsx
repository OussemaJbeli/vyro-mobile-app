import { Pressable, View } from 'react-native';

import { makeStyles, useTheme } from '@/theme';
import { haptics } from '@/utils/haptics';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type OptionCardProps = {
  title: string;
  description?: string;
  icon?: IconName;
  selected: boolean;
  onPress: () => void;
  /** radio = one of many (default), checkbox = multi-select */
  role?: 'radio' | 'checkbox';
  testID?: string;
};

/** Large selectable card (onboarding goal, equipment preset). Selection shows a check, not just colour. */
export function OptionCard({
  title,
  description,
  icon,
  selected,
  onPress,
  role = 'radio',
  testID,
}: OptionCardProps) {
  const t = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={role === 'radio' ? { selected } : { checked: selected }}
      accessibilityLabel={description ? `${title}. ${description}` : title}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      style={({ pressed }) => [styles.card, selected && styles.selected, pressed && styles.pressed]}
      {...(testID ? { testID } : {})}
    >
      {icon ? (
        <View style={[styles.icon, selected && styles.iconOn]}>
          <Icon name={icon} size={22} color={selected ? t.colors.onPrimary : t.colors.primaryInk} />
        </View>
      ) : null}
      <View style={styles.text}>
        <Text variant="bodyStrong">{title}</Text>
        {description ? (
          <Text variant="caption" tone="muted">
            {description}
          </Text>
        ) : null}
      </View>
      <Icon
        name={selected ? 'status-done' : 'status-pending'}
        size={22}
        color={selected ? t.colors.primaryInk : t.colors.textMuted}
      />
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    minHeight: 64,
    padding: t.spacing.lg,
    borderRadius: t.radius.lg,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
  },
  selected: {
    borderColor: t.colors.primaryInk,
    backgroundColor: t.colors.primarySoft,
  },
  pressed: { opacity: 0.85 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.primarySoft,
  },
  iconOn: { backgroundColor: t.colors.primary },
  text: { flex: 1, gap: 2 },
}));
