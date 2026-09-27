import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import {
  Button,
  Card,
  Header,
  ListRow,
  ScreenContainer,
  SectionHeader,
  Text,
} from '@/components/ui';
import {
  buildSnapshot,
  intervalRemainingMs,
  isStale,
  toRuntime,
  workElapsedMs,
} from '@/domain/execution';
import { formatMinSec } from '@/domain/running/intervals';
import { useTemplate } from '@/hooks/data';
import { useExerciseCatalog } from '@/hooks/useExerciseCatalog';
import { useNow } from '@/hooks/useNow';
import {
  engineNow,
  selectCurrentExercise,
  selectProgress,
  selectRestRemainingMs,
  useExecutionStore,
  type EngineEvent,
} from '@/store/executionStore';
import { makeStyles } from '@/theme';
import { newId } from '@/utils/id';
import { logger } from '@/utils/logger';

const TEMPLATES = [
  { id: 'seed-tpl-upper_body', label: 'Upper Body' },
  { id: 'seed-tpl-interval_run_35', label: 'Interval run 35' },
] as const;

/**
 * Dev harness for the execution engine (step 17): start a seed template, fire events,
 * time-travel and inspect the persisted runtime state. Force-kill the app mid-rest and
 * reopen: the same exercise, set and remaining rest must come back.
 */
