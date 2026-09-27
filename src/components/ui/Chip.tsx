import { Pressable, ScrollView, View } from 'react-native';

import { makeStyles } from '@/theme';
import { haptics } from '@/utils/haptics';

import { GlassFill } from './GlassFill';
import { Text } from './Text';

export type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  testID?: string;
};

export function Chip({ label, selected = false, onPress, testID }: ChipProps) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      hitSlop={4}
      onPress={() => {
        haptics.tap();
        onPress?.();
      }}
      style={[styles.chip, selected && styles.selected]}
      {...(testID ? { testID } : {})}
    >
      {selected ? <GlassFill radius={999} /> : null}
      <Text variant="caption" style={selected ? styles.labelOn : styles.label}>
        {label}
      </Text>
    </Pressable>
  );
}

export type ChipOption<V extends string> = { value: V; label: string };

type ChipGroupBase<V extends string> = {
  options: ChipOption<V>[];
  /** Horizontal scroll (filter bars) instead of wrapping. */
  scrollable?: boolean;
  testID?: string;
};

export type ChipGroupProps<V extends string> = ChipGroupBase<V> &
  (
    | { multiple?: false; value: V; onChange: (value: V) => void }
    | { multiple: true; value: V[]; onChange: (value: V[]) => void }
  );

/** Filter pills (template: All / Gym / Running / Six Pack / Other). */
export function ChipGroup<V extends string>(props: ChipGroupProps<V>) {
  const styles = useStyles();
  const isSelected = (v: V) => (props.multiple ? props.value.includes(v) : props.value === v);
  const toggle = (v: V) => {
    if (props.multiple) {
      props.onChange(
        props.value.includes(v) ? props.value.filter((x) => x !== v) : [...props.value, v],
      );
    } else {
      props.onChange(v);
    }
  };
  const chips = props.options.map((o) => (
    <Chip
      key={o.value}
      label={o.label}
      selected={isSelected(o.value)}
      onPress={() => toggle(o.value)}
      testID={`chip-${o.value}`}
    />
  ));
  const testID = props.testID ? { testID: props.testID } : {};
  return props.scrollable ? (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      {...testID}
    >
      {chips}
    </ScrollView>
  ) : (
    <View style={[styles.row, styles.wrap]} {...testID}>
      {chips}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  chip: {
    minHeight: 32,
    paddingHorizontal: t.spacing.md + 2,
    justifyContent: 'center',
    borderRadius: t.radius.pill,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
  },
  selected: {
    backgroundColor: t.colors.primary,
    borderColor: t.colors.primary,
    overflow: 'hidden',
  },
  label: { color: t.colors.text },
  labelOn: { color: t.colors.onPrimary, fontFamily: t.typography.bodyStrong.fontFamily },
  row: { flexDirection: 'row', gap: t.spacing.sm },
  wrap: { flexWrap: 'wrap' },
}));
