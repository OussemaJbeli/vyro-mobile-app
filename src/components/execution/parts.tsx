import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';

import { Icon, Text, type IconName } from '@/components/ui';
import { ExerciseVideo } from '@/components/exercises/ExerciseVideo';
import { bundledImage } from '@/constants/bundledImages';
import { brand } from '@/theme/brand';
import { lighten, withAlpha } from '@/theme/color';
import { makeStyles, useTheme } from '@/theme';
import { haptics } from '@/utils/haptics';

/**
 * Execution building blocks (docs/template/running.png): glowing timer ring, outlined
 * pill buttons, round steppers, a metric card with level bars and a phase strip. Shared
 * by running, gym and abs so the three screens feel like one app.
 */

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

/** Big countdown ring: remaining fraction, gradient arc, knob at the arc end, soft glow. */
export function GlowRing({
  value,
  size,
  stroke = 14,
  children,
  accessibilityLabel,
  testID,
}: {
  value: number;
  size: number;
  stroke?: number;
  children?: ReactNode;
  accessibilityLabel?: string;
  testID?: string;
}) {
  const t = useTheme();
  const v = clamp01(value);
  const r = (size - stroke) / 2 - 6;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  // Knob position: the arc starts at 12 o'clock and runs clockwise.
  const angle = v * 2 * Math.PI - Math.PI / 2;
  const kx = c + r * Math.cos(angle);
  const ky = c + r * Math.sin(angle);
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      {...(accessibilityLabel ? { accessibilityLabel } : {})}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(v * 100) }}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
      {...(testID ? { testID } : {})}
    >
      <View
        style={{
          position: 'absolute',
          width: size - 24,
          height: size - 24,
          borderRadius: size,
          boxShadow: `0 0 36px ${withAlpha(t.colors.primary, t.scheme === 'dark' ? 0.22 : 0.12)}`,
        }}
      />
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Defs>
          <SvgGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={lighten(t.colors.primary, 0.25)} />
            <Stop offset="1" stopColor={t.colors.primary} />
          </SvgGradient>
        </Defs>
        <Circle
          cx={c}
          cy={c}
          r={r}
          stroke={withAlpha(t.colors.text, 0.08)}
          strokeWidth={stroke}
          fill="none"
        />
        {v > 0 ? (
          <Circle
            cx={c}
            cy={c}
            r={r}
            stroke="url(#ring)"
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - v)}
            transform={`rotate(-90 ${c} ${c})`}
          />
        ) : null}
        {v > 0 && v < 1 ? <Circle cx={kx} cy={ky} r={stroke * 0.55} fill={brand.white} /> : null}
      </Svg>
      <View style={{ alignItems: 'center' }}>{children}</View>
    </View>
  );
}

