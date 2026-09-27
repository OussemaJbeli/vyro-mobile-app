import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useRepositories } from '@/hooks/data';
import { usePlannerStore } from '@/store/plannerStore';
import { today } from '@/utils/dates';

/**
 * When the app comes back on a new day (or midnight passes while open): extend the materialized schedule, refresh
 * date-based screens and move the planner to today (step 16).
 */
export function DayRollover() {
  const repos = useRepositories();
  const client = useQueryClient();
  const lastDay = useRef(today());

  useEffect(() => {
    const check = () => {
      const now = today();
      if (now === lastDay.current) return;
      const previous = lastDay.current;
      lastDay.current = now;
      repos.schedule
        .materialize(now)
        .catch(() => {})
        .finally(() => {
          client.invalidateQueries().catch(() => {});
          if (usePlannerStore.getState().selectedDate === previous)
            usePlannerStore.getState().select(now);
        });
    };
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    // Also at midnight while the app stays open (step 21).
    let timer: ReturnType<typeof setTimeout>;
    const scheduleMidnight = () => {
      const next = new Date();
      next.setHours(24, 0, 5, 0);
      timer = setTimeout(() => {
        check();
        scheduleMidnight();
      }, next.getTime() - Date.now());
    };
    scheduleMidnight();
    return () => {
      sub.remove();
      clearTimeout(timer);
    };
  }, [repos, client]);

  return null;
}
