import { useLocalSearchParams } from 'expo-router';

import { CoachScreen } from '@/components/ai/CoachScreen';

/** AI Coach (step 32): optional `method`, `templateId`, `exerciseId`, `reportId`. */
export default function CoachRoute() {
  const params = useLocalSearchParams<{
    method?: string;
    templateId?: string;
    exerciseId?: string;
    reportId?: string;
  }>();
  return <CoachScreen params={params} />;
}
