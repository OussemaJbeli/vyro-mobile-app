import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useTheme } from '@/theme';

import { VyroLogo } from './VyroLogo';
import { VyroMark } from './VyroMark';

// Plays once per app process: cold start only, never when navigating back (step 11).
let played = false;

/**
 * Brand intro over the first screen: the V scales in with its glow, the lockup fades in,
 * then the overlay fades out. ≤ 1.2 s total. Under Reduce Motion it is skipped entirely,
 * because the native splash already showed the mark.
 */
export function AnimatedSplash() {
  const t = useTheme();
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(!played);
  const mark = useSharedValue(0);
  const lockup = useSharedValue(0);
  const overlay = useSharedValue(1);

  useEffect(() => {
    if (!visible) return;
    played = true;
    if (reduced) return;
    const ease = Easing.bezier(0.2, 0, 0, 1);
    mark.set(withTiming(1, { duration: 380, easing: ease }));
    lockup.set(withDelay(300, withTiming(1, { duration: 320, easing: ease })));
    overlay.set(
      withDelay(
        850,
        withTiming(0, { duration: 300 }, (done) => {
          if (done) runOnJS(setVisible)(false);
        }),
      ),
    );
  }, [visible, reduced, mark, lockup, overlay]);

  const markStyle = useAnimatedStyle(() => ({
    opacity: 1 - lockup.get(),
    transform: [{ scale: 0.82 + mark.get() * 0.18 }],
  }));
  const lockupStyle = useAnimatedStyle(() => ({
    opacity: lockup.get(),
    transform: [{ translateY: (1 - lockup.get()) * 12 }],
  }));
  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlay.get() }));

  // Reduce Motion: skip the intro entirely (derived here, no state change needed).
  if (!visible || reduced) return null;
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        StyleSheet.absoluteFill,
        styles.center,
        { backgroundColor: t.colors.bg, pointerEvents: 'none' },
        overlayStyle,
      ]}
    >
      <View style={styles.center}>
        <Animated.View style={[styles.layer, markStyle]}>
          <VyroMark size={150} color={t.colors.primary} glow />
        </Animated.View>
        <Animated.View style={[styles.layer, lockupStyle]}>
          <VyroLogo width={250} color={t.colors.primary} />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  layer: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
});
