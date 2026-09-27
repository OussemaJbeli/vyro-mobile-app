import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ExercisePickerSheet } from '@/components/workout/ExercisePickerSheet';
import { openDatabase } from '@/db/client';
import { migrations } from '@/db/migrations';
import { runMigrations } from '@/db/migrations/runner';
import { createRepositories } from '@/db/repositories';
import { seedDatabase } from '@/db/seed/seed';
import { openNodeDriver } from '@/db/testing/nodeDriver';
import { createQueryClient, RepositoriesTestProvider } from '@/hooks/data';
import { ThemeProvider } from '@/theme';

jest.mock('expo-router', () => ({ router: {}, useNavigation: () => ({}) }));
const M = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

it('filters by search and returns the picked exercises', async () => {
  const onAdd = jest.fn();
  const db = await openDatabase(openNodeDriver());
  await runMigrations(db, migrations);
  await seedDatabase(db);
  await render(
    <SafeAreaProvider initialMetrics={M}>
      <ThemeProvider>
        <RepositoriesTestProvider
          repos={createRepositories(db)}
          client={createQueryClient({ forTests: true })}
        >
          <ExercisePickerSheet visible onClose={() => {}} onAdd={onAdd} />
        </RepositoriesTestProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
  await fireEvent.changeText(screen.getByTestId('picker-search'), 'crunch');
  expect(
    screen
      .queryAllByTestId(/^exercise-/)
      .map((n) => n.props.testID)
      .sort(),
  ).toEqual(['exercise-bicycle_crunch', 'exercise-crunch', 'exercise-reverse_crunch']);
  await fireEvent.press(screen.getByTestId('exercise-crunch'));
  await fireEvent.press(screen.getByTestId('picker-add'));
  expect(onAdd).toHaveBeenCalledWith(['seed-ex-crunch']);
});
