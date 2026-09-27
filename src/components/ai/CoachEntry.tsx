import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button, ListRow, IconTile } from '@/components/ui';
import { type AIMethod } from '@/services/ai';
import { useSetting } from '@/store/settingsStore';

type Props = {
  method?: AIMethod;
  label: string;
  templateId?: string;
  exerciseId?: string;
  variant?: 'button' | 'row';
  subtitle?: string;
  testID?: string;
};

/**
 * Contextual ✨ entry point (UI §27). Hidden while AI is off, so the app is identical to
 * V1; opens the Coach, which runs the method (consent + payload preview first).
 */
export function CoachEntry({
  method,
  label,
  templateId,
  exerciseId,
  variant = 'button',
  subtitle,
  testID,
}: Props) {
  const enabled = useSetting('ai.enabled');
  const { t } = useTranslation('settings');
  if (!enabled) return null;
  const open = () =>
    router.push({
      pathname: '/coach',
      params: {
        ...(method ? { method } : {}),
        ...(templateId ? { templateId } : {}),
        ...(exerciseId ? { exerciseId } : {}),
      },
    });
  if (variant === 'row') {
    return (
      <ListRow
        title={`✨ ${label}`}
        subtitle={subtitle ?? t('ai.coach.askCoachHint')}
        leading={<IconTile icon="ai" size={36} tone="accent" />}
        onPress={open}
        {...(testID ? { testID } : {})}
      />
    );
  }
  return (
    <Button
      label={`✨ ${label}`}
      size="sm"
      variant="secondary"
      onPress={open}
      {...(testID ? { testID } : {})}
    />
  );
}
