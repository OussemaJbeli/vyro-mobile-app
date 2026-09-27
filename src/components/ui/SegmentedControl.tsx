import { Pressable, View } from 'react-native';

import { makeStyles } from '@/theme';
import { haptics } from '@/utils/haptics';

import { Text } from './Text';

export type SegmentedControlProps<V extends string> = {
  segments: { value: V; label: string }[];
  value: V;
  onChange: (value: V) => void;
  testID?: string;
};

/** 2–5 segments (template Progress: Overview / Body / Photos / History). */
export function SegmentedControl<V extends string>({
  segments,
  value,
  onChange,
  testID,
}: SegmentedControlProps<V>) {
  const styles = useStyles();
  return (
    <View accessibilityRole="tablist" style={styles.track} {...(testID ? { testID } : {})}>
      {segments.map((s) => {
        const on = s.value === value;
        return (
          <Pressable
            key={s.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => {
              if (!on) haptics.tap();
              onChange(s.value);
            }}
            style={[styles.segment, on && styles.segmentOn]}
          >
            <Text variant="caption" style={on ? styles.labelOn : styles.label} numberOfLines={1}>
              {s.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  track: {
    flexDirection: 'row',
    padding: t.spacing.xs,
    gap: t.spacing.xs,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  segment: {
    flex: 1,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: t.radius.pill,
    paddingHorizontal: t.spacing.sm,
  },
  segmentOn: { backgroundColor: t.colors.primary },
  label: { color: t.colors.textMuted },
  labelOn: { color: t.colors.onPrimary, fontFamily: t.typography.bodyStrong.fontFamily },
}));
