import { ActivityIndicator, View } from 'react-native';

import { Text } from '@/components/ui';
import { makeStyles, useTheme } from '@/theme';

/** Spinner + label while a PIN is being hashed (saved or checked). */
export function PinBusy({ label }: { label: string }) {
  const theme = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.row} accessibilityLiveRegion="polite" testID="pin-busy">
      <ActivityIndicator color={theme.colors.primary} />
      <Text tone="muted">{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: t.spacing.sm },
}));
