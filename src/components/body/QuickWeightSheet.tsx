import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { DatePickerSheet, TimeField } from '@/components/planner/Pickers';
import { formatDay } from '@/components/planner/plannerUtils';
import {
  BottomSheet,
  Button,
  ConfirmDialog,
  Input,
  ListRow,
  NumberStepper,
  Text,
} from '@/components/ui';
import {
  invalidates,
  useLatestWeights,
  useProfile,
  useRepoMutation,
  useUnitPrefs,
} from '@/hooks/data';
import { toast } from '@/store/uiStore';
import { makeStyles } from '@/theme';
import { type WeightEntry } from '@/types/domain';
import { fromDate, today, type WeekStart } from '@/utils/dates';
import { formatQuantity, fromCanonical, roundToStep, toCanonical, unitLabel } from '@/utils/units';

const MIN_KG = 25;
const MAX_KG = 300;

/**
 * Quick weight (step 22): one big stepper prefilled with the last value, so logging the
 * same weight is one tap on Save. Date/time default now (back-dating allowed), note.
 * Mount with `key` per entry when editing.
 */
export function QuickWeightSheet({
  visible,
  onClose,
  entry,
}: {
  visible: boolean;
  onClose: () => void;
  /** Edit mode (with Delete). */
  entry?: WeightEntry | null;
}) {
  const { t, i18n } = useTranslation(['progress', 'common']);
  const styles = useStyles();
  const prefs = useUnitPrefs();
  const profile = useProfile();
  const latest = useLatestWeights(1);
  const unit = prefs.weight;
  const last = latest.data?.[0];
  const baseKg = entry?.valueKg ?? last?.valueKg ?? (unit === 'lb' ? toCanonical(165, 'lb') : 70);
  const [display, setDisplay] = useState<number | null>(null);
  const shown = display ?? roundToStep(fromCanonical(baseKg, unit), 0.1);
  const at = entry ? new Date(entry.recordedAt) : null;
  const [date, setDate] = useState<string | null>(at ? fromDate(at) : null);
  const [time, setTime] = useState<string | null>(
    at
      ? `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`
      : null,
  );
  const [pickDate, setPickDate] = useState(false);
  const [note, setNote] = useState(entry?.notes ?? '');
  const [confirmBig, setConfirmBig] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const kg = toCanonical(shown, unit);
  const valid = kg >= MIN_KG && kg <= MAX_KG;
  const reference = entry ? null : last;
  const big = reference ? Math.abs(kg - reference.valueKg) > reference.valueKg * 0.05 : false;

  const recordedAt = () => {
    if (!date && !time) return new Date().toISOString();
    const d = new Date(`${date ?? today()}T00:00:00`);
    const [h, m] = (time ?? '08:00').split(':').map(Number) as [number, number];
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };

  const close = () => {
    setDisplay(null);
    setDate(null);
    setTime(null);
    setNote('');
    onClose();
  };

  const save = useRepoMutation(
    async (r) => {
      const input = {
        valueKg: kg,
        unitEntered: unit,
        recordedAt: recordedAt(),
        notes: note.trim() || null,
      };
      if (entry) await r.weights.update(entry.id, input);
      else await r.weights.create(input);
    },
    {
      invalidate: invalidates.weights,
      onSuccess: () => {
        toast.success(t('weight.saved'));
        close();
      },
    },
  );
  // No non-null assertion here: the React Compiler reads captured `entry.id` while memoizing.
  const entryId = entry?.id ?? null;
  const remove = useRepoMutation(
    async (r) => {
      if (entryId) await r.weights.softDelete(entryId);
    },
    {
      invalidate: invalidates.weights,
      onSuccess: close,
    },
  );

  return (
    <>
      <BottomSheet
        visible={visible}
        onClose={close}
        title={entry ? t('weight.edit') : t('weight.log')}
      >
        <View style={styles.gap}>
          <NumberStepper
            label={t('weight.value')}
            value={shown}
            onChange={setDisplay}
            step={0.1}
            min={roundToStep(fromCanonical(MIN_KG, unit), 1)}
            max={roundToStep(fromCanonical(MAX_KG, unit), 1)}
            unit={unitLabel(unit)}
            size="xl"
            testID="weight-stepper"
          />
          {!valid ? (
            <Text tone="danger">
              {t('weight.invalid', {
                min: formatQuantity(MIN_KG, 'bodyWeight', prefs, i18n.language),
                max: formatQuantity(MAX_KG, 'bodyWeight', prefs, i18n.language),
              })}
            </Text>
          ) : null}
          <ListRow
            title={t('weight.date')}
            trailing={
              <Text variant="bodyStrong">
                {formatDay(date ?? today(), { weekday: 'short', day: 'numeric', month: 'short' })}
              </Text>
            }
            onPress={() => setPickDate(true)}
            showChevron={false}
          />
          <View style={styles.row}>
            <Text style={styles.flex}>{t('weight.time')}</Text>
            <TimeField value={time} onChange={setTime} />
          </View>
          <Input
            value={note}
            onChangeText={setNote}
            placeholder={t('weight.note')}
            maxLength={300}
          />
          <Button
            size="xl"
            label={t('weight.save')}
            fullWidth
            disabled={!valid}
            loading={save.isPending}
            onPress={() => (big ? setConfirmBig(true) : save.mutate(undefined))}
            testID="weight-save"
          />
          {entry ? (
            <Button
              size="lg"
              variant="danger"
              label={t('weight.delete')}
              fullWidth
              onPress={() => setConfirmDelete(true)}
            />
          ) : null}
        </View>
        <DatePickerSheet
          visible={pickDate}
          value={date ?? today()}
          today={today()}
          weekStartsOn={(profile.data?.weekStartsOn ?? 1) as WeekStart}
          onPick={(d) => {
            setDate(d > today() ? today() : d);
            setPickDate(false);
          }}
          onClose={() => setPickDate(false)}
        />
      </BottomSheet>
      <ConfirmDialog
        visible={confirmBig}
        title={t('weight.bigChangeTitle')}
        message={t('weight.bigChange', {
          value: formatQuantity(
            Math.abs(kg - (reference?.valueKg ?? kg)),
            'bodyWeight',
            prefs,
            i18n.language,
          ),
        })}
        confirmLabel={t('weight.save')}
        cancelLabel={t('common:cancel')}
        onCancel={() => setConfirmBig(false)}
        onConfirm={() => {
          setConfirmBig(false);
          save.mutate(undefined);
        }}
      />
      <ConfirmDialog
        visible={confirmDelete}
        title={t('weight.deleteTitle')}
        confirmLabel={t('weight.delete')}
        cancelLabel={t('common:cancel')}
        destructive
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          remove.mutate(undefined);
        }}
      />
    </>
  );
}

const useStyles = makeStyles((t) => ({
  gap: { gap: t.spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
  flex: { flex: 1 },
}));
