import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { makeStyles, useTheme } from '@/theme';
import { haptics } from '@/utils/haptics';

import { Text } from './Text';
import { clampValue, roundTo, decimalsOf } from './numberStep';

export type RulerPickerProps = {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  /** Label every N ticks. */
  majorEvery?: number;
  /** Big readout above the ruler, for example "180 cm" or "5′11″". */
  format: (value: number) => string;
  label: string;
  testID?: string;
};

const TICK = 12;

/**
 * Horizontal ruler (onboarding height/weight, step 11). Virtualized, snaps to each tick,
 * and exposes increment/decrement actions so screen-reader users can adjust it.
 */
export function RulerPicker({
  value,
  onChange,
  min,
  max,
  step,
  majorEvery = 10,
  format,
  label,
  testID,
}: RulerPickerProps) {
  const t = useTheme();
  const styles = useStyles();
  const decimals = decimalsOf(step);
  const count = Math.round((max - min) / step) + 1;
  const ticks = useMemo(() => Array.from({ length: count }, (_, i) => i), [count]);
  const [width, setWidth] = useState(0);
  const [initialIndex] = useState(() =>
    Math.max(0, Math.min(count - 1, Math.round((value - min) / step))),
  );
  const lastIndex = useRef(initialIndex);
  const listRef = useRef<FlatList<number>>(null);

  const valueAt = useCallback(
    (index: number) => clampValue(roundTo(min + index * step, decimals), { min, max, step }),
    [min, max, step, decimals],
  );

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.max(
      0,
      Math.min(count - 1, Math.round(e.nativeEvent.contentOffset.x / TICK)),
    );
    if (index !== lastIndex.current) {
      lastIndex.current = index;
      haptics.tap();
      onChange(valueAt(index));
    }
  };

  const adjust = (dir: 1 | -1) => {
    const index = Math.max(0, Math.min(count - 1, lastIndex.current + dir));
    lastIndex.current = index;
    onChange(valueAt(index));
    listRef.current?.scrollToOffset({ offset: index * TICK, animated: true });
  };

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  // contentOffset is ignored on web; scroll to the start position once the ruler has a width.
  useEffect(() => {
    if (width <= 0) return;
    const id = setTimeout(() => {
      listRef.current?.scrollToOffset({ offset: initialIndex * TICK, animated: false });
    }, 0);
    return () => clearTimeout(id);
  }, [width, initialIndex]);
  const side = Math.max(0, width / 2 - TICK / 2);

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: format(value) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => adjust(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
      style={styles.wrap}
      {...(testID ? { testID } : {})}
    >
      <Text variant="metric" align="center" style={styles.readout}>
        {format(value)}
      </Text>
      <View style={styles.rulerBox} onLayout={onLayout}>
        {width > 0 ? (
          <FlatList
            ref={listRef}
            horizontal
            data={ticks}
            keyExtractor={(i) => String(i)}
            showsHorizontalScrollIndicator={false}
            snapToInterval={TICK}
            decelerationRate="fast"
            // Start centred on the value: with the side padding, offset x = index × TICK.
            contentOffset={{ x: initialIndex * TICK, y: 0 }}
            getItemLayout={(_, index) => ({ length: TICK, offset: side + TICK * index, index })}
            contentContainerStyle={{ paddingHorizontal: side }}
            onScroll={onScroll}
            scrollEventThrottle={16}
            initialNumToRender={Math.ceil(width / TICK) + 10}
            windowSize={5}
            renderItem={({ item }) => {
              const major = item % majorEvery === 0;
              return (
                <View style={styles.tickCell}>
                  <View
                    style={[
                      styles.tick,
                      major ? styles.tickMajor : null,
                      { backgroundColor: major ? t.colors.text : t.colors.textMuted },
                    ]}
                  />
                  {major ? (
                    <Text variant="caption" tone="muted" style={styles.tickLabel}>
                      {String(roundTo(min + item * step, decimals))}
                    </Text>
                  ) : null}
                </View>
              );
            }}
          />
        ) : null}
        <View style={[styles.indicator, { left: width / 2 - 1.5, pointerEvents: 'none' }]} />
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  wrap: { gap: t.spacing.lg },
  readout: { fontVariant: ['tabular-nums'] },
  rulerBox: { height: 72, justifyContent: 'center' },
  tickCell: {
    width: TICK,
    alignItems: 'center',
    height: 72,
    justifyContent: 'flex-start',
    overflow: 'visible',
  },
  tick: { width: 2, height: 18, borderRadius: 1, opacity: 0.6 },
  tickMajor: { height: 32, opacity: 1 },
  // Wider than its 12 dp cell and centred on the tick, so numbers are never clipped.
  tickLabel: { position: 'absolute', top: 38, left: TICK / 2 - 24, width: 48, textAlign: 'center' },
  indicator: {
    position: 'absolute',
    top: 0,
    width: 3,
    height: 40,
    borderRadius: 2,
    backgroundColor: t.colors.primary,
  },
}));
