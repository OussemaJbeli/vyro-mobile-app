import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import {
  Card,
  ChipGroup,
  Divider,
  Input,
  ListRow,
  NumberStepper,
  OptionCard,
  RulerPicker,
  SegmentedControl,
  Text,
  type IconName,
} from '@/components/ui';
import { routes } from '@/constants/routes';
import { presetEquipmentSlugs } from '@/domain/onboarding/defaults';
import { planStarter, type IsoWeekday, type StarterGoal } from '@/domain/scheduling/starterPlan';
import { useEquipment } from '@/hooks/data';
import { useCompleteOnboarding } from '@/hooks/useCompleteOnboarding';
import { PinSetup } from '@/components/security/PinSetup';
import { requestNotificationPermission } from '@/services/notifications/permissions';
import { makeStyles, useTheme } from '@/theme';
import { vyroWeek } from '@/hooks/useVyroWeek';
import { type OnboardingDraft, type OnboardingGoal } from '@/types/onboarding';
import {
  formatQuantity,
  fromCanonical,
  roundToStep,
  toCanonical,
  type UnitPrefs,
} from '@/utils/units';

import { OnboardingLayout } from './OnboardingLayout';
import { useStepNav } from './useStepNav';

const prefsOf = (d: OnboardingDraft): UnitPrefs => d.units;

/** Commits whatever is in the draft now and goes Home ("Skip setup for now"). */
function useFinish() {
  const { complete, busy } = useCompleteOnboarding();
  const finish = async (draft: OnboardingDraft) => {
    if (await complete(draft)) router.replace(routes.home);
  };
  return { finish, busy };
}

// 1 ─ Name
export function NameStep() {
  const { t } = useTranslation('onboarding');
  const { draft, next, back, index, total } = useStepNav('name');
  const [name, setName] = useState(draft.name ?? '');
  const { finish, busy } = useFinish();
  return (
    <OnboardingLayout
      title={t('name.title')}
      subtitle={t('name.subtitle')}
      index={index}
      total={total}
      onBack={back}
      onSkip={() => next({ name: null })}
      onContinue={() => next({ name: name.trim() || null })}
      {...(draft.mode === 'first'
        ? {
            secondary: {
              label: t('nav.skipAll'),
              onPress: () => finish({ ...draft, name: name.trim() || null, acceptPlan: false }),
            },
          }
        : {})}
      loading={busy}
    >
      <Input
        value={name}
        onChangeText={setName}
        placeholder={t('name.placeholder')}
        accessibilityLabel={t('name.placeholder')}
        autoFocus
        maxLength={60}
        returnKeyType="next"
        onSubmitEditing={() => next({ name: name.trim() || null })}
        testID="onboarding-name"
      />
    </OnboardingLayout>
  );
}

// 2 ─ Units
export function UnitsStep() {
  const { t } = useTranslation('onboarding');
  const { draft, next, back, update, index, total } = useStepNav('units');
  const u = draft.units;
  const set = (patch: Partial<OnboardingDraft['units']>) => update({ units: { ...u, ...patch } });
  const row = <K extends keyof OnboardingDraft['units']>(
    key: K,
    label: string,
    values: OnboardingDraft['units'][K][],
  ) => (
    <View style={{ gap: 8 }} key={key}>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <SegmentedControl
        segments={values.map((v) => ({ value: v, label: t(`units.${v}` as 'units.kg') }))}
        value={u[key]}
        onChange={(v) => set({ [key]: v } as Partial<OnboardingDraft['units']>)}
      />
    </View>
  );
  return (
    <OnboardingLayout
      title={t('units.title')}
      subtitle={t('units.subtitle')}
      index={index}
      total={total}
      onBack={back}
      onContinue={() => next()}
    >
      {row('weight', t('units.weight'), ['kg', 'lb'])}
      {row('length', t('units.length'), ['cm', 'in'])}
      {row('distance', t('units.distance'), ['km', 'mi'])}
      {row('speed', t('units.speed'), ['kmh', 'mph'])}
    </OnboardingLayout>
  );
}

