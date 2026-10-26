import { render, screen, waitFor } from '@testing-library/react-native';

import { SafeAreaProvider } from 'react-native-safe-area-context';

import { QuickActions, TodayStatusCard, WeeklySummary } from '@/components/home/HomeCards';
import { ForecastCard } from '@/components/progress/ForecastCard';
import { openDatabase, type Database } from '@/db/client';
import { migrations } from '@/db/migrations';
import { runMigrations } from '@/db/migrations/runner';
import { createRepositories } from '@/db/repositories';
import { reconcileCycle } from '@/db/cycle';
import { applyRoutine } from '@/db/routine';
import { seedDatabase } from '@/db/seed/seed';
import { openNodeDriver } from '@/db/testing/nodeDriver';
import { createQueryClient, RepositoriesTestProvider } from '@/hooks/data';
import { ThemeProvider } from '@/theme';
import { today } from '@/utils/dates';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => false },
}));

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

let db: Database;
beforeEach(async () => {
  db = await openDatabase(openNodeDriver());
  await runMigrations(db, migrations);
  await seedDatabase(db);
  await applyRoutine(db, { today: today(), force: true });
  await reconcileCycle(db, today());
});
afterEach(() => db.driver.close());

// Render smoke test: the Home cards (1.1.0 redesign) render with a real routine day.
it('renders Today, Quick Actions, This Week and the Forecast without errors', async () => {
  const repos = createRepositories(db);
  const view = await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider>
        <RepositoriesTestProvider repos={repos} client={createQueryClient({ forTests: true })}>
          <TodayStatusCard />
          <QuickActions />
          <WeeklySummary />
          <ForecastCard />
        </RepositoriesTestProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
  await waitFor(() => expect(screen.getByTestId(/^home-(today|rest)$/)).toBeTruthy());
  expect(screen.getByTestId('qa-workout')).toBeTruthy();
  expect(screen.getByTestId('forecast-card')).toBeTruthy();
  await view.unmount();
});
