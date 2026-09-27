import { type BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useKeyboardVisible } from '@/hooks/useKeyboardVisible';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useStartStore, type StartFabState } from '@/store/startStore';
import { makeStyles, useTheme } from '@/theme';
import { withAlpha } from '@/theme/color';
import { haptics } from '@/utils/haptics';

import { GlassFill } from './GlassFill';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

const TABS = {
  home: 'home',
  train: 'train',
  progress: 'progress',
  plan: 'plan',
} as const satisfies Record<string, IconName>;

const FAB_ICON: Record<StartFabState, IconName> = {
  start: 'play',
  continue: 'play',
  done: 'check',
  rest: 'rest',
};

const FAB_SIZE = 64;
const BAR_HEIGHT = 64;

function StartFab({ onPress, focused }: { onPress: () => void; focused: boolean }) {
  const t = useTheme();
  const styles = useStyles();
  const reduced = useReducedMotion();
  const fab = useStartStore((s) => s.fab);
  const label = useStartStore((s) => s.label);
  const pulse = useSharedValue(0);
  const { t: tr } = useTranslation('nav');

  // Subtle breathing ring only while a workout can be continued (step 28 motion rules).
  useEffect(() => {
    pulse.set(
      fab === 'continue' && !reduced ? withRepeat(withTiming(1, { duration: 1200 }), -1, true) : 0,
    );
  }, [fab, reduced, pulse]);
  const ring = useAnimatedStyle(() => ({
    opacity: 0.5 - pulse.get() * 0.4,
    transform: [{ scale: 1 + pulse.get() * 0.18 }],
  }));

  return (
    <View style={styles.fabSlot}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label ?? tr(`fab.${fab}`)}
        accessibilityState={{ selected: focused }}
        onPress={() => {
          haptics.impact();
          onPress();
        }}
        style={({ pressed }) => [styles.fabHit, pressed && styles.pressed]}
        testID="tab-start"
      >
        {fab === 'continue' ? <Animated.View style={[styles.fabRing, ring]} /> : null}
        <View style={[styles.fab, fab === 'done' && styles.fabDone]}>
          <GlassFill radius={FAB_SIZE / 2} />
          <Icon name={FAB_ICON[fab]} size={30} color={t.colors.onPrimary} />
        </View>
      </Pressable>
    </View>
  );
}

/** Home · Train · [▶ START] · Progress · Plan (UI §1, template bottom bar). */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const t = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardVisible();
  const { t: tr } = useTranslation('nav');
  if (keyboard) return null;

  const go = (name: string, key: string, focused: boolean) => {
    const event = navigation.emit({ type: 'tabPress', target: key, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) {
      haptics.tap();
      navigation.navigate(name);
    }
  };

  return (
    <View
      accessibilityRole="tablist"
      style={[styles.bar, { paddingBottom: insets.bottom, height: BAR_HEIGHT + insets.bottom }]}
    >
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        if (route.name === 'start') {
          return (
            <StartFab
              key={route.key}
              focused={focused}
              onPress={() => go(route.name, route.key, focused)}
            />
          );
        }
        const name = route.name as keyof typeof TABS;
        const icon = TABS[name];
        if (!icon) return null;
        const label = tr(name);
        const color = focused ? t.colors.primaryInk : t.colors.textMuted;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: focused }}
            onPress={() => go(route.name, route.key, focused)}
            style={styles.tab}
            testID={`tab-${route.name}`}
          >
            {focused ? <View style={styles.activePill} /> : null}
            <Icon name={icon} size={24} color={color} />
            <Text variant="caption" style={[styles.tabLabel, { color }]} numberOfLines={1}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  // Modern bar: rounded top corners, hairline rim, soft lift shadow (template).
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: t.colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: t.colors.border,
    borderTopColor: t.colors.borderAccent,
    boxShadow: `0 -8px 24px ${withAlpha(t.colors.bg, 0.6)}`,
  },
  activePill: {
    position: 'absolute',
    top: 8,
    width: 52,
    height: 30,
    borderRadius: 15,
    backgroundColor: t.colors.primarySoft,
  },
  tab: {
    flex: 1,
    height: BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabLabel: { fontSize: 11, lineHeight: 14 },
  fabSlot: { flex: 1, alignItems: 'center', height: BAR_HEIGHT, justifyContent: 'flex-end' },
  // No visible label under the FAB (as in the template); the state is in its a11y label.
  fabHit: {
    position: 'absolute',
    top: -26,
    width: FAB_SIZE + 12,
    height: FAB_SIZE + 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.primary,
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: t.colors.bg,
    boxShadow: `0 0 16px ${withAlpha(t.colors.primary, t.scheme === 'dark' ? 0.6 : 0.25)}`,
  },
  fabDone: { backgroundColor: withAlpha(t.colors.primary, 0.55) },
  fabRing: {
    position: 'absolute',
    width: FAB_SIZE + 8,
    height: FAB_SIZE + 8,
    borderRadius: (FAB_SIZE + 8) / 2,
    borderWidth: 2,
    borderColor: t.colors.primary,
  },
  pressed: { transform: [{ scale: 0.95 }] },
}));