// 3 ─ Height
export function HeightStep() {
  const { t } = useTranslation('onboarding');
  const { draft, next, back, index, total } = useStepNav('height');
  const inches = draft.units.length === 'in';
  const [cm, setCm] = useState(draft.heightCm ?? 175);
  const display = inches ? roundToStep(fromCanonical(cm, 'in'), 0.5) : Math.round(cm);
  return (
    <OnboardingLayout
      title={t('height.title')}
      subtitle={t('height.subtitle')}
      index={index}
      total={total}
      onBack={back}
      onSkip={() => next({ heightCm: null })}
      onContinue={() => next({ heightCm: Math.round(cm * 10) / 10 })}
    >
      <RulerPicker
        label={t('height.title')}
        value={display}
        min={inches ? 40 : 100}
        max={inches ? 98 : 250}
        step={inches ? 0.5 : 1}
        majorEvery={inches ? 12 : 10}
        onChange={(v) => setCm(inches ? toCanonical(v, 'in') : v)}
        format={(v) => formatQuantity(inches ? toCanonical(v, 'in') : v, 'height', prefsOf(draft))}
        testID="onboarding-height"
      />
    </OnboardingLayout>
  );
}

// 4 ─ Weight
export function WeightStep() {
  const { t } = useTranslation('onboarding');
  const { draft, next, back, index, total } = useStepNav('weight');
  const lb = draft.units.weight === 'lb';
  const [kg, setKg] = useState(draft.weightKg ?? 75);
  const display = lb ? Math.round(fromCanonical(kg, 'lb')) : roundToStep(kg, 0.5);
  return (
    <OnboardingLayout
      title={t('weight.title')}
      subtitle={t('weight.subtitle')}
      index={index}
      total={total}
      onBack={back}
      onSkip={() => next({ weightKg: null })}
      onContinue={() => next({ weightKg: kg })}
    >
      <WeightRuler label={t('weight.title')} kg={display} lb={lb} onChange={setKg} draft={draft} />
    </OnboardingLayout>
  );
}

function WeightRuler({
  label,
  kg,
  lb,
  onChange,
  draft,
}: {
  label: string;
  kg: number;
  lb: boolean;
  onChange: (kg: number) => void;
  draft: OnboardingDraft;
}) {
  return (
    <RulerPicker
      label={label}
      value={kg}
      min={lb ? 55 : 25}
      max={lb ? 660 : 300}
      step={lb ? 1 : 0.5}
      majorEvery={10}
      onChange={(v) => onChange(lb ? toCanonical(v, 'lb') : v)}
      format={(v) => formatQuantity(lb ? toCanonical(v, 'lb') : v, 'bodyWeight', prefsOf(draft))}
      testID="onboarding-weight"
    />
  );
}

// 5 ─ Goal
const GOALS: { kind: StarterGoal; icon: IconName }[] = [
  { kind: 'lose_weight', icon: 'weight' },
  { kind: 'build_muscle', icon: 'gym' },
  { kind: 'run_better', icon: 'running' },
  { kind: 'consistency', icon: 'streak' },
  { kind: 'custom', icon: 'trophy' },
];

export function GoalStep() {
  const { t } = useTranslation('onboarding');
  const { draft, next, back, index, total } = useStepNav('goal');
  // Several goals can be picked (e.g. lose weight + build muscle); the first one picked
  // sets the plan style.
  const [goals, setGoals] = useState<OnboardingGoal[]>(
    draft.goals.length ? draft.goals : draft.goal ? [draft.goal] : [],
  );
  const lb = draft.units.weight === 'lb';
  const defaultTarget = Math.max(25, (draft.weightKg ?? 75) - 5);
  const get = (kind: StarterGoal) => goals.find((g) => g.kind === kind);
  const patch = (kind: StarterGoal, p: Partial<OnboardingGoal>) =>
    setGoals((list) => list.map((g) => (g.kind === kind ? { ...g, ...p } : g)));

  const toggle = (kind: StarterGoal) =>
    setGoals((list) =>
      list.some((g) => g.kind === kind)
        ? list.filter((g) => g.kind !== kind)
        : [
            ...list,
            {
              kind,
              targetWeightKg: kind === 'lose_weight' ? defaultTarget : null,
              sessionsPerWeek:
                kind === 'consistency' ? Math.max(1, draft.trainingDays.length) : null,
              customTitle: kind === 'custom' ? '' : null,
            },
          ],
    );

  const lose = get('lose_weight');
  const consistency = get('consistency');
  const custom = get('custom');
  return (
    <OnboardingLayout
      title={t('goal.title')}
      subtitle={t('goal.subtitleMulti')}
      index={index}
      total={total}
      onBack={back}
      onSkip={() => next({ goal: null, goals: [] })}
      onContinue={() => next({ goals, goal: goals[0] ?? null })}
      continueDisabled={goals.length === 0 || (!!custom && !custom.customTitle?.trim())}
    >
      {GOALS.map((g) => (
        <OptionCard
          key={g.kind}
          icon={g.icon}
          title={t(`goal.options.${g.kind}`)}
          description={t(`goal.descriptions.${g.kind}`)}
          selected={!!get(g.kind)}
          onPress={() => toggle(g.kind)}
          testID={`goal-${g.kind}`}
        />
      ))}
      {lose ? (
        <Card>
          <Text variant="caption" tone="muted">
            {t('goal.targetWeight')}
          </Text>
          <WeightRuler
            label={t('goal.targetWeight')}
            kg={
              lb
                ? Math.round(fromCanonical(lose.targetWeightKg ?? defaultTarget, 'lb'))
                : roundToStep(lose.targetWeightKg ?? defaultTarget, 0.5)
            }
            lb={lb}
            onChange={(kg) => patch('lose_weight', { targetWeightKg: kg })}
            draft={draft}
          />
        </Card>
      ) : null}
      {consistency ? (
        <Card>
          <NumberStepper
            label={t('goal.sessionsPerWeek')}
            value={consistency.sessionsPerWeek ?? 3}
            onChange={(v) => patch('consistency', { sessionsPerWeek: v })}
            min={1}
            max={14}
          />
          <Text variant="caption" tone="muted" align="center">
            {t('goal.sessionsPerWeek')}
          </Text>
        </Card>
      ) : null}
      {custom ? (
        <Input
          label={t('goal.customTitle')}
          value={custom.customTitle ?? ''}
          onChangeText={(v) => patch('custom', { customTitle: v })}
          maxLength={80}
        />
      ) : null}
    </OnboardingLayout>
  );
}

