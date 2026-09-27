import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import {
  Button,
  Card,
  EmptyState,
  Header,
  ListRow,
  ScreenContainer,
  SectionHeader,
  SegmentedControl,
  StatTile,
} from '@/components/ui';
import { addDaysIso } from '@/domain/scheduling/recurrence';
import { rate28 } from '@/domain/progress/trend';
import { useUnitPrefs } from '@/hooks/data';
import { makeStyles } from '@/theme';
import { type WeightEntry } from '@/types/domain';
import { now } from '@/utils/clock';
import { today } from '@/utils/dates';
import { formatQuantity } from '@/utils/units';

import { QuickWeightSheet } from './QuickWeightSheet';
import { Sparkline } from '@/components/charts/Sparkline';
import { arrowFor } from './TrendBadge';
import { useWeightTrend } from './useWeightTrend';

const RANGES = { '1M': 30, '3M': 91, '6M': 182, '1Y': 365, all: null } as const;
type RangeKey = keyof typeof RANGES;
const PAGE = 20;

/** Weight detail (step 22): range chart, stats, entries (tap to edit or delete). */
export function WeightScreen() {
  const { t, i18n } = useTranslation('progress');
  const styles = useStyles();
  const prefs = useUnitPrefs();
  const [range, setRange] = useState<RangeKey>('3M');
  const [shown, setShown] = useState(PAGE);
  const { log } = useLocalSearchParams<{ log?: string }>();
  // Weight reminder notification opens straight into the quick-log sheet (step 25).
  const [sheet, setSheet] = useState<{ entry: WeightEntry | null } | null>(
    log === '1' ? { entry: null } : null,
  );
  const days = RANGES[range];
  const trend = useWeightTrend(
    days ? new Date(`${addDaysIso(today(), -days)}T00:00:00`).toISOString() : undefined,
  );
  const all = useWeightTrend(); // stats that must not depend on the range (rate, previous)
  const fmt = (kg: number) => formatQuantity(kg, 'bodyWeight', prefs, i18n.language);
  const latest = all.entries.at(-1);
  const previous = all.entries.at(-2);
  const rate = rate28(all.readings, now().getTime());
  const values = trend.entries.map((e) => e.valueKg);
  const newestFirst = [...trend.entries].reverse();

  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <Header title={t('weight.title')} onBack={() => router.back()} large={false} />
      <SegmentedControl
        segments={(Object.keys(RANGES) as RangeKey[]).map((value) => ({
          value,
          label: t(`weight.ranges.${value}`),
        }))}
        value={range}
        onChange={setRange}
      />
      {trend.entries.length ? (
        <Card>
          <Sparkline points={trend.points} height={180} accessibilityLabel={t('weight.title')} />
        </Card>
      ) : (
        <EmptyState icon="weight" title={t('weight.empty')} body={t('weight.emptyBody')} />
      )}
      {latest ? (
        <>
          <View style={styles.tiles}>
            <StatTile value={fmt(latest.valueKg)} label={t('weight.current')} />
            <StatTile value={previous ? fmt(previous.valueKg) : '—'} label={t('weight.previous')} />
          </View>
          <View style={styles.tiles}>
            <StatTile
              value={
                previous
                  ? `${arrowFor(latest.valueKg - previous.valueKg)} ${fmt(Math.abs(latest.valueKg - previous.valueKg))}`
                  : '—'
              }
              label={t('weight.change')}
            />
            <StatTile
              value={
                rate.insufficient
                  ? t('weight.notEnough')
                  : t('weight.ratePerWeek', {
                      value: `${arrowFor(rate.perWeek)} ${fmt(Math.abs(rate.perWeek))}`,
                    })
              }
              label={t('weight.rate')}
            />
          </View>
          {values.length ? (
            <View style={styles.tiles}>
              <StatTile value={fmt(Math.min(...values))} label={t('weight.lowest')} />
              <StatTile value={fmt(Math.max(...values))} label={t('weight.highest')} />
            </View>
          ) : null}
        </>
      ) : null}
      <Button
        size="lg"
        icon="add"
        label={t('weight.log')}
        fullWidth
        onPress={() => setSheet({ entry: null })}
        testID="weight-log"
      />
      {newestFirst.length ? <SectionHeader title={t('weight.entries')} /> : null}
      {newestFirst.length ? (
        <Card>
          {newestFirst.slice(0, shown).map((e) => (
            <ListRow
              key={e.id}
              title={fmt(e.valueKg)}
              subtitle={[
                new Date(e.recordedAt).toLocaleString(i18n.language, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }),
                e.notes,
              ]
                .filter(Boolean)
                .join(' · ')}
              onPress={() => setSheet({ entry: e })}
              testID={`weight-entry-${e.id}`}
            />
          ))}
          {newestFirst.length > shown ? (
            <Button
              size="md"
              variant="ghost"
              label={t('weight.showMore')}
              onPress={() => setShown((n) => n + PAGE)}
            />
          ) : null}
        </Card>
      ) : null}
      <QuickWeightSheet
        key={sheet?.entry?.id ?? 'new'}
        visible={sheet !== null}
        entry={sheet?.entry ?? null}
        onClose={() => setSheet(null)}
      />
    </ScreenContainer>
  );
}

const useStyles = makeStyles((t) => ({
  tiles: { flexDirection: 'row', gap: t.spacing.sm },
}));
