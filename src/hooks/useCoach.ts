import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useAI } from './useAI';

/** Coach data (reports, chat threads) from the local AI tables. Never calls a provider. */
export function useCoachData(threadId: string | null) {
  const ai = useAI();
  const client = useQueryClient();
  const reports = useQuery({ queryKey: ['ai', 'reports'], queryFn: () => ai.recentReports(10) });
  const threads = useQuery({ queryKey: ['ai', 'threads'], queryFn: () => ai.threads() });
  const messages = useQuery({
    queryKey: ['ai', 'messages', threadId ?? ''],
    queryFn: () => ai.threadMessages(threadId!),
    enabled: !!threadId,
  });
  return {
    reports,
    threads,
    messages,
    refresh: () => client.invalidateQueries({ queryKey: ['ai'] }),
  };
}

/** Latest weekly insight for Home (local read; generation is always a tap). */
export function useLatestWeekInsight() {
  const ai = useAI();
  return useQuery({
    queryKey: ['ai', 'latest', 'summarizeWeek'],
    queryFn: async () => {
      const stored = await ai.latestInsight('summarizeWeek');
      return stored ? ai.report(stored.id) : null;
    },
  });
}
