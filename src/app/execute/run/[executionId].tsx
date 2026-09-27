import { useLocalSearchParams } from 'expo-router';

import { RunningExecution } from '@/components/execution/RunningExecution';

/** Treadmill interval execution (step 19). */
export default function RunExecutionScreen() {
  const { executionId } = useLocalSearchParams<{ executionId: string }>();
  return <RunningExecution executionId={executionId} />;
}
