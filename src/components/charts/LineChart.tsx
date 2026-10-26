import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { Text } from '@/components/ui';
import { useTheme } from '@/theme';

/** Line series with gaps for nulls (AD-16 in-house chart). `summary` is read by screen readers. */
export function LineChart({
  values,
  labels,
  height = 120,
  summary,
  min,
  max,
  dashedFrom,
  target,
}: {
  values: readonly (number | null)[];
  labels?: readonly string[];
  height?: number;
  summary: string;
  min?: number;
  max?: number;
  /** Points from this index on are a projection: drawn dashed, without dots. */
  dashedFrom?: number;
  /** A goal value drawn as a faint dashed horizontal line. */
  target?: number | null;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const pad = 8;
  const nums = values.filter((v): v is number => v !== null);
  const withTarget = target !== undefined && target !== null ? [...nums, target] : nums;
  const lo = min ?? Math.min(...withTarget);
  const hi = max ?? Math.max(...withTarget);
  const x = (i: number) =>
    pad + (values.length <= 1 ? 0 : (i / (values.length - 1)) * (width - 2 * pad));
  const y = (v: number) =>
    pad + (hi === lo ? (height - 2 * pad) / 2 : (1 - (v - lo) / (hi - lo)) * (height - 2 * pad));
  // Solid path for real points, dashed path for the projection (they share the join point).
  const path = (from: number, to: number) => {
    let d = '';
    let pen = false;
    for (let i = from; i <= to; i++) {
      const v = values[i];
      if (v === null || v === undefined) {
        pen = false;
        continue;
      }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
      pen = true;
    }
    return d;
  };
  const split = dashedFrom ?? values.length;
  const d = path(0, Math.min(split, values.length - 1));
  const dashed =
    dashedFrom !== undefined ? path(Math.max(0, dashedFrom - 1), values.length - 1) : '';
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={summary}>
      <View
        style={{ height }}
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      >
        {width > 0 && nums.length ? (
          <Svg width={width} height={height}>
            <Line
              x1={pad}
              x2={width - pad}
              y1={height - pad}
              y2={height - pad}
              stroke={theme.colors.border}
              strokeWidth={1}
            />
            {target !== undefined && target !== null ? (
              <Line
                x1={pad}
                x2={width - pad}
                y1={y(target)}
                y2={y(target)}
                stroke={theme.colors.textMuted}
                strokeWidth={1}
                strokeDasharray="4 4"
              />
            ) : null}
            <Path d={d} stroke={theme.colors.primary} strokeWidth={2.5} fill="none" />
            {dashed ? (
              <Path
                d={dashed}
                stroke={theme.colors.primary}
                strokeOpacity={0.7}
                strokeWidth={2.5}
                strokeDasharray="6 5"
                fill="none"
              />
            ) : null}
            {values.map((v, i) =>
              v === null || (dashedFrom !== undefined && i >= dashedFrom) ? null : (
                <Circle key={i} cx={x(i)} cy={y(v)} r={2.5} fill={theme.colors.primary} />
              ),
            )}
          </Svg>
        ) : null}
      </View>
      {labels ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text variant="caption" tone="muted">
            {labels[0]}
          </Text>
          <Text variant="caption" tone="muted">
            {labels.at(-1)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
