import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useUnsavedGuard } from '@/components/system/useUnsavedGuard';
import {
  BottomSheet,
  Button,
  Card,
  Divider,
  Header,
  Input,
  ListRow,
  NumberStepper,
  ScreenContainer,
  SectionHeader,
  Text,
} from '@/components/ui';
import { goBack } from '@/constants/navigation';
import { routes } from '@/constants/routes';
import {
  averageSpeed,
  estimatedDistanceKm,
  expandRepeatBlock,
  formatMinSec,
  SPEED_MAX_KMH,
  totalDuration,
  type RepeatBlock,
  type RunInterval,
} from '@/domain/running/intervals';
import { RUNNING_PRESETS, type RunningPresetKey } from '@/domain/running/presets';
import { invalidates, useRepoMutation, useUnitPrefs, type TemplateDetail } from '@/hooks/data';
import { toast } from '@/store/uiStore';
import { makeStyles, useTheme } from '@/theme';
import { formatQuantity } from '@/utils/units';

import { DurationFields, InclineField, KindChips, LabelField, SpeedField } from './IntervalFields';
import {
  emptyRunning,
  moveInterval,
  runningFromTemplate,
  runningToInput,
  runningValid,
  validateRunning,
  withKey,
  type BuilderInterval,
  type RunningErrors,
  type RunningState,
} from './runningBuilderModel';
import { intervalTitle } from './intervalTitle';
import { RunningTimeline } from './RunningTimeline';

const NEW_INTERVAL: RunInterval = {
  kind: 'run',
  durationSeconds: 300,
  speedKmh: 9,
  inclinePercent: 1,
  label: null,
};
const NEW_REPEAT: RepeatBlock = {
  times: 6,
  work: { kind: 'run', durationSeconds: 120, speedKmh: 12, inclinePercent: 1 },
  recover: { kind: 'walk', durationSeconds: 60, speedKmh: 6, inclinePercent: 1 },
};
const PRESET_KEYS = Object.keys(RUNNING_PRESETS) as RunningPresetKey[];

