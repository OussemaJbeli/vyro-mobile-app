import { Pressable, ScrollView, Text, View } from 'react-native';

import { withAlpha } from '@/theme/color';

import {
  accentNames,
  accentPresets,
  makeStyles,
  useTheme,
  useThemeControls,
  type ThemePreference,
  type TypographyVariant,
} from '@/theme';

const PREFERENCES: ThemePreference[] = ['system', 'dark', 'light'];

/** Dev-only preview of every theme token, both schemes and all accents (roadmap step 03). */
export default function ThemePreview() {
  const theme = useTheme();
  const { preference, setPreference, accent, setAccent } = useThemeControls();
  const styles = useStyles();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Theme preview</Text>

      <View style={styles.row}>
        {PREFERENCES.map((p) => (
          <Pressable
            key={p}
            onPress={() => setPreference(p)}
            accessibilityRole="button"
            accessibilityState={{ selected: p === preference }}
            style={[styles.segment, p === preference && styles.segmentOn]}
          >
            <Text style={[styles.segmentText, p === preference && styles.segmentTextOn]}>{p}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.row}>
        {accentNames.map((name) => (
          <Pressable
            key={name}
            onPress={() => setAccent(name)}
            accessibilityRole="button"
            accessibilityLabel={`Use ${name} accent`}
            accessibilityState={{ selected: name === accent }}
            style={[
              styles.swatch,
              { backgroundColor: accentPresets[name] },
              name === accent && styles.swatchOn,
            ]}
          />
        ))}
      </View>

      <Text style={styles.overline}>Colours · {theme.scheme}</Text>
      <View style={styles.grid}>
        {Object.entries({
          ...theme.colors,
          ...Object.fromEntries(
            Object.entries(theme.colors.activity).map(([k, v]) => [`activity.${k}`, v]),
          ),
        })
          .filter((e): e is [string, string] => typeof e[1] === 'string')
          .map(([name, value]) => (
            <View key={name} style={styles.token}>
              <View style={[styles.chip, { backgroundColor: value }]} />
              <Text style={styles.tokenName}>{name}</Text>
            </View>
          ))}
      </View>

      <Text style={styles.overline}>Typography</Text>
      {(Object.keys(theme.typography) as TypographyVariant[]).map((v) => (
        <Text key={v} style={[theme.typography[v], { color: theme.colors.text }]}>
          {v === 'timer' || v === 'metric' ? '01:32' : v}
        </Text>
      ))}

      <Text style={styles.overline}>Status</Text>
      {Object.entries(theme.status).map(([name, s]) => (
        <Text
          key={name}
          style={[styles.status, { color: s.color }, s.strikethrough ? styles.strike : null]}
        >
          ● {name} ({s.icon})
        </Text>
      ))}

      <Text style={styles.overline}>Primary button</Text>
      <View style={styles.button}>
        <Text style={styles.buttonText}>Start Workout</Text>
      </View>
    </ScrollView>
  );
}

const useStyles = makeStyles((t) => ({
  screen: { flex: 1, backgroundColor: t.colors.bg },
  content: { padding: t.spacing.xl, paddingTop: 64, gap: t.spacing.md },
  title: { ...t.typography.title, color: t.colors.text },
  overline: { ...t.typography.overline, color: t.colors.textMuted, marginTop: t.spacing.lg },
  row: { flexDirection: 'row', gap: t.spacing.sm, flexWrap: 'wrap' },
  segment: {
    paddingHorizontal: t.spacing.lg,
    minHeight: t.touch.min,
    justifyContent: 'center',
    borderRadius: t.radius.pill,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  segmentOn: { backgroundColor: t.colors.primary, borderColor: t.colors.primary },
  segmentText: { ...t.typography.bodyStrong, color: t.colors.text },
  segmentTextOn: { color: t.colors.onPrimary },
  swatch: { width: t.touch.min, height: t.touch.min, borderRadius: t.radius.pill },
  swatchOn: { borderWidth: 3, borderColor: t.colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md },
  token: { width: 96, gap: t.spacing.xs },
  chip: {
    height: 40,
    borderRadius: t.radius.md,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  tokenName: { ...t.typography.caption, color: t.colors.textMuted },
  status: { ...t.typography.bodyStrong },
  strike: { textDecorationLine: 'line-through' },
  button: {
    alignSelf: 'flex-start',
    backgroundColor: t.colors.primary,
    borderRadius: t.radius.pill,
    paddingHorizontal: t.spacing.xxl,
    minHeight: t.touch.comfortable,
    justifyContent: 'center',
    boxShadow: t.scheme === 'dark' ? `0 0 16px ${withAlpha(t.colors.primary, 0.5)}` : 'none',
  },
  buttonText: { ...t.typography.bodyStrong, color: t.colors.onPrimary },
}));
