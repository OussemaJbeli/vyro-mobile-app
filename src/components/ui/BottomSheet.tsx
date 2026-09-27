import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReducedMotion } from '@/hooks/useReducedMotion';
import { makeStyles, useTheme } from '@/theme';

import { Text } from './Text';

export type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  testID?: string;
};

const OFFSCREEN = 800;
const DISMISS_DISTANCE = 120;

/**
 * Modal sheet built on RN Modal + Reanimated + Gesture Handler (Expo Go compatible).
 * Close by tapping the backdrop, dragging down, or the Android back button.
 */
export function BottomSheet({ visible, onClose, title, children, testID }: BottomSheetProps) {
  const t = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { t: tr } = useTranslation();
  const reduced = useReducedMotion();
  const y = useSharedValue(OFFSCREEN);
  // Keep the Modal mounted during the closing animation. Opening is derived during render
  // (allowed by React); closing is unmounted from the animation's completion callback.
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    if (visible) {
      y.set(withTiming(0, { duration: reduced ? 0 : t.motion.base }));
    } else {
      y.set(
        withTiming(OFFSCREEN, { duration: reduced ? 0 : t.motion.fast }, (finished) => {
          if (finished) runOnJS(setMounted)(false);
        }),
      );
    }
  }, [visible, reduced, y, t.motion.base, t.motion.fast]);

  const pan = Gesture.Pan()
    .onChange((e) => {
      y.set(Math.max(0, y.get() + e.changeY));
    })
    .onEnd((e) => {
      if (y.get() > DISMISS_DISTANCE || e.velocityY > 800) runOnJS(onClose)();
      else y.set(withTiming(0, { duration: 150 }));
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.root}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr('close')}
          style={styles.backdrop}
          onPress={onClose}
        />
        <Animated.View
          accessibilityViewIsModal
          style={[styles.sheet, { paddingBottom: insets.bottom + t.spacing.lg }, sheetStyle]}
          {...(testID ? { testID } : {})}
        >
          <GestureDetector gesture={pan}>
            <View style={styles.handleArea}>
              <View style={styles.handle} />
              {title ? (
                <Text variant="heading" accessibilityRole="header">
                  {title}
                </Text>
              ) : null}
            </View>
          </GestureDetector>
          {children}
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const useStyles = makeStyles((t) => ({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleFill, backgroundColor: t.colors.overlay },
  sheet: {
    backgroundColor: t.colors.surface,
    borderTopLeftRadius: t.radius.xl + 4,
    borderTopRightRadius: t.radius.xl + 4,
    borderWidth: 1,
    borderColor: t.colors.border,
    paddingHorizontal: t.spacing.xl,
    maxHeight: '90%',
  },
  handleArea: { paddingTop: t.spacing.sm, paddingBottom: t.spacing.md, gap: t.spacing.md },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: t.colors.border,
  },
}));

const StyleFill = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;
