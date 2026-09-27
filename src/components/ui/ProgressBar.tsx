import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useReducedMotion } from '@/hooks/useReducedMotion';
import { makeStyles, useTheme } from '@/theme';

import { Text } from './Text';

export type ProgressBarProps = {
  /** 0–1, clamped. */
  value: number;
  label?: string;
  showPercent?: boolean;
  height?: number;
  testID?: string;
};

export const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

/** Animated fill bar ("1 / 3 completed ███░░ 33 %"). */
export function ProgressBar({
  value,
  label,
  showPercent = false,
  height = 8,
  testID,
}: ProgressBarProps) {
  const t = useTheme();
  const styles = useStyles();
  const reduced = useReducedMotion();
  const v = clamp01(value);
  const progress = useSharedValue(v);

  useEffect(() => {
    progress.set(reduced ? v : withTiming(v, { duration: t.motion.slow }));
  }, [v, reduced, progress, t.motion.slow]);

  const fill = useAnimatedStyle(() => ({ width: `${progress.get() * 100}%` }));
  const percent = `${Math.round(v * 100)} %`;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(v * 100) }}
      style={styles.wrap}
      {...(testID ? { testID } : {})}
    >
      {label || showPercent ? (
        <View style={styles.labels}>
          {label ? (
            <Text variant="caption" tone="muted">
              {label}
            </Text>
          ) : (
            <View />
          )}
          {showPercent ? <Text variant="caption">{percent}</Text> : null}
        </View>
      ) : null}
      <View style={[styles.track, { height, borderRadius: height / 2 }]}>
        <Animated.View style={[styles.fill, { borderRadius: height / 2 }, fill]} />
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  wrap: { gap: t.spacing.xs + 2 },
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
  track: { backgroundColor: t.colors.border, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: t.colors.primary },
}));
