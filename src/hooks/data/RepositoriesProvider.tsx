import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, useContext, useState, type ReactNode } from 'react';

import { createRepositories, type Repositories } from '@/db/repositories';

import { useDatabase } from '../database';

const RepositoriesContext = createContext<Repositories | null>(null);

/**
 * Local-first query client: data comes from SQLite, so there is no network state,
 * no background refetching and no retries. Freshness is driven by explicit invalidation.
 */
/** `forTests`: no garbage-collection timers, so Jest can exit as soon as tests finish. */
export function createQueryClient({ forTests = false }: { forTests?: boolean } = {}) {
  return new QueryClient({
    defaultOptions: {
      queries: {
        networkMode: 'always',
        staleTime: Infinity,
        gcTime: forTests ? Infinity : 5 * 60_000,
        retry: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
      mutations: { networkMode: 'always', retry: false, ...(forTests ? { gcTime: Infinity } : {}) },
    },
  });
}

/** Mounted inside DatabaseGate, so the database is guaranteed ready. */
export function RepositoriesProvider({ children }: { children: ReactNode }) {
  const db = useDatabase();
  const [repos] = useState(() => createRepositories(db));
  const [client] = useState(createQueryClient);
  return (
    <RepositoriesContext.Provider value={repos}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </RepositoriesContext.Provider>
  );
}

/** Test/dev helper: provide explicit repositories and query client. */
export function RepositoriesTestProvider({
  repos,
  client,
  children,
}: {
  repos: Repositories;
  client: QueryClient;
  children: ReactNode;
}) {
  return (
    <RepositoriesContext.Provider value={repos}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </RepositoriesContext.Provider>
  );
}

export function useRepositories(): Repositories {
  const repos = useContext(RepositoriesContext);
  if (!repos) throw new Error('useRepositories must be used inside <RepositoriesProvider>');
  return repos;
}
