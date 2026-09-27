import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ChipGroup, Input, NumberStepper, Text } from '@/components/ui';
import { type IntervalKind } from '@/domain/running/intervals';
import { makeStyles } from '@/theme';
import { fromCanonical, roundToStep, toCanonical, type UnitPrefs } from '@/utils/units';

const KINDS: IntervalKind[] = ['warmup', 'run', 'walk', 'sprint', 'recovery', 'cooldown'];

/** mm:ss as two steppers (seconds in 5 s steps). */
export function DurationFields({
  seconds,
  onChange,
}: {
  seconds: number;
  onChange: (s: number) => void;
}) {
  const { t } = useTranslation('running');
  const styles = useStyles();
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return (
    <View style={styles.row}>
      <View style={styles.flex}>
        <Text variant="caption" tone="muted">
          {t('editor.minutes')}
        </Text>
        <NumberStepper
          label={t('editor.minutes')}
          value={m}
          onChange={(v) => onChange(v * 60 + s)}
          min={0}
          max={180}
        />
      </View>
      <View style={styles.flex}>
        <Text variant="caption" tone="muted">
          {t('editor.seconds')}
        </Text>
        <NumberStepper
          label={t('editor.seconds')}
          value={s}
          onChange={(v) => onChange(m * 60 + v)}
          step={5}
          min={0}
          max={55}
        />
      </View>
    </View>
  );
}

/** Speed in the user's unit; stored canonically in km/h (untouched values stay exact). */
export function SpeedField({
  kmh,
  onChange,
  units,
}: {
  kmh: number | null;
  onChange: (kmh: number) => void;
  units: UnitPrefs;
}) {
  const { t } = useTranslation(['running', 'onboarding']);
  const label = t('running:editor.speed', { unit: t(`onboarding:units.${units.speed}`) });
  return (
    <View>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <NumberStepper
        label={label}
        value={roundToStep(fromCanonical(kmh ?? 0, units.speed), 0.1)}
        onChange={(v) => onChange(toCanonical(v, units.speed))}
        step={0.1}
        min={0}
        max={units.speed === 'mph' ? 18.6 : 30}
      />
    </View>
  );
}

export function KindChips({
  value,
  onChange,
}: {
  value: IntervalKind;
  onChange: (k: IntervalKind) => void;
}) {
  const { t } = useTranslation('running');
  return (
    <ChipGroup
      options={KINDS.map((k) => ({ value: k, label: t(`kinds.${k}`) }))}
      value={value}
      onChange={onChange}
    />
  );
}

export function InclineField({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number) => void;
}) {
  const { t } = useTranslation('running');
  return (
    <View>
      <Text variant="caption" tone="muted">
        {t('editor.incline')}
      </Text>
      <NumberStepper
        label={t('editor.incline')}
        value={value ?? 0}
        onChange={onChange}
        step={0.5}
        min={0}
        max={15}
        unit="%"
      />
    </View>
  );
}

export function LabelField({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string) => void;
}) {
  const { t } = useTranslation('running');
  return (
    <Input
      label={t('editor.label')}
      placeholder={t('editor.labelPlaceholder')}
      value={value ?? ''}
      onChangeText={onChange}
      maxLength={30}
    />
  );
}

const useStyles = makeStyles((t) => ({
  row: { flexDirection: 'row', gap: t.spacing.md },
  flex: { flex: 1, gap: t.spacing.xs },
}));
