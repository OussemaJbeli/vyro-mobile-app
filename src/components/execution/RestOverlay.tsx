import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Card, Icon, Text } from '@/components/ui';
import { formatMinSec } from '@/domain/running/intervals';
import { makeStyles, useTheme } from '@/theme';
import { withAlpha } from '@/theme/color';

import { ExerciseVideo } from '@/components/exercises/ExerciseVideo';
import { brand } from '@/theme/brand';

import { GlowRing, PillButton } from './parts';

type Props = {
  remainingMs: number;
  totalMs: number;
  nextText: string | null;
  /** Demo loop of the exercise coming next, so it stays visible while resting. */
  video?: number | null;
  onSkip: () => void;
  onAdjust: (deltaMs: number) => void;
  onMinimize: () => void;
};

const clock = (ms: number) => formatMinSec(Math.ceil(ms / 1000));

/** Rest overlay (UI §12): ring, −15 s / Skip / +15 s, next-set preview. Tap outside to minimize. */
export function RestOverlay({
  remainingMs,
  totalMs,
  nextText,
  video = null,
  onSkip,
  onAdjust,
  onMinimize,
}: Props) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation('execution');
  const over = remainingMs <= 0;
  return (
    <Animated.View
      style={StyleSheet.absoluteFill}
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
      testID="rest-overlay"
    >
      <Pressable
        style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(theme.colors.bg, 0.86) }]}
        onPress={onMinimize}
        accessibilityRole="button"
        accessibilityLabel={t('rest.minimize')}
      />
      <View style={[styles.center, { pointerEvents: 'box-none' }]}>
        <Card style={styles.card}>
          <Text variant="overline" tone="muted">
            {t('rest.title')}
          </Text>
          {video ? <ExerciseVideo source={video} style={styles.video} fit="contain" /> : null}
          <GlowRing
            value={totalMs > 0 ? remainingMs / totalMs : 0}
            size={video ? 190 : 240}
            accessibilityLabel={
              over ? t('rest.over') : t('rest.pill', { time: clock(remainingMs) })
            }
          >
            <Text variant="timer" style={styles.tabular} accessibilityLiveRegion="polite">
              {over ? t('rest.over') : clock(remainingMs)}
            </Text>
          </GlowRing>
          <View style={styles.row}>
            <PillButton
              icon="rewind"
              label={t('rest.minus')}
              accessibilityLabel={t('rest.minusA11y')}
              onPress={() => onAdjust(-15_000)}
              testID="rest-minus"
            />
            <PillButton
              icon="fast_forward"
              label={t('rest.plus')}
              accessibilityLabel={t('rest.plusA11y')}
              onPress={() => onAdjust(15_000)}
              testID="rest-plus"
            />
          </View>
          <View style={styles.row}>
            <PillButton
              icon="skip"
              tone="solid"
              label={t('rest.skip')}
              onPress={onSkip}
              testID="rest-skip"
            />
          </View>
          {nextText ? (
            <Text tone="muted" align="center">
              {nextText}
            </Text>
          ) : null}
        </Card>
      </View>
    </Animated.View>
  );
}

/** Minimized rest: a top pill, so the next set can be adjusted while resting. */
export function RestPill({ remainingMs, onPress }: { remainingMs: number; onPress: () => void }) {
  const styles = useStyles();
  const { t } = useTranslation('execution');
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('rest.pillA11y', { time: clock(remainingMs) })}
      style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
      testID="rest-pill"
    >
      <Icon name="timer" size={20} />
      <Text variant="bodyStrong" style={styles.tabular}>
        {remainingMs <= 0 ? t('rest.over') : t('rest.pill', { time: clock(remainingMs) })}
      </Text>
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  center: { flex: 1, justifyContent: 'center', padding: t.spacing.md },
  card: { alignItems: 'center', gap: t.spacing.md, paddingVertical: t.spacing.lg },
  row: { flexDirection: 'row', gap: t.spacing.sm, alignSelf: 'stretch' },
  video: {
    alignSelf: 'stretch',
    aspectRatio: 16 / 9,
    borderRadius: t.radius.lg,
    overflow: 'hidden',
    backgroundColor: brand.white,
  },
  tabular: { fontVariant: ['tabular-nums'] },
  pill: {
    minHeight: t.touch.execution,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: t.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.spacing.sm,
    paddingHorizontal: t.spacing.lg,
  },
  pressed: { opacity: 0.8 },
}));
