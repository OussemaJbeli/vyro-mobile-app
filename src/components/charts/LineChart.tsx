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
}: {
  values: readonly (number | null)[];
  labels?: readonly string[];
  height?: number;
  summary: string;
  min?: number;
  max?: number;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const pad = 8;
  const nums = values.filter((v): v is number => v !== null);
  const lo = min ?? Math.min(...nums);
  const hi = max ?? Math.max(...nums);
  const x = (i: number) =>
    pad + (values.length <= 1 ? 0 : (i / (values.length - 1)) * (width - 2 * pad));
  const y = (v: number) =>
    pad + (hi === lo ? (height - 2 * pad) / 2 : (1 - (v - lo) / (hi - lo)) * (height - 2 * pad));
  let d = '';
  let pen = false;
  values.forEach((v, i) => {
    if (v === null) {
      pen = false;
      return;
    }
    d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
    pen = true;
  });
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
            <Path d={d} stroke={theme.colors.primary} strokeWidth={2.5} fill="none" />
            {values.map((v, i) =>
              v === null ? null : (
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
