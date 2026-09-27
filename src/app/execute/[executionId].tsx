import { useLocalSearchParams } from 'expo-router';

import { StrengthExecution } from '@/components/execution/StrengthExecution';

/** Gym & home/abs execution (step 18). */
export default function GymExecutionScreen() {
  const { executionId } = useLocalSearchParams<{ executionId: string }>();
  return <StrengthExecution executionId={executionId} />;
}
