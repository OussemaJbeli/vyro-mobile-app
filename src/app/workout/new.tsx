import { Redirect, useLocalSearchParams } from 'expo-router';

import { WorkoutBuilder } from '@/components/workout/WorkoutBuilder';
import { routes } from '@/constants/routes';
import { TEMPLATE_TYPES } from '@/types/enums';

/** New workout: /workout/new?type=gym|home|abs|recovery|other (running → step 15 builder). */
export default function NewWorkoutScreen() {
  const { type } = useLocalSearchParams<{ type?: string }>();
  if (type === 'running') return <Redirect href={routes.runningNew} />;
  const initial = (TEMPLATE_TYPES as readonly string[]).includes(type ?? '')
    ? (type as 'gym')
    : 'gym';
  return <WorkoutBuilder initialType={initial} />;
}
