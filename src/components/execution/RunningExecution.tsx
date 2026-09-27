import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Button, Card, EmptyState, ScreenContainer, Skeleton, Text } from '@/components/ui';
import { routes } from '@/constants/routes';
import {
  activeMs,
  intervalElapsedMs,
  intervalRemainingMs,
  type ExecInterval,
} from '@/domain/execution';
import { formatMinSec, type RunInterval } from '@/domain/running/intervals';
import { useUnitPrefs } from '@/hooks/data';
import { useNow } from '@/hooks/useNow';
import { speakCue } from '@/services/audio/speech';
import { allowRotation, lockPortrait } from '@/services/orientation';
import { engineNow, useExecutionStore, type EngineEvent } from '@/store/executionStore';
import { useSettingsStore } from '@/store/settingsStore';
import { toast } from '@/store/uiStore';
import { makeStyles, useTheme } from '@/theme';
import { newId } from '@/utils/id';
import { formatQuantity, fromCanonical, toCanonical, unitLabel } from '@/utils/units';

import { ExecutionShell } from './ExecutionShell';
import {
  BigMetric,
  ExecutionBackdrop,
  GlowRing,
  MetricCard,
  NextCard,
  PhaseStrip,
  PillButton,
  RoundButton,
  type Phase,
} from './parts';
import { useExecutionExit } from './useExecutionExit';
import { useTimerCues } from './useTimerCues';

const toRun = (iv: ExecInterval): RunInterval => ({
  kind: iv.kind,
  durationSeconds: iv.targetSeconds,
  speedKmh: iv.actualSpeedKmh ?? iv.plannedSpeedKmh,
  inclinePercent: iv.actualInclinePercent ?? iv.plannedInclinePercent,
  label: iv.label,
});

/**
 * Treadmill interval screen (step 19, FS §19–20): glanceable at arm's length, with
 * countdown, automatic transitions, cues, live adjustments and actual tracking.
 */
