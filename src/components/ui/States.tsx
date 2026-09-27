import { useEffect } from 'react';
import { View, type DimensionValue } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useReducedMotion } from '@/hooks/useReducedMotion';
import { makeStyles, useTheme } from '@/theme';

import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type EmptyStateProps = {
  icon?: IconName;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
};

/** Every module needs a useful empty state (FS §56). Never a blank screen. */
export function EmptyState({
  icon = 'empty',
  title,
  body,
  actionLabel,
  onAction,
  testID,
}: EmptyStateProps) {
  const t = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.center} {...(testID ? { testID } : {})}>
      <View style={styles.iconCircle}>
        <Icon name={icon} size={32} color={t.colors.primaryInk} />
      </View>
      <Text variant="heading" align="center">
        {title}
      </Text>
      {body ? (
        <Text tone="muted" align="center">
          {body}
        </Text>
      ) : null}
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} /> : null}
    </View>
  );
}

export type ErrorStateProps = {
  /** Human message (FS §57), never raw technical text. */
  title: string;
  body?: string;
  retryLabel?: string;
  onRetry?: () => void;
  testID?: string;
};

export function ErrorState({ title, body, retryLabel, onRetry, testID }: ErrorStateProps) {
  const t = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.center} accessibilityRole="alert" {...(testID ? { testID } : {})}>
      <Icon name="error" size={40} color={t.colors.danger} />
      <Text variant="heading" align="center">
        {title}
      </Text>
      {body ? (
        <Text tone="muted" align="center">
          {body}
        </Text>
      ) : null}
      {retryLabel && onRetry ? (
        <Button label={retryLabel} variant="secondary" onPress={onRetry} />
      ) : null}
    </View>
  );
}

export type SkeletonProps = {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  preset?: 'block' | 'row' | 'card';
};

/** Pulsing placeholder while data loads. Static under Reduce Motion. */
export function Skeleton({ width = '100%', height = 16, radius, preset = 'block' }: SkeletonProps) {
  const t = useTheme();
  const styles = useStyles();
  const reduced = useReducedMotion();
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    if (!reduced) opacity.set(withRepeat(withTiming(1, { duration: 700 }), -1, true));
  }, [reduced, opacity]);

  const pulse = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  const block = (w: DimensionValue, h: number, r = radius ?? t.radius.sm) => (
    <Animated.View style={[styles.block, { width: w, height: h, borderRadius: r }, pulse]} />
  );

  if (preset === 'row') {
    return (
      <View style={styles.row} accessibilityLabel="Loading">
        {block(44, 44, t.radius.pill)}
        <View style={styles.rowText}>
          {block('60%', 14)}
          {block('40%', 12)}
        </View>
      </View>
    );
  }
  if (preset === 'card') return block('100%', 140, t.radius.xl);
  return block(width, height);
}

const useStyles = makeStyles((t) => ({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.spacing.md,
    padding: t.spacing.xxxl,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: t.colors.borderAccent,
    backgroundColor: t.colors.surface,
    marginBottom: t.spacing.sm,
  },
  block: { backgroundColor: t.colors.surfaceRaised },
  row: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  rowText: { flex: 1, gap: t.spacing.sm },
}));
