import { useLocalSearchParams } from 'expo-router';

import { HistoryDetail } from '@/components/progress/HistoryDetail';

export default function HistoryDetailRoute() {
  const { executionId } = useLocalSearchParams<{ executionId: string }>();
  return <HistoryDetail executionId={executionId} />;
}
