import { useCallback } from 'react';
import { type TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { type CoverType } from '@/components/ui';
import { type WorkoutTemplate } from '@/types/domain';
import { displayName } from '@/utils/seedNames';

/** Template type → cover/icon family. */
export const coverType = (type: WorkoutTemplate['type']): CoverType => type;

/** Translated name for seeded templates (until renamed), the user's name otherwise. */
export function useTemplateLabel() {
  const { t } = useTranslation('seed');
  return useCallback(
    (tpl: Pick<WorkoutTemplate, 'id' | 'name'>) =>
      displayName('template', tpl, (k, o) =>
        t(k as 'seed:template.abs', { defaultValue: o?.defaultValue ?? k }),
      ),
    [t],
  );
}

/** "Gym · 55 min · 6 exercises" / "Running · 35 min · Intervals". */
export function templateSubtitle(
  tpl: WorkoutTemplate,
  exerciseCount: number,
  t: TFunction<'train'>,
): string {
  const parts = [t(`types.${tpl.type}`)];
  if (tpl.durationMinutes) parts.push(t('minutes', { count: tpl.durationMinutes }));
  parts.push(tpl.type === 'running' ? t('intervals') : t('exercises', { count: exerciseCount }));
  return parts.join(' · ');
}
