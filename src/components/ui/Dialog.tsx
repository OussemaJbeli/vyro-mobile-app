import { Modal, View } from 'react-native';

import { makeStyles } from '@/theme';

import { Button } from './Button';
import { Text } from './Text';

export type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Red confirm button for irreversible actions (delete, replace data). */
  destructive?: boolean;
  loading?: boolean;
  testID?: string;
};

/** Centered confirmation (FS §60 "This will add/replace local data. [Cancel] [Continue]"). */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  destructive = false,
  loading = false,
  testID,
}: ConfirmDialogProps) {
  const styles = useStyles();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View
          accessibilityViewIsModal
          accessibilityRole="alert"
          style={styles.card}
          {...(testID ? { testID } : {})}
        >
          <Text variant="heading" accessibilityRole="header">
            {title}
          </Text>
          {message ? <Text tone="muted">{message}</Text> : null}
          <View style={styles.actions}>
            <Button label={cancelLabel} variant="ghost" onPress={onCancel} disabled={loading} />
            <Button
              label={confirmLabel}
              variant={destructive ? 'danger' : 'primary'}
              onPress={onConfirm}
              loading={loading}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((t) => ({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: t.spacing.xxl,
    backgroundColor: t.colors.overlay,
  },
  card: {
    gap: t.spacing.md,
    padding: t.spacing.xxl,
    borderRadius: t.radius.xl,
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: t.spacing.sm,
    marginTop: t.spacing.sm,
  },
}));
