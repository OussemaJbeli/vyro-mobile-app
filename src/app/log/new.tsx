import { useLocalSearchParams } from 'expo-router';

import { RetroLogForm } from '@/components/log/RetroLogForm';

/** Log a past workout or run (step 21). */
export default function LogNewScreen() {
  const params = useLocalSearchParams<{ sessionId?: string; templateId?: string; type?: string }>();
  return <RetroLogForm {...params} />;
}
