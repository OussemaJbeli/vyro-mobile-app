import { View } from 'react-native';

import { Text } from '@/components/ui';
import { makeStyles } from '@/theme';

/**
 * Vertical bars (AD-16: in-house SVG/View charts, swappable behind this API).
 * `summary` is the accessible description read instead of the bars.
 */
export function BarChart({
  values,
  labels,
  height = 120,
  summary,
  format = (v: number) => String(Math.round(v)),
}: {
  values: readonly number[];
  labels: readonly string[];
  height?: number;
  summary: string;
  format?: (v: number) => string;
}) {
  const styles = useStyles();
  const max = Math.max(1, ...values);
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={summary} style={styles.wrap}>
      <View style={[styles.bars, { height }]}>
        {values.map((v, i) => (
          <View key={i} style={styles.col}>
            {v > 0 ? (
              <Text variant="caption" tone="muted" style={styles.value}>
                {format(v)}
              </Text>
            ) : null}
            <View
              style={[
                styles.bar,
                { height: Math.max(v > 0 ? 3 : 1, (v / max) * (height - 18)) },
                v === 0 && styles.zero,
              ]}
            />
          </View>
        ))}
      </View>
      <View style={styles.labels}>
        {labels.map((l, i) => (
          <Text key={i} variant="caption" tone="muted" style={styles.label} numberOfLines={1}>
            {l}
          </Text>
        ))}
      </View>
    </View>
  );
}

/** Horizontal bars (muscle frequency). */
export function HBarChart({
  rows,
  summary,
}: {
  rows: readonly { label: string; value: number }[];
  summary: string;
}) {
  const styles = useStyles();
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={summary} style={styles.hwrap}>
      {rows.map((r) => (
        <View key={r.label} style={styles.hrow}>
          <Text variant="caption" style={styles.hlabel} numberOfLines={1}>
            {r.label}
          </Text>
          <View style={styles.htrack}>
            <View style={[styles.hbar, { width: `${(r.value / max) * 100}%` }]} />
          </View>
          <Text variant="caption" tone="muted" style={styles.hvalue}>
            {Number.isInteger(r.value) ? r.value : r.value.toFixed(1)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  wrap: { gap: t.spacing.xs },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  col: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: '70%', backgroundColor: t.colors.primary, borderRadius: 3 },
  zero: { backgroundColor: t.colors.border },
  value: { fontSize: 10 },
  labels: { flexDirection: 'row', gap: 4 },
  label: { flex: 1, textAlign: 'center', fontSize: 10 },
  hwrap: { gap: t.spacing.xs },
  hrow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
  hlabel: { width: 90 },
  htrack: {
    flex: 1,
    height: 10,
    backgroundColor: t.colors.surfaceRaised,
    borderRadius: 5,
    overflow: 'hidden',
  },
  hbar: { height: 10, backgroundColor: t.colors.primary, borderRadius: 5 },
  hvalue: { width: 32, textAlign: 'right' },
}));