export default function DevExecutionScreen() {
  const styles = useStyles();
  const client = useQueryClient();
  const catalog = useExerciseCatalog();
  const state = useExecutionStore((s) => s.state);
  const caughtUp = useExecutionStore((s) => s.caughtUp);
  const store = useExecutionStore.getState();
  const [templateId, setTemplateId] = useState<string>(TEMPLATES[0].id);
  const template = useTemplate(templateId);
  const [error, setError] = useState<string | null>(null);
  useNow(250, !!state);
  const now = engineNow();

  const run = (p: Promise<unknown>) =>
    p.then(
      () => {
        setError(null);
        return client.invalidateQueries();
      },
      (e: unknown) => {
        logger.warn('Harness action failed', { error: e });
        setError(e instanceof Error ? e.message : String(e));
      },
    );
  const fire = (event: EngineEvent) => run(store.dispatch(event));

  const start = () => {
    const tpl = template.data;
    if (!tpl) return;
    const snapshot = buildSnapshot(tpl, (id) => {
      const x = catalog.byId.get(id);
      return x ? { name: x.label, tracking: x.tracking } : undefined;
    });
    run(
      store.start({
        scheduledSessionId: null,
        templateId: tpl.id,
        type: tpl.type,
        title: tpl.name,
        snapshot,
      }),
    );
  };

  const current = selectCurrentExercise(state);
  const progress = selectProgress(state);
  const interval = state?.current ? state.intervals[state.current.index] : undefined;
  const clock = (ms: number) => formatMinSec(ms / 1000);

  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <Header title="Execution engine" onBack={() => router.back()} large={false} />
      {error ? <Text tone="danger">{error}</Text> : null}

      {!state ? (
        <>
          <SectionHeader title="Start" />
          <Card>
            {TEMPLATES.map((t) => (
              <ListRow
                key={t.id}
                title={t.label}
                subtitle={t.id === templateId ? 'Selected' : t.id}
                onPress={() => setTemplateId(t.id)}
              />
            ))}
          </Card>
          <Button label="Start" onPress={start} disabled={!template.data} testID="harness-start" />
        </>
      ) : (
        <>
          <SectionHeader title="State" />
          <Card style={styles.card}>
            <Text variant="bodyStrong">
              {state.kind} · {state.lifecycle} · {state.phase}
              {isStale(state, now) ? ' · STALE' : ''}
            </Text>
            <Text tone="muted">
              Progress {progress.done}/{progress.total}
            </Text>
            {current && state.cursor ? (
              <Text>
                {catalog.byId.get(current.exerciseId)?.label ?? current.exerciseId} · set{' '}
                {state.cursor.set + 1}/{current.sets.length} · {current.tracking}
              </Text>
            ) : null}
            {state.rest ? <Text>Rest {clock(selectRestRemainingMs(state, now))}</Text> : null}
            {state.workTimer ? <Text>Work {clock(workElapsedMs(state, now))}</Text> : null}
            {interval ? (
              <Text>
                {interval.kind} {state.current!.index + 1}/{state.intervals.length} ·{' '}
                {clock(intervalRemainingMs(state, now))} left ·{' '}
                {interval.actualSpeedKmh ?? interval.plannedSpeedKmh ?? '–'} km/h
              </Text>
            ) : null}
            {caughtUp ? (
              <Text tone="primary" onPress={store.dismissCaughtUp}>
                Resumed — {caughtUp} intervals completed while away (tap to dismiss)
              </Text>
            ) : null}
          </Card>

          <SectionHeader title="Events" />
          <View style={styles.row}>
            {state.kind === 'strength' ? (
              <>
                <Btn label="Complete set" onPress={() => fire({ type: 'COMPLETE_SET' })} />
                <Btn label="Skip set" onPress={() => fire({ type: 'SKIP_SET' })} />
                <Btn label="Add set" onPress={() => fire({ type: 'ADD_SET', id: newId() })} />
                <Btn label="Skip exercise" onPress={() => fire({ type: 'SKIP_EXERCISE' })} />
                <Btn label="Rest skip" onPress={() => fire({ type: 'REST_SKIP' })} />
                <Btn
                  label="Rest +15s"
                  onPress={() => fire({ type: 'REST_ADJUST', deltaMs: 15_000 })}
                />
                <Btn label="Work timer" onPress={() => fire({ type: 'START_WORK_TIMER' })} />
                <Btn label="Stop timer" onPress={() => fire({ type: 'STOP_WORK_TIMER' })} />
              </>
            ) : (
              <>
                <Btn label="Next interval" onPress={() => fire({ type: 'INTERVAL_NEXT' })} />
                <Btn
                  label="Repeat"
                  onPress={() => fire({ type: 'INTERVAL_REPEAT', id: newId() })}
                />
                <Btn
                  label="Speed +0.5"
                  onPress={() =>
                    fire({
                      type: 'INTERVAL_ADJUST_SPEED',
                      speedKmh: (interval?.actualSpeedKmh ?? interval?.plannedSpeedKmh ?? 0) + 0.5,
                    })
                  }
                />
                <Btn
                  label="+30s"
                  onPress={() => fire({ type: 'INTERVAL_ADJUST_DURATION', deltaSeconds: 30 })}
                />
              </>
            )}
            {state.lifecycle === 'paused' ? (
              <Btn label="Resume" onPress={() => fire({ type: 'RESUME' })} />
            ) : (
              <Btn label="Pause" onPress={() => fire({ type: 'PAUSE' })} />
            )}
            <Btn label="Finish" onPress={() => fire({ type: 'FINISH' })} />
            <Btn label="Abandon" onPress={() => fire({ type: 'ABANDON' })} />
          </View>

          <SectionHeader title="Time travel" />
          <View style={styles.row}>
            <Btn
              label="+30 s"
              onPress={() => {
                store.timeTravel(30_000);
                void fire({ type: 'TICK' });
              }}
            />
            <Btn
              label="+5 min"
              onPress={() => {
                store.timeTravel(5 * 60_000);
                void fire({ type: 'TICK' });
              }}
            />
          </View>

          <SectionHeader title="runtime_state" />
          <Card>
            <Text variant="caption" selectable>
              {JSON.stringify(toRuntime(state), null, 1)}
            </Text>
          </Card>
        </>
      )}
    </ScreenContainer>
  );
}

function Btn({ label, onPress }: { label: string; onPress: () => void }) {
  return <Button size="sm" variant="secondary" label={label} onPress={onPress} />;
}

const useStyles = makeStyles((t) => ({
  card: { gap: t.spacing.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm },
}));
