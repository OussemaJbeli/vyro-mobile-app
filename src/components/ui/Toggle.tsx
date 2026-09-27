import { useEffect } from 'react';
import { Pressable } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useReducedMotion } from '@/hooks/useReducedMotion';
import { makeStyles, useTheme } from '@/theme';
import { haptics } from '@/utils/haptics';

export type ToggleProps = {
  value: boolean;
  onChange: (value: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
  testID?: string;
};

const W = 52;
const H = 30;
const KNOB = 24;

/** Accent-track switch (template "Toggle / Switch"). */
export function Toggle({ value, onChange, accessibilityLabel, disabled, testID }: ToggleProps) {
  const t = useTheme();
  const styles = useStyles();
  const reduced = useReducedMotion();
  const x = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    x.set(reduced ? (value ? 1 : 0) : withTiming(value ? 1 : 0, { duration: t.motion.fast }));
  }, [value, reduced, x, t.motion.fast]);

  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() * (W - KNOB - 6) }] }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={() => {
        haptics.tap();
        onChange(!value);
      }}
      style={[
        styles.track,
        { backgroundColor: value ? t.colors.primary : t.colors.border },
        disabled && styles.disabled,
      ]}
      {...(testID ? { testID } : {})}
    >
      <Animated.View style={[styles.knob, knob]} />
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  track: { width: W, height: H, borderRadius: H / 2, padding: 3, justifyContent: 'center' },
  knob: {
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: t.scheme === 'dark' ? t.colors.text : t.colors.surface,
  },
  disabled: { opacity: 0.45 },
}));
