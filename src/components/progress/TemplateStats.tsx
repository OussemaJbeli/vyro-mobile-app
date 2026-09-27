import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui';
import { useTemplateStats } from '@/hooks/data';
import { toLocalDate } from '@/utils/dates';

/** "Completed 5 times · last 2026-09-24" on template detail (step 24). */
export function TemplateStats({ templateId }: { templateId: string }) {
  const { t } = useTranslation('progress');
  const stats = useTemplateStats(templateId);
  if (!stats.data) return null;
  return (
    <Text variant="caption" tone="muted" testID="template-stats">
      {stats.data.count && stats.data.last
        ? t('template.stats', { count: stats.data.count, date: toLocalDate(stats.data.last) })
        : t('template.never')}
    </Text>
  );
}
