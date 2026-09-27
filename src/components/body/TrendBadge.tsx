import { Text } from '@/components/ui';

/**
 * ↓/↑ + text, never colour alone. "Down" is not judged: neutral tone unless the change
 * matches the goal direction (step 12 weight goal).
 */
export function TrendBadge({
  change,
  text,
  goalDirection = 0,
  testID,
}: {
  change: number;
  text: string;
  /** −1 = goal is to go down, 1 = up, 0 = no goal. */
  goalDirection?: -1 | 0 | 1;
  testID?: string;
}) {
  const matches = goalDirection !== 0 && Math.sign(change) === goalDirection;
  return (
    <Text variant="bodyStrong" tone={matches ? 'primary' : 'muted'} {...(testID ? { testID } : {})}>
      {text}
    </Text>
  );
}

export const arrowFor = (change: number) => (change < 0 ? '↓' : change > 0 ? '↑' : '→');
