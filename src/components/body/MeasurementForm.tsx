import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button, Card, Header, Input, ScreenContainer, Text } from '@/components/ui';
import { goBack } from '@/constants/navigation';
import { routes } from '@/constants/routes';
import { invalidates, useMeasurementTypes, useRepoMutation, useUnitPrefs } from '@/hooks/data';
import { toast } from '@/store/uiStore';
import { makeStyles } from '@/theme';
import { displayName } from '@/utils/seedNames';

import { measurementCanonical, unitHint } from './format';

/** Multi-entry form: every filled field is saved in one transaction (a measurement session). */
export function MeasurementForm() {
  const { t } = useTranslation(['progress', 'seed']);
  const styles = useStyles();
  const prefs = useUnitPrefs();
  const types = useMeasurementTypes();
  const [values, setValues] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const tr = (k: string, o?: { defaultValue?: string }) =>
    t(k as 'progress:title', { defaultValue: o?.defaultValue ?? k });

  const entries = (types.data ?? []).flatMap((type) => {
    const raw = values[type.id]?.replace(',', '.').trim();
    const n = raw ? Number(raw) : NaN;
    if (!raw || !Number.isFinite(n) || n <= 0) return [];
    const c = measurementCanonical(type, n, prefs);
    return [
      {
        measurementTypeId: type.id,
        value: c.value,
        unitEntered: c.unitEntered,
        notes: note.trim() || null,
      },
    ];
  });

  const save = useRepoMutation((r) => r.measurements.createSession(entries), {
    invalidate: invalidates.measurements,
    onSuccess: (rows) => {
      toast.success(t('body.savedCount', { count: rows.length }));
      goBack(routes.progress);
    },
  });

  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <Header
        title={t('body.formTitle')}
        subtitle={t('body.formHint')}
        onBack={() => router.back()}
        large={false}
      />
      <Card style={styles.gap}>
        {(types.data ?? []).map((type) => (
          <View key={type.id} style={styles.row}>
            <Text style={styles.flex}>{displayName('measurement', type, tr)}</Text>
            <View style={styles.input}>
              <Input
                value={values[type.id] ?? ''}
                onChangeText={(v) => {
                  setError(null);
                  setValues((s) => ({ ...s, [type.id]: v }));
                }}
                numeric
                placeholder={unitHint(type, prefs)}
                accessibilityLabel={displayName('measurement', type, tr)}
                testID={`measure-${type.slug ?? type.id}`}
              />
            </View>
          </View>
        ))}
      </Card>
      <Input value={note} onChangeText={setNote} placeholder={t('weight.note')} maxLength={300} />
      {error ? <Text tone="danger">{error}</Text> : null}
      <Button
        size="xl"
        label={t('body.saveAll')}
        fullWidth
        loading={save.isPending}
        onPress={() => (entries.length ? save.mutate(undefined) : setError(t('body.nothing')))}
        testID="measure-save"
      />
    </ScreenContainer>
  );
}

const useStyles = makeStyles((t) => ({
  gap: { gap: t.spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
  flex: { flex: 1 },
  input: { width: 120 },
}));
