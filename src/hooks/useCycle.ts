import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { readCyclePlan, readCycleState, restartCycle, saveCyclePlan } from '@/db/cycle';
import { type CyclePlan } from '@/domain/scheduling/cycle';
import { today } from '@/utils/dates';

import { useDatabase } from './database';

/** The VYRO day groups (names, run + gym per day, order) and where the cycle stands. */
export function useCyclePlan() {
  const db = useDatabase();
  return useQuery({
    queryKey: ['cycle', 'plan'],
    queryFn: async () => ({ plan: await readCyclePlan(db), state: await readCycleState(db) }),
  });
}

/** Saves the day groups and redraws the plan ahead. */
export function useSaveCyclePlan() {
  const db = useDatabase();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (plan: CyclePlan) => saveCyclePlan(db, plan, today()),
    onSuccess: () =>
      Promise.all(
        [['cycle'], ['sessions'], ['home'], ['analytics'], ['streak']].map((queryKey) =>
          client.invalidateQueries({ queryKey }),
        ),
      ),
  });
}

/** Restarts the cycle with Day 1 today. */
export function useRestartCycle() {
  const db = useDatabase();
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => restartCycle(db, today()),
    onSuccess: () =>
      Promise.all(
        [['cycle'], ['sessions'], ['home']].map((queryKey) =>
          client.invalidateQueries({ queryKey }),
        ),
      ),
  });
}