export function RunningExecution({ executionId }: { executionId: string }) {
  const { t, i18n } = useTranslation(['execution', 'running', 'errors', 'common']);
  const theme = useTheme();
  const styles = useStyles();
  const prefs = useUnitPrefs();
  const voice = useSettingsStore((s) => s.values['training.voiceCues']);
  const state = useExecutionStore((s) => s.state);
  const caughtUp = useExecutionStore((s) => s.caughtUp);
  const live = state && state.executionId === executionId ? state : null;
  const { finish, discard, finishing } = useExecutionExit(executionId);
  const { width, height } = useWindowDimensions();
  // Which value the −/+ buttons change (template: speed | incline).
  const [metric, setMetric] = useState<'speed' | 'incline'>('speed');
  useNow(250, !!live && live.lifecycle === 'active');
  const now = engineNow();

  // Only this screen may rotate (treadmill phone holders).
  useFocusEffect(
    useCallback(() => {
      allowRotation();
      return lockPortrait;
    }, []),
  );

  const dispatch = (event: EngineEvent) =>
    useExecutionStore
      .getState()
      .dispatch(event)
      .catch(() => toast.error(t('errors:DB_WRITE_FAILED')));

  const counting = !!live && live.lifecycle === 'active' && now < live.startedAt;
  const current = live?.current ?? null;
  const remaining = live && current && !counting ? intervalRemainingMs(live, now) : null;
  const due = remaining !== null && remaining <= 0 && live?.lifecycle === 'active';
  useEffect(() => {
    if (due) void useExecutionStore.getState().dispatch({ type: 'TICK' });
  }, [due]);
  // Countdown and "3 s before the change" beeps/haptics.
  useTimerCues(live?.lifecycle !== 'active' ? null : counting ? live.startedAt - now : remaining);

  // Spoken cue 3 s before each change (setting "Voice cues").
  const cueSecond = remaining === null ? null : Math.ceil(remaining / 1000);
  const next = live && current ? live.intervals[current.index + 1] : undefined;
  const nextKey = next ? `${current!.index}` : null;
  const spoken = useRef<string | null>(null);
  useEffect(() => {
    if (!voice || cueSecond !== 3 || !live || !current) return;
    const key = `${current.index}:${current.startActiveMs}`;
    if (spoken.current === key) return;
    spoken.current = key;
    if (!next) {
      speakCue(t('run.voiceDone'));
      return;
    }
    const kind = t(`running:kinds.${next.kind}`);
    const speed = next.actualSpeedKmh ?? next.plannedSpeedKmh;
    speakCue(
      speed
        ? t('run.voiceNext', { kind, speed: formatQuantity(speed, 'speed', prefs, i18n.language) })
        : t('run.voiceNextNoSpeed', { kind }),
    );
  }, [voice, cueSecond, live, current, next, nextKey, t, prefs, i18n.language]);

  if (!live) {
    return (
      <ScreenContainer edges={['top', 'bottom']} scroll={false}>
        {finishing ? (
          <Skeleton preset="card" />
        ) : (
          <EmptyState
            icon="status-done"
            title={t('ended.title')}
            body={t('ended.body')}
            actionLabel={t('ended.home')}
            onAction={() => router.replace(routes.home)}
          />
        )}
      </ScreenContainer>
    );
  }

  const locale = i18n.language;
  const paused = live.lifecycle === 'paused';
  const iv = current ? live.intervals[current.index] : undefined;
  const speedKmh = iv ? (iv.actualSpeedKmh ?? iv.plannedSpeedKmh ?? 0) : 0;
  const inclinePct = iv ? (iv.actualInclinePercent ?? iv.plannedInclinePercent ?? 0) : 0;
  const speedUnit = prefs.speed;
  const speedDisplay = Math.round(fromCanonical(speedKmh, speedUnit) * 10) / 10;
  const plan = live.intervals.map(toRun);
  const totalMs = plan.reduce((s, x) => s + x.durationSeconds * 1000, 0);
  const doneMs =
    live.intervals
      .slice(0, current?.index ?? live.intervals.length)
      .reduce((s, x) => s + x.targetSeconds * 1000, 0) +
    (current ? intervalElapsedMs(live, now) : 0);
  const hasLogged = live.intervals.some((i) => i.status === 'done' || i.status === 'partial');
  const landscape = width > height;
  const speedText = (kmh: number | null) =>
    kmh ? formatQuantity(kmh, 'speed', prefs, locale) : null;

  const ringSize = Math.min(landscape ? height * 0.62 : width - 72, 300);
  const intervalMs = iv ? iv.targetSeconds * 1000 : 0;
  const nextSpeed = next ? speedText(next.actualSpeedKmh ?? next.plannedSpeedKmh) : null;
  const adjust = (dir: 1 | -1) =>
    void dispatch(
      metric === 'speed'
        ? {
            type: 'INTERVAL_ADJUST_SPEED',
            speedKmh: toCanonical(
              Math.max(0, Math.round((speedDisplay + dir * 0.1) * 10) / 10),
              speedUnit,
            ),
          }
        : {
            type: 'INTERVAL_ADJUST_INCLINE',
            inclinePercent: Math.max(-5, Math.min(30, inclinePct + dir * 0.5)),
          },
    );

  const ring = iv ? (
    // Interval change: a short fade on the new readout (communicates the transition).
    <Animated.View key={current!.index} entering={FadeIn.duration(250)} style={styles.center}>
      <GlowRing
        value={intervalMs > 0 ? (remaining ?? intervalMs) / intervalMs : 0}
        size={ringSize}
        accessibilityLabel={t('run.remaining', { time: formatMinSec((remaining ?? 0) / 1000) })}
      >
        <Text variant="overline" tone="muted" testID="run-interval">
          {t('run.intervalOf', { current: current!.index + 1, total: live.intervals.length })}
        </Text>
        <Text variant="bodyStrong" style={styles.kind}>
          {t(`running:kinds.${iv.kind}`).toUpperCase()}
          {iv.label && iv.label.length < 12 ? ` · ${iv.label.toUpperCase()}` : ''}
          {iv.isRepeat ? ` · ${t('complete.repeat')}` : ''}
        </Text>
        <View style={styles.kindBar} />
        <Text
          style={[styles.clock, { fontSize: ringSize * 0.26, lineHeight: ringSize * 0.3 }]}
          testID="run-remaining"
        >
          {formatMinSec(Math.ceil((remaining ?? intervalMs) / 1000))}
        </Text>
        <Text tone="muted">{t('run.time')}</Text>
      </GlowRing>
    </Animated.View>
  ) : (
    <Card style={styles.done}>
      <Text variant="heading">{t('run.allDone')}</Text>
      <Text tone="muted">{t('run.allDoneBody')}</Text>
      <Button
        size="xl"
        icon="check"
        label={t('finish')}
        fullWidth
        onPress={() => void finish()}
        testID="run-finish"
      />
      <Button
        size="xl"
        variant="secondary"
        icon="repeat"
        label={t('run.repeat')}
        fullWidth
        onPress={() => void dispatch({ type: 'INTERVAL_REPEAT', id: newId() })}
      />
    </Card>
  );

  const controls = iv ? (
    <View style={styles.controls}>
      <View style={styles.adjustRow}>
        <RoundButton
          icon="remove"
          accessibilityLabel={t('run.less', { what: t(`run.${metric}`) })}
          onPress={() => adjust(-1)}
          testID="run-dec"
        />
        <BigMetric
          icon="speed"
          value={speedDisplay.toFixed(1)}
          unit={unitLabel(speedUnit)}
          selected={metric === 'speed'}
          onPress={() => setMetric('speed')}
          accessibilityLabel={`${t('run.speed')} ${speedDisplay.toFixed(1)} ${unitLabel(speedUnit)}`}
          testID="run-speed"
        />
        <View style={styles.vr} />
        <BigMetric
          icon="incline"
          value={inclinePct.toFixed(1)}
          unit="%"
          selected={metric === 'incline'}
          onPress={() => setMetric('incline')}
          accessibilityLabel={`${t('run.incline')} ${inclinePct.toFixed(1)} %`}
          testID="run-incline"
        />
        <RoundButton
          icon="add"
          accessibilityLabel={t('run.more', { what: t(`run.${metric}`) })}
          onPress={() => adjust(1)}
          testID="run-inc"
        />
      </View>
      <View style={styles.row}>
        <PillButton
          icon="rewind"
          label={t('run.minus30')}
          accessibilityLabel={t('run.minus30A11y')}
          onPress={() => void dispatch({ type: 'INTERVAL_ADJUST_DURATION', deltaSeconds: -30 })}
          testID="run-minus30"
        />
        <PillButton
          icon="fast_forward"
          label={t('run.plus30')}
          accessibilityLabel={t('run.plus30A11y')}
          onPress={() => void dispatch({ type: 'INTERVAL_ADJUST_DURATION', deltaSeconds: 30 })}
          testID="run-plus30"
        />
      </View>
      <NextCard
        label={next ? t('run.next') : ''}
        detail={
          next
            ? [t(`running:kinds.${next.kind}`), nextSpeed, formatMinSec(next.targetSeconds)]
                .filter(Boolean)
                .join('  ·  ')
            : t('run.lastInterval')
        }
      />
      <View style={styles.row}>
        <PillButton
          icon="fast_forward"
          label={t('run.skip')}
          onPress={() => void dispatch({ type: 'INTERVAL_NEXT' })}
          testID="run-skip"
        />
        <PillButton
          icon="repeat"
          tone="neutral"
          label={t('run.repeat')}
          onPress={() => void dispatch({ type: 'INTERVAL_REPEAT', id: newId() })}
          testID="run-repeat"
        />
      </View>
    </View>
  ) : null;

  const phases: Phase[] = live.intervals.map((x, i) => ({
    key: x.id,
    label: t(`running:kinds.${x.kind}`),
    state: current && i === current.index ? 'current' : x.status === 'pending' ? 'pending' : 'done',
  }));

  return (
    <ExecutionShell
      title={live.title}
      elapsedMs={activeMs(live, now)}
      paused={paused}
      onPauseToggle={() => void dispatch({ type: paused ? 'RESUME' : 'PAUSE' })}
      onFinish={() => void finish()}
      onDiscard={discard}
      hasLogged={hasLogged}
      backdrop={<ExecutionBackdrop kind="running" />}
    >
      <LinearGradient
        colors={['transparent', theme.colors.primarySoft]}
        style={[styles.glow, { pointerEvents: 'none' }]}
      />
      <ScrollView contentContainerStyle={styles.body}>
        <MetricCard
          icon="running"
          label={t('run.speed')}
          value={speedDisplay.toFixed(1)}
          unit={unitLabel(speedUnit)}
          level={totalMs > 0 ? Math.min(1, doneMs / totalMs) : 1}
          right={t('run.left', { time: formatMinSec(Math.max(0, totalMs - doneMs) / 1000) })}
          testID="run-total-progress"
        />
        {caughtUp > 0 ? (
          <Card style={styles.banner}>
            <Text style={styles.flex}>{t('resumed', { count: caughtUp })}</Text>
            <Button
              size="sm"
              variant="ghost"
              label={t('common:close')}
              onPress={() => useExecutionStore.getState().dismissCaughtUp()}
            />
          </Card>
        ) : null}
        <View style={landscape ? styles.columns : styles.stack}>
          <View style={landscape ? styles.flex : undefined}>{ring}</View>
          {controls ? <View style={landscape ? styles.flex : undefined}>{controls}</View> : null}
        </View>
        <PhaseStrip phases={phases} />
      </ScrollView>

      {counting ? (
        <View style={styles.layer}>
          <Card style={styles.done}>
            <Text variant="heading" align="center">
              {t('run.countdown')}
            </Text>
            <Text
              variant="timer"
              align="center"
              style={styles.countdown}
              accessibilityLiveRegion="polite"
            >
              {Math.max(1, Math.ceil((live.startedAt - now) / 1000))}
            </Text>
            <Button
              size="xl"
              label={t('run.skipCountdown')}
              fullWidth
              onPress={() => void dispatch({ type: 'SKIP_COUNTDOWN' })}
              testID="run-start-now"
            />
          </Card>
        </View>
      ) : null}
      {paused ? (
        <View style={styles.layer}>
          <Card style={styles.done}>
            <Text variant="heading">{t('paused')}</Text>
            <Button
              size="xl"
              icon="play"
              label={t('exit.resume')}
              fullWidth
              onPress={() => void dispatch({ type: 'RESUME' })}
              testID="paused-resume"
            />
          </Card>
        </View>
      ) : null}
    </ExecutionShell>
  );
}

const useStyles = makeStyles((t) => ({
  body: { gap: t.spacing.lg, paddingBottom: t.spacing.xl },
  center: { alignItems: 'center' },
  kind: { color: t.colors.primaryInk, letterSpacing: 1.5, marginTop: 2 },
  kindBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: t.colors.primary,
    marginVertical: t.spacing.sm,
  },
  clock: { ...t.typography.metric, color: t.colors.text, fontVariant: ['tabular-nums'] },
  countdown: { fontSize: 96, lineHeight: 104 },
  controls: { gap: t.spacing.lg },
  adjustRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  vr: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: t.colors.border,
    marginVertical: t.spacing.lg,
  },
  row: { flexDirection: 'row', gap: t.spacing.md },
  stack: { gap: t.spacing.xl },
  columns: { flexDirection: 'row', gap: t.spacing.lg, alignItems: 'center' },
  flex: { flex: 1 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
  glow: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 180 },
  done: { gap: t.spacing.md },
  layer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    padding: t.spacing.md,
    backgroundColor: t.colors.overlay,
  },
}));
