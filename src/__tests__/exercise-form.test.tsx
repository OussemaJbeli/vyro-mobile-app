import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import ExerciseFormScreen from '@/app/exercise/new';
import { openDatabase, type Database } from '@/db/client';
import { migrations } from '@/db/migrations';
import { runMigrations } from '@/db/migrations/runner';
import { createRepositories, type Repositories } from '@/db/repositories';
import { seedDatabase } from '@/db/seed/seed';
import { openNodeDriver } from '@/db/testing/nodeDriver';
import { createQueryClient, RepositoriesTestProvider } from '@/hooks/data';
import { useUiStore } from '@/store/uiStore';
import { ThemeProvider } from '@/theme';

const mockReplace = jest.fn();
// Tracks whether the unsaved-changes guard is blocking navigation at each render.
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
  useLocalSearchParams: () => ({}),
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
  useUiStore.setState({ toasts: [] });
});
afterEach(() => db.driver.close());

describe('exercise form', () => {
  it('creates a custom exercise and opens it', async () => {
    await render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <ThemeProvider>
          <RepositoriesTestProvider repos={repos} client={createQueryClient({ forTests: true })}>
            <ExerciseFormScreen />
          </RepositoriesTestProvider>
        </ThemeProvider>
      </SafeAreaProvider>,
    );
    await fireEvent.changeText(screen.getByTestId('exercise-name'), 'Band Pull-Apart');
    await fireEvent.press(screen.getByTestId('exercise-save'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalled(), { timeout: 3000 });
    const created = (await repos.exercises.search({ customOnly: true }))[0];
    expect(created).toMatchObject({
      name: 'Band Pull-Apart',
      isCustom: true,
      primaryMuscle: 'chest',
    });
    expect(useUiStore.getState().toasts).toEqual([]);
    // Regression: the guard must be off when the post-save redirect happens.
    expect(mockGuard.blockedAtNavigation).toBe(false);
  });
});