/** Outlined pill (template −30 s / +30 s / Skip / Repeat). */
export function PillButton({
  icon,
  label,
  onPress,
  tone = 'accent',
  accessibilityLabel,
  disabled = false,
  testID,
}: {
  icon?: IconName;
  label: string;
  onPress: () => void;
  tone?: 'accent' | 'neutral' | 'solid';
  accessibilityLabel?: string;
  disabled?: boolean;
  testID?: string;
}) {
  const t = useTheme();
  const styles = useStyles();
  const solid = tone === 'solid';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.pill,
        tone === 'accent' && styles.pillAccent,
        solid && { backgroundColor: t.colors.primary, borderColor: t.colors.primary },
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
      {...(testID ? { testID } : {})}
    >
      {icon ? (
        <Icon name={icon} size={22} color={solid ? t.colors.onPrimary : t.colors.primaryInk} />
      ) : null}
      <Text
        variant="bodyStrong"
        style={[styles.pillText, solid && { color: t.colors.onPrimary }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Round −/+ button beside the big numbers. */
export function RoundButton({
  icon,
  onPress,
  accessibilityLabel,
  size = 64,
  testID,
}: {
  icon: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  size?: number;
  testID?: string;
}) {
  const t = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      hitSlop={8}
      style={({ pressed }) => [
        styles.round,
        { width: size, height: size, borderRadius: size / 2 },
        pressed && styles.pressed,
      ]}
      {...(testID ? { testID } : {})}
    >
      <Icon name={icon} size={size * 0.42} color={t.colors.text} />
    </Pressable>
  );
}

/** Big value with an icon bubble on top (speed / incline, weight / reps). */
export function BigMetric({
  icon,
  value,
  unit,
  selected = false,
  onPress,
  accessibilityLabel,
  testID,
}: {
  icon: IconName;
  value: string;
  unit: string;
  selected?: boolean;
  onPress?: () => void;
  accessibilityLabel: string;
  testID?: string;
}) {
  const t = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={onPress ? { selected } : undefined}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={styles.metric}
      {...(testID ? { testID } : {})}
    >
      <View style={[styles.bubble, selected && { borderColor: t.colors.primary }]}>
        <Icon name={icon} size={24} color={t.colors.primaryInk} />
      </View>
      <Text style={styles.metricValue} adjustsFontSizeToFit numberOfLines={1}>
        {value}
      </Text>
      <Text variant="bodyStrong" tone="muted">
        {unit}
      </Text>
    </Pressable>
  );
}

/** Level bars (template top card): `value` of `count` segments lit. */
export function LevelBars({ value, count = 22 }: { value: number; count?: number }) {
  const t = useTheme();
  const styles = useStyles();
  const lit = Math.round(clamp01(value) * count);
  return (
    <View style={styles.bars} importantForAccessibility="no-hide-descendants">
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={[
            styles.bar,
            {
              backgroundColor:
                i < lit
                  ? t.colors.primary
                  : withAlpha(t.colors.text, t.scheme === 'dark' ? 0.1 : 0.12),
            },
          ]}
        />
      ))}
    </View>
  );
}

/** Top card: icon bubble, label/value, level bars and a small right label. */
export function MetricCard({
  icon,
  label,
  value,
  unit,
  level,
  right,
  onPress,
  testID,
}: {
  icon: IconName;
  label: string;
  value: string;
  unit?: string;
  level: number;
  right?: string;
  onPress?: () => void;
  testID?: string;
}) {
  const t = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'summary'}
      accessibilityLabel={`${label} ${value} ${unit ?? ''}${right ? `, ${right}` : ''}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && onPress && styles.pressed]}
      {...(testID ? { testID } : {})}
    >
      <View style={styles.cardIcon}>
        <Icon name={icon} size={24} color={t.colors.primaryInk} />
      </View>
      <View style={styles.cardText}>
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {label}
        </Text>
        <Text variant="heading" numberOfLines={1}>
          {value}
          {unit ? (
            <Text variant="body" tone="muted">
              {' '}
              {unit}
            </Text>
          ) : null}
        </Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.flex}>
        <LevelBars value={level} />
      </View>
      {right ? (
        <Text variant="caption" style={styles.right} numberOfLines={1}>
          {right}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** "Next: Run · 6.0 mph · 20:00" row. */
export function NextCard({
  label,
  detail,
  onPress,
}: {
  label: string;
  detail: string;
  onPress?: () => void;
}) {
  const t = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={`${label} ${detail}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && onPress && styles.pressed]}
    >
      <View style={styles.cardIcon}>
        <Icon name="clock" size={22} color={t.colors.primaryInk} />
      </View>
      <Text tone="muted" numberOfLines={1} style={styles.flex}>
        {label} <Text variant="bodyStrong">{detail}</Text>
      </Text>
      {onPress ? <Icon name="forward" size={22} color={t.colors.textMuted} /> : null}
    </Pressable>
  );
}

export type Phase = { key: string; label: string; state: 'done' | 'current' | 'pending' };

