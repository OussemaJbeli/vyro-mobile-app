import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import { useTheme } from '@/theme';

/**
 * Template weight chart: horizontal grid with Y labels, accent line with dots, gradient
 * area under it, date labels below (AD-16 in-house chart; `summary` for screen readers).
 */
export function AreaChart({
  values,
  labels,
  height = 170,
  summary,
  ticks = 4,
}: {
  values: readonly number[];
  labels: readonly string[];
  height?: number;
  summary: string;
  ticks?: number;
}) {
  const t = useTheme();
  const [width, setWidth] = useState(0);
  const left = 26;
  const bottom = 20;
  const top = 8;
  const lo0 = Math.min(...values);
  const hi0 = Math.max(...values);
  const step = Math.max(1, Math.ceil((hi0 - lo0 + 1) / (ticks - 1)));
  const lo = Math.floor(lo0 / step) * step - (hi0 - lo0 < 1 ? step : 0);
  const hi = lo + step * (ticks - 1);
  const plotH = height - top - bottom;
  const x = (i: number) =>
    left + (values.length <= 1 ? 0 : (i / (values.length - 1)) * (width - left - 8));
  const y = (v: number) => top + (1 - (v - lo) / (hi - lo || 1)) * plotH;
  const line = values
    .map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
    .join(' ');
  const area = `${line} L${x(values.length - 1).toFixed(1)},${top + plotH} L${x(0).toFixed(1)},${top + plotH} Z`;
  return (
    <View
      style={{ height }}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      accessible
      accessibilityRole="image"
      accessibilityLabel={summary}
    >
      {width > 0 && values.length ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="area" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={t.colors.primary} stopOpacity={0.35} />
              <Stop offset="1" stopColor={t.colors.primary} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {Array.from({ length: ticks }, (_, i) => {
            const v = lo + step * i;
            return (
              <SvgText key={`t${i}`} x={0} y={y(v) + 4} fontSize={11} fill={t.colors.textMuted}>
                {String(v)}
              </SvgText>
            );
          })}
          {Array.from({ length: ticks }, (_, i) => (
            <Line
              key={`g${i}`}
              x1={left}
              x2={width - 4}
              y1={y(lo + step * i)}
              y2={y(lo + step * i)}
              stroke={t.colors.border}
              strokeWidth={1}
            />
          ))}
          <Path d={area} fill="url(#area)" />
          <Path d={line} stroke={t.colors.primary} strokeWidth={2.5} fill="none" />
          {values.map((v, i) => (
            <Circle key={`d${i}`} cx={x(i)} cy={y(v)} r={3.5} fill={t.colors.primary} />
          ))}
          {labels.map((l, i) =>
            l ? (
              <SvgText
                key={`l${i}`}
                x={x(i)}
                y={height - 4}
                fontSize={10}
                fill={t.colors.textMuted}
                textAnchor={i === 0 ? 'start' : i === labels.length - 1 ? 'end' : 'middle'}
              >
                {l}
              </SvgText>
            ) : null,
          )}
        </Svg>
      ) : null}
    </View>
  );
}
