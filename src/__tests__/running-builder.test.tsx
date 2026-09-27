import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import NewRunningScreen from '@/app/running/new';
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
});
afterEach(() => db.driver.close());

describe('running builder', () => {
  it('builds the FS §19 plan from a preset and saves it', async () => {
    await render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <ThemeProvider>
          <RepositoriesTestProvider repos={repos} client={createQueryClient({ forTests: true })}>
            <NewRunningScreen />
          </RepositoriesTestProvider>
        </ThemeProvider>
      </SafeAreaProvider>,
    );
    await fireEvent.press(screen.getByTestId('run-presets'));
    await waitFor(() => expect(screen.getByTestId('preset-intervals35')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('preset-intervals35'));
    await waitFor(() => expect(screen.getByTestId('interval-5')).toBeTruthy());
    expect(screen.getByTestId('run-total')).toHaveTextContent('35:00');
    await fireEvent.press(screen.getByTestId('run-save'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalled(), { timeout: 3000 });

    const created = (await repos.templates.list({ type: 'running' })).find(
      (x) => x.name === 'Intervals 35',
    );
    const detail = await repos.templates.get(created!.id);
    expect(detail).toMatchObject({ type: 'running', durationMinutes: 35 });
    expect(detail.intervals.map((i) => i.kind)).toEqual([
      'warmup',
      'run',
      'sprint',
      'run',
      'sprint',
      'cooldown',
    ]);
    expect(detail.intervals[4]!.speedKmh! / 1.609344).toBeCloseTo(9, 6);
    expect(mockGuard.blockedAtNavigation).toBe(false);
  });
});
