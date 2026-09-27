import { act, renderHook, waitFor } from '@testing-library/react-native';
import { type ReactNode } from 'react';

import { openDatabase, type Database } from '@/db/client';
import { migrations } from '@/db/migrations';
import { runMigrations } from '@/db/migrations/runner';
import { createRepositories, type Repositories } from '@/db/repositories';
import { openNodeDriver } from '@/db/testing/nodeDriver';
import { useUiStore } from '@/store/uiStore';

import {
  createQueryClient,
  invalidates,
  RepositoriesTestProvider,
  useLatestWeights,
  useRepoMutation,
} from '../data';

let db: Database;
let repos: Repositories;

beforeEach(async () => {
  db = await openDatabase(openNodeDriver());
  await runMigrations(db, migrations);
  repos = createRepositories(db);
  useUiStore.setState({ toasts: [] });
});
afterEach(() => db.driver.close());

const wrapper = ({ children }: { children: ReactNode }) => (
  <RepositoriesTestProvider repos={repos} client={createQueryClient({ forTests: true })}>
    {children}
  </RepositoriesTestProvider>
);

function useWeightsWithMutation() {
  const latest = useLatestWeights(1);
  const add = useRepoMutation(
    (r, valueKg: number) =>
      r.weights.create({
        valueKg,
        unitEntered: 'kg',
        recordedAt: new Date().toISOString(),
        notes: null,
      }),
    { invalidate: invalidates.weights },
  );
  return { latest, add };
}

describe('data hooks', () => {
  it('goes loading → data, then refetches after a mutation invalidates it', async () => {
    const { result } = await renderHook(() => useWeightsWithMutation(), { wrapper });
    expect(result.current.latest.isLoading).toBe(true);
    await waitFor(() => expect(result.current.latest.data).toEqual([]));

    await act(async () => {
      await result.current.add.mutateAsync(74.6);
    });
    await waitFor(() => expect(result.current.latest.data?.[0]?.valueKg).toBe(74.6));
  });

  it('shows a human error toast when a mutation fails', async () => {
    const { result } = await renderHook(() => useWeightsWithMutation(), { wrapper });
    await act(async () => {
      await result.current.add.mutateAsync(-1).catch(() => {});
    });
    const [t] = useUiStore.getState().toasts;
    expect(t).toMatchObject({ type: 'error' });
    expect(t?.message).not.toMatch(/SQL|zod|valueKg/i);
  });
});
