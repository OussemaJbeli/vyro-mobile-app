import { useTranslation } from 'react-i18next';

import { LineChart } from '@/components/charts/LineChart';
import { Card, Text } from '@/components/ui';
import { epley, exerciseRecords } from '@/domain/analytics/records';
import { useDoneSets, useUnitPrefs } from '@/hooks/data';
import { makeStyles } from '@/theme';
import { toLocalDate } from '@/utils/dates';
import { formatQuantity } from '@/utils/units';

/** Exercise detail "Your stats" (step 24): last performed, best set, est. 1RM and volume per session. */
export function ExerciseStats({ exerciseId }: { exerciseId: string }) {
  const { t, i18n } = useTranslation('progress');
  const styles = useStyles();
  const prefs = useUnitPrefs();
  const sets = useDoneSets({ exerciseId });
  const rows = sets.data ?? [];
  if (!rows.length) {
    return (
      <Card>
        <Text tone="muted">{t('exercise.never')}</Text>
      </Card>
    );
  }
  const locale = i18n.language;
  const load = (kg: number) => formatQuantity(kg, 'load', prefs, locale);
  const bySession = new Map<string, typeof rows>();
  for (const r of rows) bySession.set(r.executionId, [...(bySession.get(r.executionId) ?? []), r]);
  const sessions = [...bySession.values()];
  const oneRm = sessions.map(
    (s) =>
      Math.max(0, ...s.map((x) => (x.weightKg && x.reps ? epley(x.weightKg, x.reps) : 0))) || null,
  );
  const volume = sessions.map(
    (s) => s.reduce((v, x) => v + (x.reps ?? 0) * (x.weightKg ?? 0), 0) || null,
  );
  const [rec] = exerciseRecords(rows.map((r) => ({ ...r, date: r.startedAt })));
  const best = rows.reduce(
    (b, r) =>
      (r.weightKg ?? 0) * 1000 + (r.reps ?? 0) > (b.weightKg ?? 0) * 1000 + (b.reps ?? 0) ? r : b,
    rows[0]!,
  );
  return (
    <Card style={styles.gap} testID="exercise-stats">
      <Text>{t('exercise.last', { date: toLocalDate(rows.at(-1)!.startedAt) })}</Text>
      <Text>
        {t('exercise.best', {
          value: best.weightKg
            ? `${load(best.weightKg)} × ${best.reps ?? 0}`
            : best.durationSeconds
              ? `${best.durationSeconds} s`
              : `× ${best.reps ?? 0}`,
        })}
      </Text>
      {rec?.best1RmKg ? (
        <>
          <Text variant="bodyStrong">{t('exercise.oneRmTrend')}</Text>
          <LineChart
            values={oneRm}
            summary={t('records.oneRm', { value: load(rec.best1RmKg) })}
            height={100}
          />
          <Text variant="caption" tone="muted">
            {t('records.estimatedNote')}
          </Text>
        </>
      ) : null}
      {volume.some((v) => v) ? (
        <>
          <Text variant="bodyStrong">{t('exercise.volume')}</Text>
          <LineChart values={volume} summary={t('exercise.volume')} height={100} />
        </>
      ) : null}
    </Card>
  );
}

const useStyles = makeStyles((t) => ({ gap: { gap: t.spacing.sm } }));