/** Running interval builder (step 15, FS §69): timeline, totals, presets and repeat blocks. */
export function RunningBuilder({ template }: { template?: TemplateDetail }) {
  const { t } = useTranslation(['running', 'train']);
  const { t: tRun } = useTranslation('running');
  const theme = useTheme();
  const styles = useStyles();
  const units = useUnitPrefs();
  const [state, setState] = useState<RunningState>(() =>
    template ? runningFromTemplate(template, units) : emptyRunning(),
  );
  const [baseline] = useState(() => JSON.stringify(state));
  const [errors, setErrors] = useState<RunningErrors>({});
  const [editing, setEditing] = useState<{ index: number | null; value: RunInterval } | null>(null);
  const [repeat, setRepeat] = useState<RepeatBlock | null>(null);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [preset, setPreset] = useState<RunningPresetKey | null>(null);
  const [menuFor, setMenuFor] = useState<number | null>(null);

  const guard = useUnsavedGuard(JSON.stringify(state) !== baseline);
  const set = (patch: Partial<RunningState>) => setState((s) => ({ ...s, ...patch }));
  const setIntervals = (intervals: BuilderInterval[]) => set({ intervals });

  const save = useRepoMutation(
    async (r, s: RunningState) => {
      const input = runningToInput(s, units);
      if (template) {
        await r.templates.update(template.id, input);
        return template.id;
      }
      return (await r.templates.create(input)).id;
    },
    {
      invalidate: invalidates.templates,
      onSuccess: (id) => {
        toast.success(t('train:toast.saved'));
        guard.leave(() =>
          template ? goBack(routes.running(id)) : router.replace(routes.running(id)),
        );
      },
    },
  );

  const onSave = () => {
    const e = validateRunning(state);
    setErrors(e);
    if (runningValid(e)) save.mutate(state);
    else
      toast.error(
        e.name
          ? t('builder.errors.name')
          : e.intervals
            ? t('builder.errors.intervals')
            : t('builder.errors.invalid', { max: formatQuantity(SPEED_MAX_KMH, 'speed', units) }),
      );
  };

  const commitEdit = () => {
    if (!editing) return;
    const { index, value } = editing;
    setIntervals(
      index === null
        ? [...state.intervals, withKey(value)]
        : state.intervals.map((iv, i) => (i === index ? { ...iv, ...value } : iv)),
    );
    setEditing(null);
  };

  const rowAction = (action: 'edit' | 'duplicate' | 'up' | 'down' | 'delete') => {
    const i = menuFor;
    setMenuFor(null);
    if (i === null) return;
    const iv = state.intervals[i]!;
    if (action === 'edit') setEditing({ index: i, value: iv });
    if (action === 'duplicate')
      setIntervals([
        ...state.intervals.slice(0, i + 1),
        withKey(iv),
        ...state.intervals.slice(i + 1),
      ]);
    if (action === 'up' || action === 'down')
      setIntervals(moveInterval(state.intervals, i, action === 'up' ? -1 : 1));
    if (action === 'delete') setIntervals(state.intervals.filter((_, j) => j !== i));
  };

  const applyPreset = (mode: 'replace' | 'append') => {
    if (!preset) return;
    const rows = RUNNING_PRESETS[preset].map(withKey);
    setIntervals(mode === 'replace' ? rows : [...state.intervals, ...rows]);
    if (!state.name.trim()) set({ name: t(`presetNames.${preset}`) });
    setPreset(null);
    setPresetsOpen(false);
  };

  const applyPresetNow = (k: RunningPresetKey) => {
    setIntervals(RUNNING_PRESETS[k].map(withKey));
    if (!state.name.trim()) set({ name: t(`presetNames.${k}`) });
    setPresetsOpen(false);
  };

  const speed = (kmh: number | null) => (kmh == null ? '—' : formatQuantity(kmh, 'speed', units));
  const total = totalDuration(state.intervals);

  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <Header
        title={template ? t('builder.editTitle') : t('builder.newTitle')}
        onBack={() => goBack(template ? routes.running(template.id) : routes.train)}
        large={false}
      />
      <Card style={styles.card}>
        <Input
          label={t('builder.name')}
          placeholder={t('builder.namePlaceholder')}
          value={state.name}
          onChangeText={(name) => set({ name })}
          maxLength={60}
          {...(errors.name ? { error: t('builder.errors.name') } : {})}
          testID="run-name"
        />
        <Input
          label={t('builder.target', { unit: units.distance })}
          value={state.distanceTarget}
          onChangeText={(distanceTarget) => set({ distanceTarget })}
          numeric
          maxLength={6}
        />
      </Card>

      <Card variant="accent" style={styles.card}>
        <SectionHeader title={t('timeline')} />
        <RunningTimeline intervals={state.intervals} testID="run-timeline" />
        <View style={styles.totals}>
          <Total label={t('total')} value={formatMinSec(total)} testID="run-total" />
          <Total
            label={t('distance')}
            value={formatQuantity(estimatedDistanceKm(state.intervals), 'distance', units)}
          />
          <Total
            label={t('avgSpeed')}
            value={speed(total ? averageSpeed(state.intervals) : null)}
          />
        </View>
      </Card>

      <SectionHeader title={t('intervals')} />
      <Card>
        {state.intervals.length === 0 ? <Text tone="muted">{t('builder.empty')}</Text> : null}
        {state.intervals.map((iv, i) => (
          <View key={iv.key}>
            {i > 0 ? <Divider /> : null}
            <ListRow
              title={intervalTitle(iv, i, tRun)}
              subtitle={`${formatMinSec(iv.durationSeconds)} · ${speed(iv.speedKmh)} · ${iv.inclinePercent ?? 0} %`}
              // Tapping a row opens its options (Edit first); no nested button inside the row.
              onPress={() => setMenuFor(i)}
              {...(errors.invalid?.includes(i) ? { trailing: <Text tone="danger">!</Text> } : {})}
              accessibilityLabel={`${intervalTitle(iv, i, tRun)}. ${t('actions.menu')}`}
              testID={`interval-${i}`}
            />
          </View>
        ))}
      </Card>
      {errors.intervals ? <Text tone="danger">{t('builder.errors.intervals')}</Text> : null}
      <View style={styles.actions}>
        <Button
          label={t('addInterval')}
          icon="add"
          size="sm"
          variant="secondary"
          onPress={() => setEditing({ index: null, value: NEW_INTERVAL })}
          testID="run-add"
        />
        <Button
          label={t('addRepeat')}
          icon="repeat"
          size="sm"
          variant="secondary"
          onPress={() => setRepeat(NEW_REPEAT)}
          testID="run-repeat"
        />
        <Button
          label={t('presets')}
          icon="down"
          size="sm"
          variant="secondary"
          onPress={() => setPresetsOpen(true)}
          testID="run-presets"
        />
      </View>
      <Button
        label={t('builder.save')}
        size="lg"
        fullWidth
        loading={save.isPending}
        onPress={onSave}
        testID="run-save"
      />

      <BottomSheet
        visible={editing !== null}
        onClose={() => setEditing(null)}
        title={t('editor.title')}
      >
        {editing ? (
          <View style={styles.sheet}>
            <KindChips
              value={editing.value.kind}
              onChange={(kind) => setEditing({ ...editing, value: { ...editing.value, kind } })}
            />
            <DurationFields
              seconds={editing.value.durationSeconds}
              onChange={(durationSeconds) =>
                setEditing({ ...editing, value: { ...editing.value, durationSeconds } })
              }
            />
            <SpeedField
              kmh={editing.value.speedKmh}
              units={units}
              onChange={(speedKmh) =>
                setEditing({ ...editing, value: { ...editing.value, speedKmh } })
              }
            />
            <InclineField
              value={editing.value.inclinePercent}
              onChange={(inclinePercent) =>
                setEditing({ ...editing, value: { ...editing.value, inclinePercent } })
              }
            />
            <LabelField
              value={editing.value.label}
              onChange={(label) => setEditing({ ...editing, value: { ...editing.value, label } })}
            />
            <Button
              label={t('editor.done')}
              fullWidth
              onPress={commitEdit}
              disabled={editing.value.durationSeconds <= 0}
              testID="interval-done"
            />
          </View>
        ) : null}
      </BottomSheet>

      <BottomSheet
        visible={repeat !== null}
        onClose={() => setRepeat(null)}
        title={t('repeat.title')}
      >
        {repeat ? (
          <View style={styles.sheet}>
            <Text variant="caption" tone="muted">
              {t('repeat.times')}
            </Text>
            <NumberStepper
              label={t('repeat.times')}
              value={repeat.times}
              onChange={(times) => setRepeat({ ...repeat, times })}
              min={1}
              max={30}
              unit="×"
            />
            {(['work', 'recover'] as const).map((part) => (
              <Card key={part} style={styles.card}>
                <Text variant="bodyStrong">{t(`repeat.${part}`)}</Text>
                <DurationFields
                  seconds={repeat[part].durationSeconds}
                  onChange={(durationSeconds) =>
                    setRepeat({ ...repeat, [part]: { ...repeat[part], durationSeconds } })
                  }
                />
                <SpeedField
                  kmh={repeat[part].speedKmh}
                  units={units}
                  onChange={(speedKmh) =>
                    setRepeat({ ...repeat, [part]: { ...repeat[part], speedKmh } })
                  }
                />
              </Card>
            ))}
            <Button
              label={t('repeat.add', { count: repeat.times * 2 })}
              fullWidth
              disabled={repeat.work.durationSeconds <= 0 || repeat.recover.durationSeconds <= 0}
              onPress={() => {
                setIntervals([...state.intervals, ...expandRepeatBlock(repeat).map(withKey)]);
                setRepeat(null);
              }}
              testID="repeat-add"
            />
          </View>
        ) : null}
      </BottomSheet>

      <BottomSheet visible={presetsOpen} onClose={() => setPresetsOpen(false)} title={t('presets')}>
        <View style={styles.sheet}>
          {PRESET_KEYS.map((k) => (
            <View key={k}>
              <ListRow
                title={t(`presetNames.${k}`)}
                subtitle={`${formatMinSec(totalDuration(RUNNING_PRESETS[k]))} · ${formatQuantity(estimatedDistanceKm(RUNNING_PRESETS[k]), 'distance', units)}`}
                onPress={() =>
                  state.intervals.length ? setPreset(k) : (setPreset(k), applyPresetNow(k))
                }
                testID={`preset-${k}`}
              />
              <RunningTimeline intervals={RUNNING_PRESETS[k]} height={24} />
            </View>
          ))}
          {preset && state.intervals.length ? (
            <Card style={styles.card}>
              <Text variant="bodyStrong">
                {t('presetConfirm.title', { name: t(`presetNames.${preset}`) })}
              </Text>
              <Text variant="caption" tone="muted">
                {t('presetConfirm.body')}
              </Text>
              <View style={styles.actions}>
                <Button
                  label={t('presetConfirm.replace')}
                  size="sm"
                  onPress={() => applyPreset('replace')}
                  testID="preset-replace"
                />
                <Button
                  label={t('presetConfirm.append')}
                  size="sm"
                  variant="secondary"
                  onPress={() => applyPreset('append')}
                />
              </View>
            </Card>
          ) : null}
        </View>
      </BottomSheet>

      <BottomSheet
        visible={menuFor !== null}
        onClose={() => setMenuFor(null)}
        title={t('actions.menu')}
      >
        <View style={styles.sheet}>
          <ListRow
            title={t('actions.edit')}
            onPress={() => rowAction('edit')}
            showChevron={false}
          />
          <ListRow
            title={t('actions.duplicate')}
            onPress={() => rowAction('duplicate')}
            showChevron={false}
          />
          {menuFor !== null && menuFor > 0 ? (
            <ListRow
              title={t('actions.moveUp')}
              onPress={() => rowAction('up')}
              showChevron={false}
            />
          ) : null}
          {menuFor !== null && menuFor < state.intervals.length - 1 ? (
            <ListRow
              title={t('actions.moveDown')}
              onPress={() => rowAction('down')}
              showChevron={false}
            />
          ) : null}
          <ListRow
            title={t('actions.delete')}
            onPress={() => rowAction('delete')}
            showChevron={false}
          />
        </View>
      </BottomSheet>
      {guard.dialog}
      <View style={{ height: theme.spacing.md }} />
    </ScreenContainer>
  );
}

function Total({ label, value, testID }: { label: string; value: string; testID?: string }) {
  const styles = useStyles();
  return (
    <View style={styles.total}>
      <Text variant="heading" style={styles.nums} {...(testID ? { testID } : {})}>
        {value}
      </Text>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  card: { gap: t.spacing.sm },
  totals: { flexDirection: 'row', justifyContent: 'space-between' },
  total: { alignItems: 'center', flex: 1 },
  nums: { fontVariant: ['tabular-nums'] },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm },
  sheet: { gap: t.spacing.md, paddingBottom: t.spacing.md },
}));
