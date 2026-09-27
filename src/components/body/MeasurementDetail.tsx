import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import {
  BottomSheet,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Header,
  Input,
  ListRow,
  ScreenContainer,
  SectionHeader,
  Text,
} from '@/components/ui';
import { routes } from '@/constants/routes';
import { changes } from '@/domain/progress/trend';
import {
  invalidates,
  useMeasurements,
  useMeasurementTypes,
  useRepoMutation,
  useUnitPrefs,
} from '@/hooks/data';
import { makeStyles } from '@/theme';
import { type BodyMeasurement } from '@/types/domain';
import { toLocalDate } from '@/utils/dates';
import { displayName } from '@/utils/seedNames';

import { measurementCanonical, measurementDisplay, measurementText, unitHint } from './format';
import { Sparkline } from '@/components/charts/Sparkline';
import { arrowFor } from './TrendBadge';

/** Measurement type detail: chart, changes since first and previous, history (edit/delete). */
export function MeasurementDetail({ typeId }: { typeId: string }) {
  const { t, i18n } = useTranslation(['progress', 'seed', 'common']);
  const styles = useStyles();
  const prefs = useUnitPrefs();
  const types = useMeasurementTypes();
  const history = useMeasurements(typeId);
  const [editing, setEditing] = useState<BodyMeasurement | null>(null);
  const [text, setText] = useState('');
  const [confirm, setConfirm] = useState(false);
  const type = (types.data ?? []).find((x) => x.id === typeId);
  const tr = (k: string, o?: { defaultValue?: string }) =>
    t(k as 'progress:title', { defaultValue: o?.defaultValue ?? k });
  const update = useRepoMutation(
    async (r, v: { id: string; value: number; unitEntered: BodyMeasurement['unitEntered'] }) => {
      await r.measurements.update(v.id, { value: v.value, unitEntered: v.unitEntered });
    },
    { invalidate: invalidates.measurements, onSuccess: () => setEditing(null) },
  );
  const remove = useRepoMutation((r, id: string) => r.measurements.softDelete(id), {
    invalidate: invalidates.measurements,
    onSuccess: () => setEditing(null),
  });
  if (!type) {
    return (
      <ScreenContainer edges={['top', 'bottom']}>
        <Header title={t('body.measurements')} onBack={() => router.back()} large={false} />
      </ScreenContainer>
    );
  }
  const rows = history.data ?? [];
  const readings = rows.map((m) => ({ t: Date.parse(m.recordedAt), value: m.value }));
  const c = changes(readings);
  const fmt = (v: number) => measurementText(type, v, prefs, i18n.language);
  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <Header
        title={displayName('measurement', type, tr)}
        onBack={() => router.back()}
        large={false}
      />
      {rows.length ? (
        <>
          <Card style={styles.gap}>
            <Text variant="metric">{fmt(rows.at(-1)!.value)}</Text>
            {c.sincePrevious !== null ? (
              <Text tone="muted">
                {t('body.sincePrevious', {
                  arrow: arrowFor(c.sincePrevious),
                  value: fmt(Math.abs(c.sincePrevious)),
                })}
              </Text>
            ) : null}
            {c.sinceFirst !== null ? (
              <Text tone="muted">
                {t('body.sinceFirst', {
                  arrow: arrowFor(c.sinceFirst),
                  value: fmt(Math.abs(c.sinceFirst)),
                })}
              </Text>
            ) : null}
            <Sparkline points={readings} height={150} />
          </Card>
          <SectionHeader title={t('body.history')} />
          <Card>
            {[...rows].reverse().map((m) => (
              <ListRow
                key={m.id}
                title={fmt(m.value)}
                subtitle={[toLocalDate(m.recordedAt), m.notes].filter(Boolean).join(' · ')}
                onPress={() => {
                  setText(String(measurementDisplay(type, m.value, prefs)));
                  setEditing(m);
                }}
              />
            ))}
          </Card>
        </>
      ) : (
        <EmptyState
          icon="measure"
          title={t('body.noValue')}
          actionLabel={t('body.logMeasurements')}
          onAction={() => router.push(routes.measure)}
        />
      )}
      <BottomSheet
        visible={editing !== null}
        onClose={() => setEditing(null)}
        title={t('body.editEntry')}
      >
        <View style={styles.gap}>
          <Input value={text} onChangeText={setText} numeric placeholder={unitHint(type, prefs)} />
          <Button
            size="lg"
            label={t('common:save')}
            fullWidth
            onPress={() => {
              const n = Number(text.replace(',', '.'));
              if (!editing || !Number.isFinite(n) || n <= 0) return;
              update.mutate({ id: editing.id, ...measurementCanonical(type, n, prefs) });
            }}
          />
          <Button
            size="lg"
            variant="danger"
            label={t('weight.delete')}
            fullWidth
            onPress={() => setConfirm(true)}
          />
        </View>
      </BottomSheet>
      <ConfirmDialog
        visible={confirm}
        title={t('body.deleteEntry')}
        confirmLabel={t('weight.delete')}
        cancelLabel={t('common:cancel')}
        destructive
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          if (editing) remove.mutate(editing.id);
        }}
      />
    </ScreenContainer>
  );
}

const useStyles = makeStyles((t) => ({ gap: { gap: t.spacing.sm } }));
