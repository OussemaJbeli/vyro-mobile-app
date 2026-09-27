import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { makeStyles, useTheme, type SessionStatus } from '@/theme';
import { withAlpha } from '@/theme/color';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type StatusTagProps = {
  status: SessionStatus;
  /** Overrides the default label (for example "Next" vs "In progress"). */
  label?: string;
  /** `filled` like the template's "Completed" tag, `outline` like "Next"/"Pending". */
  appearance?: 'auto' | 'filled' | 'outline';
  testID?: string;
};

/** Status always shows an icon and a text label, never colour alone (FS §74, UI §4). */
export function StatusTag({ status, label, appearance = 'auto', testID }: StatusTagProps) {
  const t = useTheme();
  const styles = useStyles();
  const { t: tr } = useTranslation('status');
  const s = t.status[status];
  const text = label ?? tr(status);
  const filled = appearance === 'filled' || (appearance === 'auto' && status === 'completed');
  const fg = filled ? t.colors.onPrimary : s.color;

  return (
    <View
      accessible
      accessibilityLabel={text}
      style={[
        styles.base,
        filled
          ? { backgroundColor: t.colors.primary, borderColor: t.colors.primary }
          : { borderColor: withAlpha(fgHex(s.color, t.colors.textMuted), 0.6) },
      ]}
      {...(testID ? { testID } : {})}
    >
      <Icon name={s.icon as IconName} size={14} color={fg} />
      <Text
        variant="caption"
        style={[{ color: fg }, s.strikethrough ? styles.strike : null]}
        numberOfLines={1}
      >
        {text}
      </Text>
    </View>
  );
}

// Status colours are hex tokens; guard so an rgba token never reaches withAlpha.
const fgHex = (c: string, fallback: string) => (c.startsWith('#') ? c : fallback);

const useStyles = makeStyles((t) => ({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: t.spacing.xs,
    paddingHorizontal: t.spacing.sm + 2,
    paddingVertical: t.spacing.xs,
    borderRadius: t.radius.pill,
    borderWidth: 1,
  },
  strike: { textDecorationLine: 'line-through' },
}));
