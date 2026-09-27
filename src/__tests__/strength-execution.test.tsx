import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { type ReactNode, type useEffect as ReactUseEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CompletionSummary } from '@/components/execution/CompletionSummary';
import { StrengthExecution } from '@/components/execution/StrengthExecution';
import { openDatabase, type Database } from '@/db/client';
import { migrations } from '@/db/migrations';
import { runMigrations } from '@/db/migrations/runner';
import { createRepositories, type Repositories } from '@/db/repositories';
import { seedId } from '@/db/seed/ids';
import { seedDatabase } from '@/db/seed/seed';
import { openNodeDriver } from '@/db/testing/nodeDriver';
import { buildSnapshot, type Tracking } from '@/domain/execution';
import { createQueryClient, RepositoriesTestProvider } from '@/hooks/data';
import { createRunner } from '@/services/execution/runner';
import { useExecutionStore } from '@/store/executionStore';
import { ThemeProvider } from '@/theme';
import { type PlannedSnapshot } from '@/types/domain';
import { setClock } from '@/utils/clock';
import { today } from '@/utils/dates';

const mockReplace = jest.fn();
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<{ useEffect: typeof ReactUseEffect }>('react');
  return {
    router: {
      replace: (...a: unknown[]) => mockReplace(...a),
      push: jest.fn(),
      back: jest.fn(),
      canGoBack: () => false,
    },
    useFocusEffect: (cb: () => void | (() => void)) => useEffect(cb, [cb]),
  };
});

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

let db: Database;
let repos: Repositories;
let now = Date.parse('2026-09-26T18:00:00.000Z');
let autoRest = false;

beforeEach(async () => {
  // Repository timestamps (started_at…) must follow the same clock as the engine;
  // otherwise the test depends on the real time of day.
  setClock(() => new Date(now));
  db = await openDatabase(openNodeDriver());
  await runMigrations(db, migrations);
  await seedDatabase(db);
  repos = createRepositories(db);
  mockReplace.mockClear();
  useExecutionStore.getState().setState(null);
  useExecutionStore
    .getState()
    .bind(
      createRunner(repos.executions, { settings: () => ({ autoRest, keepAwake: false }) }),
      () => now,
    );
});
afterEach(async () => {
  setClock(null);
  useExecutionStore.getState().bind(null);
  useExecutionStore.getState().setState(null);
  await db.driver.close();
});

