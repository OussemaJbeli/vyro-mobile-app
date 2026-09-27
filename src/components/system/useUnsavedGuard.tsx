import { useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ConfirmDialog } from '@/components/ui';

type Action = Parameters<Parameters<typeof usePreventRemove>[1]>[0]['data']['action'];

/**
 * Blocks leaving a form with unsaved edits (back, gesture, hardware back) and asks
 * "Discard changes?". After a successful save, call `leave(() => router…)`: it turns the
 * guard off first and navigates on the next render, so the save itself isn't blocked.
 */
export function useUnsavedGuard(dirty: boolean) {
  const navigation = useNavigation();
  const { t } = useTranslation('settings');
  const [pending, setPending] = useState<Action | null>(null);
  const [leaving, setLeaving] = useState<(() => void) | null>(null);

  usePreventRemove(dirty && leaving === null, ({ data }) => setPending(data.action));

  // Runs after the render where the guard is off, so the navigation goes through.
  useEffect(() => {
    if (leaving) leaving();
  }, [leaving]);

  const dialog = (
    <ConfirmDialog
      visible={pending !== null}
      title={t('unsavedTitle')}
      message={t('unsavedBody')}
      confirmLabel={t('discard')}
      cancelLabel={t('keepEditing')}
      destructive
      onCancel={() => setPending(null)}
      onConfirm={() => {
        const action = pending;
        setPending(null);
        if (action) navigation.dispatch(action);
      }}
    />
  );

  return { dialog, leave: (go: () => void) => setLeaving(() => go) };
}
