import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { useTheme } from '@/theme';

export type SparkPoint = { t: number; value: number; smooth?: number };

/**
 * Raw readings as dots + the smoothed trend as a line (step 22). A simple SVG chart;
 * step 24 swaps in the chart library (AD-16).
 */
export function Sparkline({
  points,
  height = 120,
  accessibilityLabel,
}: {
  points: readonly SparkPoint[];
  height?: number;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const pad = 6;
  const values = points.flatMap((p) => (p.smooth !== undefined ? [p.value, p.smooth] : [p.value]));
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const t0 = points[0]?.t ?? 0;
  const t1 = points.at(-1)?.t ?? 1;
  const x = (t: number) =>
    pad + (t1 === t0 ? (width - 2 * pad) / 2 : ((t - t0) / (t1 - t0)) * (width - 2 * pad));
  const y = (v: number) =>
    pad + (hi === lo ? (height - 2 * pad) / 2 : (1 - (v - lo) / (hi - lo)) * (height - 2 * pad));
  const line = points
    .filter((p) => p.smooth !== undefined)
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.t).toFixed(1)},${y(p.smooth!).toFixed(1)}`)
    .join(' ');
  return (
    <View
      style={{ height }}
      onLayout={onLayout}
      accessible
      accessibilityRole="image"
      {...(accessibilityLabel ? { accessibilityLabel } : {})}
    >
      {width > 0 && points.length > 0 ? (
        <Svg width={width} height={height}>
          {points.map((p) => (
            <Circle key={p.t} cx={x(p.t)} cy={y(p.value)} r={2.5} fill={theme.colors.textMuted} />
          ))}
          {line ? (
            <Path d={line} stroke={theme.colors.primary} strokeWidth={2.5} fill="none" />
          ) : null}
        </Svg>
      ) : null}
    </View>
  );
}