/** Bottom strip of phases (intervals or exercises); the current one is outlined. */
export function PhaseStrip({
  phases,
  onPress,
}: {
  phases: Phase[];
  onPress?: (index: number) => void;
}) {
  const t = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.strip}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.stripRow}
      >
        {phases.map((p, i) => {
          const current = p.state === 'current';
          return (
            <Pressable
              key={p.key}
              accessibilityRole={onPress ? 'button' : 'text'}
              accessibilityState={{ selected: current }}
              accessibilityLabel={p.label}
              onPress={onPress ? () => onPress(i) : undefined}
              style={[styles.phase, current && styles.phaseOn]}
            >
              <Icon
                name={p.state === 'done' ? 'check_circle' : current ? 'radio_on' : 'radio_off'}
                size={20}
                color={p.state === 'pending' ? t.colors.textMuted : t.colors.primaryInk}
              />
              <Text
                variant={current ? 'bodyStrong' : 'body'}
                tone={p.state === 'pending' ? 'muted' : 'default'}
              >
                {p.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/**
 * Faint cinematic image behind a workout screen: `assets/images/execution/<kind>.webp`.
 * Fades into the background at the top and bottom so numbers stay readable.
 */
export function ExecutionBackdrop({ kind }: { kind: 'running' | 'gym' | 'abs' }) {
  const t = useTheme();
  const source = bundledImage('execution', kind);
  if (!source) return null;
  return (
    <View
      style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Image
        source={source}
        style={[StyleSheet.absoluteFill, { opacity: t.scheme === 'dark' ? 0.24 : 0.12 }]}
        contentFit="cover"
      />
      <LinearGradient
        colors={[
          t.colors.bg,
          withAlpha(t.colors.bg, 0.35),
          withAlpha(t.colors.bg, 0.35),
          t.colors.bg,
        ]}
        locations={[0, 0.25, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

/** Exercise picture card (bundled image or the first image added in the app). */
export function ExerciseImage({
  source,
  video,
  onPress,
  badge,
  testID,
}: {
  source: number | { uri: string } | null;
  /** Bundled demo loop (assets/videos/exercises): plays instead of the picture. */
  video?: number | null;
  onPress?: () => void;
  badge?: string;
  testID?: string;
}) {
  const t = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole={onPress ? 'imagebutton' : 'image'}
      {...(badge ? { accessibilityLabel: badge } : {})}
      onPress={onPress}
      style={[styles.exImage, video ? { backgroundColor: brand.white } : null]}
      {...(testID ? { testID } : {})}
    >
      {video ? (
        <ExerciseVideo source={video} style={StyleSheet.absoluteFill} fit="cover" />
      ) : source ? (
        <Image
          source={source}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
        />
      ) : null}
      <LinearGradient
        colors={['transparent', withAlpha(t.colors.bg, 0.7)]}
        locations={[0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      {badge ? (
        <View style={styles.exBadge}>
          <Icon name="play" size={16} color={brand.white} />
          <Text variant="caption" style={styles.exBadgeText}>
            {badge}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  flex: { flex: 1 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.45 },
  pill: {
    flex: 1,
    minHeight: 56,
    borderRadius: t.radius.pill,
    borderWidth: 1.5,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.spacing.sm,
    paddingHorizontal: t.spacing.lg,
  },
  pillAccent: {
    borderColor: withAlpha(t.colors.primary, 0.7),
    boxShadow: t.scheme === 'dark' ? `0 0 12px ${withAlpha(t.colors.primary, 0.12)}` : 'none',
  },
  pillText: { color: t.colors.text },
  round: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surfaceRaised,
  },
  metric: { alignItems: 'center', gap: 2, minWidth: 96 },
  bubble: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surfaceRaised,
    marginBottom: t.spacing.xs,
  },
  metricValue: { ...t.typography.metric, fontSize: 40, lineHeight: 46, color: t.colors.text },
  bars: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 28 },
  bar: { flex: 1, height: 26, borderRadius: 2 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    padding: t.spacing.md,
    borderRadius: t.radius.lg,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.primarySoft,
  },
  cardText: { minWidth: 72 },
  divider: { width: 1, alignSelf: 'stretch', backgroundColor: t.colors.border },
  right: { color: t.colors.text },
  strip: {
    borderRadius: t.radius.pill,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
    padding: 4,
  },
  stripRow: { gap: 4 },
  phase: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    paddingHorizontal: t.spacing.lg,
    minHeight: 44,
    borderRadius: t.radius.pill,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  exImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: t.radius.lg,
    overflow: 'hidden',
    backgroundColor: t.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  exBadge: {
    position: 'absolute',
    right: t.spacing.sm,
    bottom: t.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.xs,
    borderRadius: t.radius.pill,
    backgroundColor: withAlpha(brand.black, 0.55),
  },
  exBadgeText: { color: brand.white },
  phaseOn: { borderColor: withAlpha(t.colors.primary, 0.8), backgroundColor: t.colors.primarySoft },
}));
