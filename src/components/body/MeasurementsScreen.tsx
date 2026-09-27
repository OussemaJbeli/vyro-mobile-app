import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import {
  BottomSheet,
  Button,
  Card,
  ChipGroup,
  Header,
  IconButton,
  Input,
  ListRow,
  ScreenContainer,
  SectionHeader,
  Text,
} from '@/components/ui';
import { routes } from '@/constants/routes';
import {
  invalidates,
  useLatestMeasurements,
  useMeasurementTypes,
  useRepoMutation,
  useUnitPrefs,
} from '@/hooks/data';
import { toast } from '@/store/uiStore';
import { makeStyles } from '@/theme';
import { toLocalDate } from '@/utils/dates';
import { displayName } from '@/utils/seedNames';

import { measurementText } from './format';

type Kind = 'length' | 'percent' | 'other';

/** Measurements (step 22): latest per type, log, and manage types (custom, order, archive). */
export function MeasurementsScreen() {
  const { t, i18n } = useTranslation(['progress', 'seed', 'common']);
  const styles = useStyles();
  const prefs = useUnitPrefs();
  const types = useMeasurementTypes();
  const latest = useLatestMeasurements();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<Kind>('length');
  const [unit, setUnit] = useState('');
  const list = types.data ?? [];
  const tr = (k: string, o?: { defaultValue?: string }) =>
    t(k as 'progress:title', { defaultValue: o?.defaultValue ?? k });

  const create = useRepoMutation(
    (r) =>
      r.measurements.types.create({
        slug: null,
        name: name.trim(),
        kind,
        unitOther: kind === 'other' ? unit.trim() || null : null,
        orderIndex: list.length,
      }),
    {
      invalidate: invalidates.measurements,
      onSuccess: () => {
        setAdding(false);
        setName('');
        setUnit('');
      },
    },
  );
  const reorder = useRepoMutation((r, ids: string[]) => r.measurements.types.reorder(ids), {
    invalidate: invalidates.measurements,
  });
  const archive = useRepoMutation((r, id: string) => r.measurements.types.archive(id), {
    invalidate: invalidates.measurements,
    onSuccess: () => toast.info(t('body.archived')),
  });
  const move = (i: number, dir: -1 | 1) => {
    const ids = list.map((x) => x.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    reorder.mutate(ids);
  };

  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <Header title={t('body.measurements')} onBack={() => router.back()} large={false} />
      <Button
        size="lg"
        icon="add"
        label={t('body.logMeasurements')}
        fullWidth
        onPress={() => router.push(routes.measure)}
      />
      <Card>
        {list.map((type, i) => {
          const m = (latest.data ?? []).find((x) => x.measurementTypeId === type.id);
          const label = displayName('measurement', type, tr);
          return (
            <View key={type.id} style={styles.row}>
              <View style={styles.flex}>
                <ListRow
                  title={label}
                  subtitle={
                    m
                      ? `${measurementText(type, m.value, prefs, i18n.language)} · ${toLocalDate(m.recordedAt)}`
                      : t('body.noValue')
                  }
                  onPress={() => router.push(routes.measurement(type.id))}
                />
              </View>
              <IconButton
                icon="up"
                variant="plain"
                accessibilityLabel={t('body.moveUp', { name: label })}
                disabled={i === 0}
                onPress={() => move(i, -1)}
              />
              <IconButton
                icon="down"
                variant="plain"
                accessibilityLabel={t('body.moveDown', { name: label })}
                disabled={i === list.length - 1}
                onPress={() => move(i, 1)}
              />
              <IconButton
                icon="delete"
                variant="plain"
                accessibilityLabel={`${t('body.archive')} ${label}`}
                onPress={() => archive.mutate(type.id)}
              />
            </View>
          );
        })}
      </Card>
      <SectionHeader title={t('body.manage')} />
      <Button
        size="md"
        variant="secondary"
        icon="add"
        label={t('body.addType')}
        onPress={() => setAdding(true)}
        testID="add-type"
      />
      <BottomSheet visible={adding} onClose={() => setAdding(false)} title={t('body.addType')}>
        <View style={styles.gap}>
          <Input
            label={t('body.name')}
            value={name}
            onChangeText={setName}
            maxLength={40}
            testID="type-name"
          />
          <Text variant="caption" tone="muted">
            {t('body.kind')}
          </Text>
          <ChipGroup
            options={(['length', 'percent', 'other'] as const).map((value) => ({
              value,
              label: t(`body.kinds.${value}`),
            }))}
            value={kind}
            onChange={setKind}
          />
          {kind === 'other' ? (
            <Input label={t('body.unit')} value={unit} onChangeText={setUnit} maxLength={10} />
          ) : null}
          <Button
            size="lg"
            label={t('common:save')}
            fullWidth
            disabled={!name.trim()}
            loading={create.isPending}
            onPress={() => create.mutate(undefined)}
            testID="type-save"
          />
        </View>
      </BottomSheet>
    </ScreenContainer>
  );
}

const useStyles = makeStyles((t) => ({
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  gap: { gap: t.spacing.sm },
}));
