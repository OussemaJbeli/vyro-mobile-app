import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { BottomSheet, NumberStepper, Text, Toggle } from '@/components/ui';
import { makeStyles } from '@/theme';
import { addMonthsLocal, asLocalDate, monthGrid, type WeekStart } from '@/utils/dates';

import { MonthGrid } from './Calendar';
import { formatDay } from './plannerUtils';

/** Month-grid date picker in a bottom sheet (no native dependency, works in Expo Go). */
export function DatePickerSheet({
  visible,
  value,
  today,
  weekStartsOn,
  onPick,
  onClose,
}: {
  visible: boolean;
  value: string;
  today: string;
  weekStartsOn: WeekStart;
  onPick: (date: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation('plan');
  const [month, setMonth] = useState(value.slice(0, 7) + '-01');
  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('picker.title')}>
      <MonthGrid
        weeks={monthGrid(asLocalDate(month), weekStartsOn)}
        month={month.slice(0, 7)}
        title={formatDay(month, { month: 'long', year: 'numeric' })}
        today={today}
        selected={value}
        markers={new Map()}
        onSelect={(d) => {
          onPick(d);
          onClose();
        }}
        onPrev={() => setMonth(addMonthsLocal(asLocalDate(month), -1))}
        onNext={() => setMonth(addMonthsLocal(asLocalDate(month), 1))}
      />
      <View style={{ height: 12 }} />
    </BottomSheet>
  );
}

/** Optional time of day: "Any time" toggle + hour and 15-minute steppers. */
export function TimeField({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const { t } = useTranslation('plan');
  const styles = useStyles();
  const h = value ? Number(value.slice(0, 2)) : 18;
  const m = value ? Number(value.slice(3, 5)) : 0;
  const fmt = (hh: number, mm: number) =>
    `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.flex}>{t('form.anyTime')}</Text>
        <Toggle
          value={value === null}
          onChange={(any) => onChange(any ? null : fmt(h, m))}
          accessibilityLabel={t('form.anyTime')}
        />
      </View>
      {value !== null ? (
        <View style={styles.row}>
          <View style={styles.flex}>
            <NumberStepper
              label={t('form.time')}
              value={h}
              onChange={(v) => onChange(fmt(v, m))}
              min={0}
              max={23}
              unit="h"
            />
          </View>
          <View style={styles.flex}>
            <NumberStepper
              label={t('form.time')}
              value={m}
              onChange={(v) => onChange(fmt(h, v))}
              step={15}
              min={0}
              max={45}
              unit="min"
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  wrap: { gap: t.spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  flex: { flex: 1 },
}));
