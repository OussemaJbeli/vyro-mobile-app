import { useLocalSearchParams } from 'expo-router';

import { CompletionSummary } from '@/components/execution/CompletionSummary';

/** Workout complete: summary, planned vs actual, effort, notes (step 18). */
export default function CompleteExecutionScreen() {
  const { executionId } = useLocalSearchParams<{ executionId: string }>();
  return <CompletionSummary executionId={executionId} />;
}
