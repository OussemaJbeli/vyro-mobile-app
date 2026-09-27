import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { useReducedMotion } from '@/hooks/useReducedMotion';
import { makeStyles, useTheme } from '@/theme';

import { clamp01 } from './ProgressBar';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export type ProgressRingProps = {
  value: number;
  size?: number;
  stroke?: number;
  children?: ReactNode;
  accessibilityLabel?: string;
  testID?: string;
};

/** Circular progress (execution rest timer, goals). Starts at 12 o'clock. */
export function ProgressRing({
  value,
  size = 120,
  stroke = 10,
  children,
  accessibilityLabel,
  testID,
}: ProgressRingProps) {
  const t = useTheme();
  const styles = useStyles();
  const reduced = useReducedMotion();
  const v = clamp01(value);
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const progress = useSharedValue(v);

  useEffect(() => {
    progress.set(reduced ? v : withTiming(v, { duration: t.motion.slow }));
  }, [v, reduced, progress, t.motion.slow]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.get()),
  }));

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      {...(accessibilityLabel ? { accessibilityLabel } : {})}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(v * 100) }}
      style={{ width: size, height: size }}
      {...(testID ? { testID } : {})}
    >
      <Svg width={size} height={size} style={styles.svg}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={t.colors.border}
          strokeWidth={stroke}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={t.colors.primary}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={animatedProps}
        />
      </Svg>
      <View style={styles.center}>{children}</View>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  svg: { position: 'absolute', transform: [{ rotate: '-90deg' }] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
}));
