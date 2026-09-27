import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, TextInput, View } from 'react-native';

import { makeStyles, useTheme } from '@/theme';
import { haptics } from '@/utils/haptics';

import { Icon } from './Icon';
import { Text } from './Text';
import { decimalsOf, parseTyped, repeatDelay, stepValue, type StepBounds } from './numberStep';

export type NumberStepperProps = Partial<Omit<StepBounds, 'step'>> & {
  value: number;
  onChange: (value: number) => void;
  step?: number;
  unit?: string;
  /** Accessible name of the quantity, for example "Weight". */
  label: string;
  /** `xl` = execution screens (64 dp buttons, UI §42). */
  size?: 'md' | 'xl';
  testID?: string;
};

/**
 * − value + stepper. Tap ± to step, long-press to accelerate, tap the number to type it.
 * No typing is needed in the common path (FS §76).
 */
export function NumberStepper({
  value,
  onChange,
  step = 1,
  min,
  max,
  decimals,
  unit,
  label,
  size = 'md',
  testID,
}: NumberStepperProps) {
  const t = useTheme();
  const styles = useStyles();
  const bounds: StepBounds = {
    step,
    ...(min !== undefined ? { min } : {}),
    ...(max !== undefined ? { max } : {}),
    ...(decimals !== undefined ? { decimals } : {}),
  };
  const { t: tr } = useTranslation();
  const places = decimals ?? decimalsOf(step);
  const btn = size === 'xl' ? t.touch.execution : t.touch.min;

  // Latest value for the repeat timer, which outlives renders.
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);

  const bump = (dir: 1 | -1) => {
    const next = stepValue(valueRef.current, dir, bounds);
    if (next !== valueRef.current) {
      valueRef.current = next;
      onChange(next);
      haptics.tap();
    }
  };

  const startRepeat = (dir: 1 | -1) => {
    let ticks = 0;
    const loop = () => {
      bump(dir);
      ticks += 1;
      timer.current = setTimeout(loop, repeatDelay(ticks));
    };
    loop();
  };

  const commit = () => {
    const parsed = parseTyped(draft, bounds);
    if (parsed !== null && parsed !== value) onChange(parsed);
    setEditing(false);
  };

  const atMin = min !== undefined && value <= min;
  const atMax = max !== undefined && value >= max;
  const shown = value.toFixed(places);

  const control = (dir: 1 | -1, disabled: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tr(dir > 0 ? 'increase' : 'decrease', { label })}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => bump(dir)}
      onLongPress={() => startRepeat(dir)}
      onPressOut={stop}
      delayLongPress={350}
      testID={testID ? `${testID}-${dir > 0 ? 'inc' : 'dec'}` : undefined}
      style={({ pressed }) => [
        styles.button,
        { width: btn, height: btn },
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Icon name={dir > 0 ? 'add' : 'remove'} size={size === 'xl' ? 28 : 20} />
    </Pressable>
  );

  return (
    <View
      style={styles.row}
      accessibilityLabel={label}
      accessibilityValue={{ text: `${shown}${unit ? ` ${unit}` : ''}` }}
      {...(testID ? { testID } : {})}
    >
      {control(-1, atMin)}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tr('tapToType', { label, value: `${shown}${unit ? ` ${unit}` : ''}` })}
        onPress={() => {
          setDraft(shown);
          setEditing(true);
        }}
        style={styles.valueBox}
      >
        {editing ? (
          <TextInput
            autoFocus
            value={draft}
            onChangeText={setDraft}
            onBlur={commit}
            onSubmitEditing={commit}
            keyboardType="decimal-pad"
            selectTextOnFocus
            style={[size === 'xl' ? t.typography.metric : t.typography.heading, styles.input]}
            testID={testID ? `${testID}-input` : undefined}
          />
        ) : (
          <Text variant={size === 'xl' ? 'metric' : 'heading'} style={styles.nums}>
            {shown}
          </Text>
        )}
        {unit ? (
          <Text variant="caption" tone="muted">
            {unit}
          </Text>
        ) : null}
      </Pressable>
      {control(1, atMax)}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  button: {
    borderRadius: t.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surfaceRaised,
  },
  pressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
  disabled: { opacity: 0.35 },
  valueBox: { flex: 1, alignItems: 'center', minHeight: t.touch.min, justifyContent: 'center' },
  nums: { fontVariant: ['tabular-nums'] },
  input: { color: t.colors.text, textAlign: 'center', minWidth: 80, padding: 0 },
}));
