/**
 * Commits the onboarding answers in ONE transaction (step 11): a kill mid-flow can never
 * leave a half-written profile. Runs after the user taps "Finish".
 */
import {
  planStarter,
  planToRules,
  type IsoWeekday,
  type StarterPlan,
} from '@/domain/scheduling/starterPlan';
import { type OnboardingDraft } from '@/types/onboarding';

import { type Database } from './client';
import { tables } from './mappers';
import { insertModel, nowIso } from './repositories/base';
import { equipmentRepo } from './repositories/equipment';
import { profileRepo } from './repositories/profile';
import { settingsRepo } from './repositories/settings';
import { seedId } from './seed/ids';

export type OnboardingResult = { rules: number; plan: StarterPlan | null };

export const planFromDraft = (draft: OnboardingDraft): StarterPlan =>
  planStarter({
    goal: draft.goal?.kind ?? 'consistency',
    trainingDays: draft.trainingDays as IsoWeekday[],
    equipment: draft.equipmentPreset,
  });

export async function commitOnboarding(
  db: Database,
  draft: OnboardingDraft,
  { today, goalTitle }: { today: string; goalTitle: string },
): Promise<OnboardingResult> {
  return db.tx(async (tx) => {
    const at = nowIso();
    await profileRepo(tx).upsert({
      name: draft.name?.trim() || null,
      heightCm: draft.heightCm,
      weightUnit: draft.units.weight,
      lengthUnit: draft.units.length,
      distanceUnit: draft.units.distance,
      speedUnit: draft.units.speed,
      onboardingCompletedAt: at,
    });

    const latest = await tx.get<{ value_kg: number }>(
      'SELECT value_kg FROM weight_entries WHERE deleted_at IS NULL ORDER BY recorded_at DESC LIMIT 1',
    );
    // A redo keeps history clean: only log a weigh-in when the value actually changed.
    const weightChanged =
      draft.mode !== 'redo' || Math.abs((latest?.value_kg ?? -1) - (draft.weightKg ?? -1)) > 0.05;
    if (draft.weightKg !== null && weightChanged) {
      await insertModel(tx, tables.weightEntries, {
        valueKg: draft.weightKg,
        unitEntered: draft.units.weight,
        recordedAt: at,
        notes: null,
      });
    }

    if (draft.goal) {
      const g = draft.goal;
      const weightGoal = g.kind === 'lose_weight' && g.targetWeightKg !== null;
      await insertModel(tx, tables.goals, {
        type:
          g.kind === 'lose_weight'
            ? 'weight'
            : g.kind === 'build_muscle'
              ? 'muscle'
              : g.kind === 'run_better'
                ? 'running'
                : g.kind === 'consistency'
                  ? 'frequency'
                  : 'custom',
        title: g.customTitle?.trim() || goalTitle,
        targetValue: weightGoal
          ? g.targetWeightKg
          : g.kind === 'consistency'
            ? g.sessionsPerWeek
            : null,
        unit: weightGoal ? 'kg' : g.kind === 'consistency' ? 'sessions/week' : null,
        startValue: weightGoal ? draft.weightKg : null,
        measurementTypeId: null,
        startDate: today,
        targetDate: null,
        status: 'active',
        achievedAt: null,
        notes: null,
      });
    }

    if (draft.equipmentIds) await equipmentRepo(tx).setAvailableOnly(draft.equipmentIds);

    let rules = 0;
    let plan: StarterPlan | null = null;
    if (draft.acceptPlan && draft.trainingDays.length > 0) {
      plan = planFromDraft(draft);
      if (draft.mode === 'redo') {
        // Replace the current weekly plan (the user confirmed on the days step).
        await tx.run(
          'UPDATE schedule_rules SET deleted_at = ?, updated_at = ? WHERE deleted_at IS NULL',
          [at, at],
        );
      }
      for (const rule of planToRules(plan)) {
        const isRest = rule.template === 'rest';
        const templateId = isRest ? null : seedId.template(rule.template);
        const tpl = templateId
          ? await tx.get<{ name: string; type: string; duration_minutes: number | null }>(
              'SELECT name, type, duration_minutes FROM workout_templates WHERE id = ?',
              [templateId],
            )
          : null;
        await insertModel(tx, tables.scheduleRules, {
          templateId,
          title: isRest ? 'Rest' : (tpl?.name ?? rule.template),
          type: isRest ? 'rest' : ((tpl?.type ?? 'other') as 'gym'),
          freq: 'weekly',
          interval: 1,
          byWeekday: rule.weekdays,
          byMonthDay: null,
          startDate: today,
          endDate: null,
          startTime: isRest ? null : draft.trainingTime,
          durationMinutes: tpl?.duration_minutes ?? null,
          reminderOffsetMinutes: isRest ? null : 15,
          active: true,
          // Materialized into sessions by the scheduling engine (step 16).
          materializedUntil: null,
        });
        rules += 1;
      }
    }

    const settings = settingsRepo(tx);
    await settings.set('notifications.enabled', draft.notifications);
    await settings.set('lock.enabled', draft.appLock);
    await settings.set('onboarding.draft', null);
    return { rules, plan };
  });
}
