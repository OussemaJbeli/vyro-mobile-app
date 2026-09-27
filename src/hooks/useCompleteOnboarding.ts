import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { commitOnboarding } from '@/db/onboarding';
import { applyRoutine } from '@/db/routine';
import { scheduleRepo } from '@/db/repositories/schedule';
import { useAppStore } from '@/store/appStore';
import { useSettingsStore } from '@/store/settingsStore';
import { toast } from '@/store/uiStore';
import { type OnboardingDraft } from '@/types/onboarding';
import { weekStart } from '@/domain/scheduling/recurrence';
import { today } from '@/utils/dates';
import { toUserMessage } from '@/utils/errors';

import { useDatabase } from './database';

/** Commits the draft in one transaction, then refreshes every query and the settings mirror. */
export function useCompleteOnboarding() {
  const db = useDatabase();
  const client = useQueryClient();
  const { t } = useTranslation(['onboarding', 'errors']);
  const [busy, setBusy] = useState(false);

  const complete = async (draft: OnboardingDraft): Promise<boolean> => {
    setBusy(true);
    try {
      const goalTitle = (kind: string): string =>
        t(`onboarding:goal.options.${kind}` as 'onboarding:goal.options.custom');
      await commitOnboarding(db, draft, { today: today(), goalTitle });
      // The VYRO week: the same week every week, filled from this Monday.
      const vyro = draft.plan === 'vyro' && draft.acceptPlan;
      if (vyro) await applyRoutine(db, { today: today(), force: true });
      // The plan's rules become real sessions right away.
      await scheduleRepo(db).materialize(vyro ? weekStart(today(), 1) : today());
      const settings = useSettingsStore.getState();
      settings.hydrate({
        ...settings.values,
        'onboarding.draft': null,
        'notifications.enabled': draft.notifications,
        'lock.enabled': draft.appLock,
      });
      useAppStore.getState().setOnboardingCompleted(true);
      await client.invalidateQueries();
      return true;
    } catch (e) {
      toast.error(toUserMessage(e, (k) => t(k as 'errors:UNKNOWN')));
      return false;
    } finally {
      setBusy(false);
    }
  };

  return { complete, busy };
}