// 6 ─ Equipment
const PRESETS: { key: OnboardingDraft['equipmentPreset']; icon: IconName }[] = [
  { key: 'full_gym', icon: 'gym' },
  { key: 'home_dumbbells', icon: 'home_workout' },
  { key: 'bodyweight', icon: 'body' },
];

export function EquipmentStep() {
  const { t } = useTranslation(['onboarding', 'seed']);
  const { draft, next, back, index, total } = useStepNav('equipment');
  const equipment = useEquipment();
  const all = useMemo(() => equipment.data ?? [], [equipment.data]);
  const [preset, setPreset] = useState(draft.equipmentPreset);
  const [ids, setIds] = useState<string[] | null>(draft.equipmentIds);
  const [tuning, setTuning] = useState(false);

  const idsForPreset = (p: typeof preset) => {
    const slugs = presetEquipmentSlugs(p, all.map((e) => e.slug ?? '').filter(Boolean));
    return all.filter((e) => e.slug && slugs.includes(e.slug)).map((e) => e.id);
  };
  const selected = ids ?? idsForPreset(preset);
  const name = (e: (typeof all)[number]) =>
    e.slug
      ? t(`seed:equipment.${e.slug}` as 'seed:equipment.dumbbells', { defaultValue: e.name })
      : e.name;

  return (
    <OnboardingLayout
      title={t('equipment.title')}
      subtitle={t('equipment.subtitle')}
      index={index}
      total={total}
      onBack={back}
      onContinue={() => next({ equipmentPreset: preset, equipmentIds: selected })}
    >
      {PRESETS.map((p) => (
        <OptionCard
          key={p.key}
          icon={p.icon}
          title={t(`equipment.presets.${p.key}`)}
          selected={preset === p.key}
          onPress={() => {
            setPreset(p.key);
            setIds(null);
          }}
          testID={`preset-${p.key}`}
        />
      ))}
      <ListRow
        title={t('equipment.customize')}
        subtitle={t('equipment.available', { count: selected.length })}
        onPress={() => setTuning((v) => !v)}
      />
      {tuning ? (
        <ChipGroup
          multiple
          options={all.map((e) => ({ value: e.id, label: name(e) }))}
          value={selected}
          onChange={setIds}
        />
      ) : null}
    </OnboardingLayout>
  );
}

// 7 ─ Days + starter plan
const WEEKDAYS: IsoWeekday[] = [1, 2, 3, 4, 5, 6, 7];
const TIMES = ['06:00', '07:00', '12:00', '17:00', '18:00', '19:00', '20:00'];

