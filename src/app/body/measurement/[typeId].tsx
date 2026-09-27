import { useLocalSearchParams } from 'expo-router';

import { MeasurementDetail } from '@/components/body/MeasurementDetail';

export default function MeasurementTypeRoute() {
  const { typeId } = useLocalSearchParams<{ typeId: string }>();
  return <MeasurementDetail typeId={typeId} />;
}