function wrap(node: ReactNode) {
  return (
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider>
        <RepositoriesTestProvider repos={repos} client={createQueryClient({ forTests: true })}>
          {node}
        </RepositoriesTestProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

async function lookup() {
  const rows = await db.all<{ id: string; name: string; tracking: Tracking }>(
    'SELECT id, name, tracking FROM exercises',
  );
  const byId = new Map(rows.map((x) => [x.id, x]));
  return (id: string) => byId.get(id);
}

const logged = () =>
  (useExecutionStore.getState().state?.exercises ?? [])
    .flatMap((e) => e.sets)
    .filter((s) => s.status === 'done').length;

async function startFrom(snapshot: PlannedSnapshot, scheduledSessionId: string | null = null) {
  return useExecutionStore.getState().start({
    scheduledSessionId,
    templateId: snapshot.templateId,
    type: snapshot.type,
    title: snapshot.name,
    snapshot,
  });
}

// Full-screen flows: slower when the whole suite runs in parallel.
jest.setTimeout(30_000);

describe('strength execution screen', () => {
  it('completes Upper Body with one tap per set, then saves the review', async () => {
    autoRest = false;
    const session = await repos.schedule.create({
      templateId: seedId.template('upper_body'),
      title: 'Upper Body',
      type: 'gym',
      scheduledDate: today(),
      startTime: null,
      endTime: null,
      durationMinutes: null,
      orderInDay: 0,
      reminderOffsetMinutes: null,
      skipReason: null,
      notes: null,
    });
    const tpl = await repos.templates.get(seedId.template('upper_body'));
    const state = await startFrom(buildSnapshot(tpl, await lookup()), session.id);
    await render(wrap(<StrengthExecution executionId={state.executionId} />));
    await waitFor(() =>
      expect(screen.getByTestId('execution-exercise')).toHaveTextContent('Bench Press'),
    );
    expect(screen.getByTestId('execution-set')).toHaveTextContent('Set 1 / 4');

    let taps = 0;
    while (useExecutionStore.getState().state?.cursor) {
      now += 45_000;
      const before = logged();
      await fireEvent.press(screen.getByTestId('complete-set'));
      await waitFor(() => expect(logged()).toBe(before + 1));
      taps++;
    }
    const totalSets = tpl.exercises.reduce((n, e) => n + e.sets, 0);
    expect(taps).toBe(totalSets);
    await fireEvent.press(screen.getByTestId('finish'));
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith(
        expect.objectContaining({ params: { executionId: state.executionId } }),
      ),
    );
    const done = await repos.executions.get(state.executionId);
    expect(done).toMatchObject({ status: 'completed', outcome: 'as_planned' });
    expect((await repos.schedule.getSession(session.id)).status).toBe('completed');

    await screen.unmount();
    await render(wrap(<CompletionSummary executionId={state.executionId} />));
    await waitFor(() => expect(screen.getByText('Completed as planned')).toBeTruthy());
    expect(screen.getByTestId('complete-sets')).toHaveTextContent(
      new RegExp(`${totalSets}/${totalSets}`),
    );
    await fireEvent.press(screen.getByTestId('effort-7'));
    await fireEvent.press(screen.getByTestId('complete-save'));
    // The day's only activity is done → Today complete (step 20).
    await waitFor(() => expect(mockReplace).toHaveBeenLastCalledWith('/today-complete'));
    expect((await repos.executions.get(state.executionId)).perceivedEffort).toBe(7);
  });

  it('swaps Cable Fly → Dumbbell Fly; rest overlay and pause work; the diff shows the swap', async () => {
    autoRest = true;
    const cable = seedId.exercise('cable_fly');
    const state = await startFrom({
      schemaVersion: 1,
      templateId: null,
      name: 'Chest',
      type: 'gym',
      exercises: [
        {
          exerciseId: cable,
          name: 'Cable Fly',
          tracking: 'weight_reps',
          orderIndex: 0,
          sets: 2,
          targetReps: 12,
          targetDurationSeconds: null,
          targetWeightKg: 15,
          restSeconds: 60,
          notes: null,
        },
      ],
      intervals: [],
    });
    await render(wrap(<StrengthExecution executionId={state.executionId} />));
    await waitFor(() =>
      expect(screen.getByTestId('execution-exercise')).toHaveTextContent('Cable Fly'),
    );

    await fireEvent.press(screen.getByTestId('execution-swap'));
    await waitFor(() => expect(screen.getByTestId('exercise-dumbbell_fly')).toBeTruthy());
    await fireEvent.press(screen.getByText('Machine busy'));
    await fireEvent.press(screen.getByTestId('exercise-dumbbell_fly'));
    await waitFor(() =>
      expect(screen.getByTestId('execution-exercise')).toHaveTextContent('Dumbbell Fly'),
    );

    now += 30_000;
    await fireEvent.press(screen.getByTestId('complete-set'));
    await waitFor(() => expect(screen.getByTestId('rest-overlay')).toBeTruthy());
    expect(screen.getByText('1:00')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('rest-plus'));
    await waitFor(() => expect(screen.getByText('1:15')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('execution-pause'));
    await waitFor(() => expect(screen.getByTestId('paused-resume')).toBeTruthy());
    expect(screen.queryByTestId('rest-overlay')).toBeNull();
    now += 10 * 60_000; // paused time never eats rest
    await fireEvent.press(screen.getByTestId('paused-resume'));
    await waitFor(() => expect(screen.getByText('1:15')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('rest-skip'));
    await waitFor(() => expect(screen.queryByTestId('rest-overlay')).toBeNull());
    await fireEvent.press(screen.getByTestId('complete-set'));
    await waitFor(() => expect(screen.getByTestId('finish')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('finish'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalled());

    const done = await repos.executions.get(state.executionId);
    expect(done.outcome).toBe('modified');
    expect(done.exercises[0]).toMatchObject({
      exerciseId: seedId.exercise('dumbbell_fly'),
      plannedExerciseId: cable,
      substitutionReason: 'Machine busy',
    });
    expect(done.pausedSeconds).toBe(600);

    await screen.unmount();
    await render(wrap(<CompletionSummary executionId={state.executionId} />));
    await waitFor(() => expect(screen.getByText('Swapped from Cable Fly')).toBeTruthy());
    expect(screen.getByText('Completed with changes')).toBeTruthy();
  });

  it('discard needs a double confirmation and removes an empty workout', async () => {
    const tpl = await repos.templates.get(seedId.template('abs'));
    const state = await startFrom(buildSnapshot(tpl, await lookup()));
    expect(state.circuit).toBe(true);
    await render(wrap(<StrengthExecution executionId={state.executionId} />));
    await waitFor(() => expect(screen.getByText('Round 1 / 3')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('execution-exit'));
    await fireEvent.press(screen.getByTestId('exit-discard'));
    await waitFor(() => expect(screen.getByTestId('discard-confirm-1')).toBeTruthy());
    expect(screen.getByText('Nothing was logged. This workout will be removed.')).toBeTruthy();
    await fireEvent.press(within(screen.getByTestId('discard-confirm-1')).getByText('Discard'));
    await waitFor(() => expect(screen.getByTestId('discard-confirm-2')).toBeTruthy());
    await fireEvent.press(within(screen.getByTestId('discard-confirm-2')).getByText('Discard'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
    expect(useExecutionStore.getState().state).toBeNull();
    expect(await repos.executions.getActive()).toBeNull();
    await expect(repos.executions.get(state.executionId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
