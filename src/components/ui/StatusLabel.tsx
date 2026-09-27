import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type StatusKind =
  | 'completed'
  | 'modified'
  | 'next'
  | 'in_progress'
  | 'pending'
  | 'skipped'
  | 'cancelled'
  | 'missed';

const ICON: Record<StatusKind, IconName> = {
  completed: 'check',
  modified: 'status-modified',
  next: 'status-next',
  in_progress: 'status-next',
  pending: 'status-pending',
  skipped: 'status-skipped',
  cancelled: 'status-cancelled',
  missed: 'status-missed',
};

/** Template status text: "✓ Completed" / "◉ Next" (accent), "○ Pending" (muted). Icon + text, never colour alone. */
export function StatusLabel({
  status,
  label,
  pill = false,
}: {
  status: StatusKind;
  label?: string;
  /** Template Today card: bordered pill ("✓ Next" accent, "○ Pending" muted). */
  pill?: boolean;
}) {
  const t = useTheme();
  const { t: tr } = useTranslation('status');
  const accent =
    status === 'completed' ||
    status === 'modified' ||
    status === 'next' ||
    status === 'in_progress';
  const color = accent
    ? t.colors.primaryInk
    : status === 'missed'
      ? t.colors.warning
      : t.colors.textMuted;
  const text =
    label ??
    (status === 'next'
      ? tr('next', { defaultValue: 'Next' })
      : status === 'pending'
        ? tr('pending', { defaultValue: 'Pending' })
        : tr(status as 'planned', { defaultValue: status }));
  return (
    <View
      style={[
        { flexDirection: 'row', alignItems: 'center', gap: 4 },
        pill && {
          gap: 6,
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 999,
          borderWidth: 1.5,
          borderColor: accent ? t.colors.primaryInk : t.colors.border,
          backgroundColor: accent ? t.colors.primarySoft : t.colors.surfaceRaised,
        },
      ]}
      accessible
      accessibilityLabel={text}
    >
      <Icon
        name={
          pill && status === 'next'
            ? 'check'
            : pill && status === 'pending'
              ? 'radio_off'
              : ICON[status]
        }
        size={pill ? 16 : 14}
        color={color}
      />
      <Text variant={pill ? 'bodyStrong' : 'caption'} style={{ color }}>
        {text}
      </Text>
    </View>
  );
}
