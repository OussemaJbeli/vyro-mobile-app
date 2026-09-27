import { useLocalSearchParams } from 'expo-router';

import { RunningBuilder } from '@/components/running/RunningBuilder';
import { ScreenContainer, Skeleton } from '@/components/ui';
import { useTemplate } from '@/hooks/data';

export default function EditRunningScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const template = useTemplate(id);
  if (!template.data) {
    return (
      <ScreenContainer edges={['top', 'bottom']}>
        <Skeleton preset="card" />
      </ScreenContainer>
    );
  }
  return <RunningBuilder template={template.data} />;
}