function CustomDays({ onChoose }: { onChoose: (patch: Partial<OnboardingDraft>) => void }) {
  const { t } = useTranslation(['onboarding', 'seed']);
  const styles = useStyles();
  const theme = useTheme();
  const { draft } = useStepNav('days');
  const [days, setDays] = useState(draft.trainingDays.map(String));
  const [time, setTime] = useState(draft.trainingTime);
  const plan = planStarter({
    goal: draft.goal?.kind ?? 'consistency',
    trainingDays: days.map(Number) as IsoWeekday[],
    equipment: draft.equipmentPreset,
  });
  const byDay = new Map(plan.days.map((d) => [d.weekday, d.template]));
  // Report the choice up on every change; the step's Continue commits it.
  const report = (d: string[], tm: string) =>
    onChoose({ trainingDays: d.map(Number).sort(), trainingTime: tm });

  return (
    <>
      <ChipGroup
        multiple
        options={WEEKDAYS.map((d) => ({ value: String(d), label: t(`days.weekdays.${d}`) }))}
        value={days}
        onChange={(d) => {
          setDays(d);
          report(d, time);
        }}
      />
      <Text variant="caption" tone="muted">
        {t('days.time')}
      </Text>
      <ChipGroup
        scrollable
        options={TIMES.map((v) => ({ value: v, label: v }))}
        value={time}
        onChange={(tm) => {
          setTime(tm);
          report(days, tm);
        }}
      />

      <Card variant="accent">
        <Text variant="heading">{t('days.planTitle')}</Text>
        <Text variant="caption" tone="muted">
          {days.length ? t('days.planSubtitle') : t('days.noDays')}
        </Text>
        {draft.mode === 'redo' ? (
          <Text variant="caption" tone="danger">
            {t('days.replaceWarning')}
          </Text>
        ) : null}
        {WEEKDAYS.map((d, i) => {
          const tpl = byDay.get(d);
          return (
            <View key={d}>
              {i > 0 ? <Divider /> : null}
              <View style={styles.planRow}>
                <Text variant="bodyStrong" style={styles.day}>
                  {t(`days.weekdays.${d}`)}
                </Text>
                <Text style={{ color: tpl ? theme.colors.text : theme.colors.textMuted, flex: 1 }}>
                  {tpl ? t(`seed:template.${tpl}`) : t('days.rest')}
                </Text>
                {tpl ? (
                  <Text variant="caption" tone="muted">
                    {time}
                  </Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </Card>
    </>
  );
}

export function DaysStep() {
  const { t } = useTranslation(['onboarding', 'seed']);
  const styles = useStyles();
  const theme = useTheme();
  const { draft, next, back, index, total } = useStepNav('days');
  const [plan, setPlan] = useState<'vyro' | 'custom'>(draft.plan);
  const [custom, setCustom] = useState<Partial<OnboardingDraft>>({
    trainingDays: draft.trainingDays,
    trainingTime: draft.trainingTime,
  });
  const week = vyroWeek();
  const commit = (acceptPlan: boolean) =>
    next(plan === 'vyro' ? { plan, acceptPlan } : { plan, acceptPlan, ...custom });

  return (
    <OnboardingLayout
      title={t('days.title')}
      subtitle={plan === 'vyro' ? t('days.vyroSubtitle') : t('days.subtitle')}
      index={index}
      total={total}
      onBack={back}
      continueLabel={t('days.accept')}
      continueDisabled={plan === 'custom' && !(custom.trainingDays ?? []).length}
      onContinue={() => commit(true)}
      secondary={{ label: t('days.skipPlan'), onPress: () => commit(false) }}
    >
      <SegmentedControl
        segments={[
          { value: 'vyro', label: t('days.vyroWeek') },
          { value: 'custom', label: t('days.customWeek') },
        ]}
        value={plan}
        onChange={setPlan}
        testID="days-plan"
      />
      {plan === 'vyro' ? (
        <Card variant="accent">
          <Text variant="heading">{t('days.vyroTitle')}</Text>
          <Text variant="caption" tone="muted">
            {t('days.vyroHint')}
          </Text>
          {draft.mode === 'redo' ? (
            <Text variant="caption" tone="danger">
              {t('days.replaceWarning')}
            </Text>
          ) : null}
          {WEEKDAYS.map((d, i) => {
            const items = week[d] ?? [];
            const rest = items.every((x) => x.type === 'rest');
            return (
              <View key={d}>
                {i > 0 ? <Divider /> : null}
                <View style={styles.weekRow}>
                  <Text variant="bodyStrong" style={styles.day}>
                    {t(`days.weekdays.${d}`)}
                  </Text>
                  <View style={styles.flex}>
                    {rest ? (
                      <Text style={{ color: theme.colors.textMuted }}>{t('days.rest')}</Text>
                    ) : (
                      items.map((x) => (
                        <View key={x.key + x.time} style={styles.planRow}>
                          <Text variant="caption" tone="muted" style={styles.time}>
                            {x.time}
                          </Text>
                          <Text style={styles.flex} numberOfLines={1}>
                            {t(`seed:template.${x.key}` as 'seed:template.abs')}
                          </Text>
                        </View>
                      ))
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </Card>
      ) : (
        <CustomDays onChoose={(p) => setCustom((c) => ({ ...c, ...p }))} />
      )}
    </OnboardingLayout>
  );
}

// 8 ─ Notifications
export function NotificationsStep() {
  const { t } = useTranslation('onboarding');
  const { next, back, index, total } = useStepNav('notifications');
  const [asking, setAsking] = useState(false);
  const [denied, setDenied] = useState(false);
  const enable = async () => {
    setAsking(true);
    const granted = await requestNotificationPermission();
    setAsking(false);
    if (granted) next({ notifications: true });
    else setDenied(true); // calm message, then the user continues
  };
  return (
    <OnboardingLayout
      title={t('notifications.title')}
      subtitle={t('notifications.subtitle')}
      index={index}
      total={total}
      onBack={back}
      continueLabel={denied ? t('nav.continue') : t('notifications.enable')}
      onContinue={denied ? () => next({ notifications: false }) : enable}
      loading={asking}
      {...(denied
        ? {}
        : {
            secondary: {
              label: t('notifications.notNow'),
              onPress: () => next({ notifications: false }),
            },
          })}
    >
      {denied ? (
        <Card>
          <Text tone="muted" accessibilityLiveRegion="polite">
            {t('notifications.denied')}
          </Text>
        </Card>
      ) : null}
    </OnboardingLayout>
  );
}

// 9 ─ App lock: real PIN setup (step 26). Biometrics become available once a PIN exists.
export function LockStep() {
  const { t } = useTranslation('onboarding');
  const { next, back, index, total } = useStepNav('lock');
  const [setup, setSetup] = useState(false);
  return (
    <OnboardingLayout
      title={t('lock.title')}
      subtitle={t('lock.subtitle')}
      index={index}
      total={total}
      onBack={setup ? () => setSetup(false) : back}
      continueLabel={t('lock.enable')}
      continueDisabled={setup}
      onContinue={() => setSetup(true)}
      secondary={{ label: t('lock.notNow'), onPress: () => next({ appLock: false }) }}
    >
      {setup ? <PinSetup onDone={() => next({ appLock: true })} /> : null}
    </OnboardingLayout>
  );
}

// Summary
export function DoneStep() {
  const { t } = useTranslation(['onboarding', 'seed']);
  const { draft, back } = useStepNav('done');
  const { finish, busy } = useFinish();
  const prefs = prefsOf(draft);
  const planDays = draft.acceptPlan ? draft.trainingDays.length : 0;
  const notSet = t('done.notSet');
  const rows: [string, string][] = [
    [t('done.name'), draft.name ?? notSet],
    [
      t('done.units'),
      [draft.units.weight, draft.units.length, draft.units.distance]
        .map((u) => t(`units.${u}`))
        .join(' · '),
    ],
    [t('done.height'), draft.heightCm ? formatQuantity(draft.heightCm, 'height', prefs) : notSet],
    [
      t('done.weight'),
      draft.weightKg ? formatQuantity(draft.weightKg, 'bodyWeight', prefs) : notSet,
    ],
    [
      t('done.goal'),
      (draft.goals.length ? draft.goals : draft.goal ? [draft.goal] : [])
        .map((g) => g.customTitle || t(`goal.options.${g.kind}`))
        .join(', ') || notSet,
    ],
    [t('done.equipment'), t(`equipment.presets.${draft.equipmentPreset}`)],
    [t('done.plan'), planDays ? t('done.planValue', { count: planDays }) : t('done.noPlan')],
  ];
  return (
    <OnboardingLayout
      title={t('done.title')}
      subtitle={t('done.subtitle')}
      index={9}
      total={9}
      onBack={back}
      continueLabel={t('done.finish')}
      onContinue={() => finish(draft)}
      loading={busy}
    >
      <Card>
        {rows.map(([label, value], i) => (
          <View key={label}>
            {i > 0 ? <Divider /> : null}
            <ListRow title={label} trailing={<Text tone="muted">{value}</Text>} />
          </View>
        ))}
      </Card>
    </OnboardingLayout>
  );
}

const useStyles = makeStyles((t) => ({
  planRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, minHeight: 40 },
  day: { width: 44 },
  weekRow: { flexDirection: 'row', gap: t.spacing.md, paddingVertical: t.spacing.sm },
  time: { width: 44 },
  flex: { flex: 1 },
}));
