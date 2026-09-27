import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Pressable, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useUiStore, type ToastItem } from '@/store/uiStore';
import { makeStyles, useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

const ICON: Record<ToastItem['type'], IconName> = {
  success: 'status-done',
  error: 'error',
  info: 'info',
};

function ToastView({ item }: { item: ToastItem }) {
  const t = useTheme();
  const styles = useStyles();
  const reduced = useReducedMotion();
  const dismiss = useUiStore((s) => s.dismissToast);
  const { t: tr } = useTranslation();
  const color = { success: t.colors.primaryInk, error: t.colors.danger, info: t.colors.info }[
    item.type
  ];

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(item.message);
    const timer = setTimeout(() => dismiss(item.id), item.duration);
    return () => clearTimeout(timer);
  }, [item, dismiss]);

  return (
    <Animated.View
      {...(reduced ? {} : { entering: FadeInUp.duration(200), exiting: FadeOutUp.duration(150) })}
    >
      <Pressable
        accessibilityRole="alert"
        accessibilityHint={tr('tapToDismiss')}
        onPress={() => dismiss(item.id)}
        style={[styles.toast, { borderColor: color }]}
      >
        <Icon name={ICON[item.type]} size={20} color={color} />
        <Text style={styles.message}>{item.message}</Text>
        {item.action ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={item.action.label}
            hitSlop={8}
            onPress={() => {
              item.action?.onPress();
              dismiss(item.id);
            }}
          >
            <Text variant="bodyStrong" style={{ color }}>
              {item.action.label}
            </Text>
          </Pressable>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

/** Mounted once in the root layout. Shows queued toasts from `useUiStore`. */
export function ToastHost() {
  const toasts = useUiStore((s) => s.toasts);
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  if (toasts.length === 0) return null;
  return (
    <View style={[styles.host, { top: insets.top + 8, pointerEvents: 'box-none' }]}>
      {toasts.map((item) => (
        <ToastView key={item.id} item={item} />
      ))}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  host: { position: 'absolute', left: t.spacing.lg, right: t.spacing.lg, gap: t.spacing.sm },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    padding: t.spacing.lg,
    borderRadius: t.radius.lg,
    borderWidth: 1,
    backgroundColor: t.colors.surfaceRaised,
    // overlay is already translucent (rgba), so use it as-is.
    boxShadow: `0 4px 12px ${t.colors.overlay}`,
  },
  message: { flex: 1 },
}));
