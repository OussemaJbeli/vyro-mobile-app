import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { commitOnboarding } from '@/db/onboarding';
import { reconcileCycle } from '@/db/cycle';
import { applyRoutine } from '@/db/routine';
import { scheduleRepo } from '@/db/repositories/schedule';
import { useAppStore } from '@/store/appStore';
import { useSettingsStore } from '@/store/settingsStore';
import { toast } from '@/store/uiStore';
import { type OnboardingDraft } from '@/types/onboarding';
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
      // The VYRO cycle (Push → Pull → Legs → Rest), planned ahead right away.
      // Only an explicit "Custom days" opts out (older drafts have no plan field).
      if (draft.plan !== 'custom' && draft.acceptPlan) {
        await applyRoutine(db, { today: today(), force: true });
        await reconcileCycle(db, today());
      }
      // A custom plan's rules become real sessions right away.
      await scheduleRepo(db).materialize(today());
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
