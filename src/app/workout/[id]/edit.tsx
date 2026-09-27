import { useLocalSearchParams } from 'expo-router';

import { ScreenContainer, Skeleton } from '@/components/ui';
import { WorkoutBuilder } from '@/components/workout/WorkoutBuilder';
import { useTemplate } from '@/hooks/data';

export default function EditWorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const template = useTemplate(id);
  if (!template.data) {
    return (
      <ScreenContainer edges={['top', 'bottom']}>
        <Skeleton preset="card" />
      </ScreenContainer>
    );
  }
  return <WorkoutBuilder template={template.data} />;
}
