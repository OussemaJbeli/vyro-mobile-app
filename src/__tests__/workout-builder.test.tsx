import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import NewWorkoutScreen from '@/app/workout/new';
import { openDatabase, type Database } from '@/db/client';
import { migrations } from '@/db/migrations';
import { runMigrations } from '@/db/migrations/runner';
import { createRepositories, type Repositories } from '@/db/repositories';
import { seedDatabase } from '@/db/seed/seed';
import { openNodeDriver } from '@/db/testing/nodeDriver';
import { createQueryClient, RepositoriesTestProvider } from '@/hooks/data';
import { ThemeProvider } from '@/theme';

const mockReplace = jest.fn();
const mockGuard = { blocking: false, blockedAtNavigation: null as boolean | null };
jest.mock('expo-router', () => ({
  router: {
    replace: (...a: unknown[]) => {
      mockGuard.blockedAtNavigation = mockGuard.blocking;
      mockReplace(...a);
    },
    push: jest.fn(),
    back: jest.fn(),
    canGoBack: () => false,
  },
  Redirect: () => null,
  useLocalSearchParams: () => ({ type: 'abs' }),
  useNavigation: () => ({ dispatch: jest.fn() }),
}));
jest.mock('expo-router/react-navigation', () => ({
  usePreventRemove: (prevent: boolean) => {
    mockGuard.blocking = prevent;
  },
}));

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

let db: Database;
let repos: Repositories;
beforeEach(async () => {
  db = await openDatabase(openNodeDriver());
  await runMigrations(db, migrations);
  await seedDatabase(db);
  repos = createRepositories(db);
  mockReplace.mockClear();
});
afterEach(() => db.driver.close());

describe('workout builder', () => {
  it('creates a workout with a picked exercise and opens it', async () => {
    await render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <ThemeProvider>
          <RepositoriesTestProvider repos={repos} client={createQueryClient({ forTests: true })}>
            <NewWorkoutScreen />
          </RepositoriesTestProvider>
        </ThemeProvider>
      </SafeAreaProvider>,
    );
    // Testing Library 14: fireEvent is async and already wrapped in act().
    await fireEvent.changeText(screen.getByTestId('builder-name'), 'Evening Abs');
    await fireEvent.press(screen.getByTestId('builder-add'));
    // Search is covered by exercise-picker.test; Bench Press is among the first rows.
    await waitFor(() => expect(screen.getByTestId('exercise-bench_press')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('exercise-bench_press'));
    await fireEvent.press(screen.getByTestId('picker-add'));
    await waitFor(() => expect(screen.getByTestId('item-reps-0')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('builder-save'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalled(), { timeout: 3000 });

    const [created] = (await repos.templates.list({ type: 'abs' })).filter(
      (x) => x.name === 'Evening Abs',
    );
    const detail = await repos.templates.get(created!.id);
    expect(detail).toMatchObject({ type: 'abs', isSeed: false });
    expect(detail.exercises).toHaveLength(1);
    expect(detail.exercises[0]).toMatchObject({ sets: 4, targetReps: 10, restSeconds: 90 });
    expect(detail.durationMinutes).toBe(8); // 4×30 s + 3×90 s rest + 60 s = 450 s ≈ 8 min
    expect(mockGuard.blockedAtNavigation).toBe(false);
  });
});
