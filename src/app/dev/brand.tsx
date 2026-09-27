import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { VyroLogo, VyroMark } from '@/components/brand';
import { accentNames, accentPresets, makeStyles, type AccentName } from '@/theme';

/** Dev-only brand preview: every logo variant in every accent (roadmap step 02). */
export default function BrandPreview() {
  const [accent, setAccent] = useState<AccentName>('lime');
  const color = accentPresets[accent];
  const styles = useStyles();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Brand preview</Text>

      <View style={styles.swatches}>
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
              name === accent && styles.swatchSelected,
            ]}
          />
        ))}
      </View>

      <Section title="Stacked (splash, welcome)">
        <VyroLogo color={color} width={240} />
      </Section>
      <Section title="Horizontal (headers, footer)">
        <VyroLogo variant="horizontal" color={color} width={200} />
      </Section>
      <Section title="Mark sizes">
        <View style={styles.row}>
          {[24, 48, 96].map((s) => (
            <VyroMark key={s} size={s} color={color} />
          ))}
          <VyroMark size={96} color={color} glow />
        </View>
      </Section>
      <Section title="All accents">
        <View style={styles.row}>
          {accentNames.map((name) => (
            <VyroMark key={name} size={48} color={accentPresets[name]} glow />
          ))}
        </View>
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  screen: { flex: 1, backgroundColor: t.colors.bg },
  content: { padding: t.spacing.xl, paddingTop: 64, gap: t.spacing.xl },
  heading: { ...t.typography.title, color: t.colors.text },
  swatches: { flexDirection: 'row', gap: t.spacing.md },
  swatch: { width: 36, height: 36, borderRadius: t.radius.pill },
  swatchSelected: { borderWidth: 3, borderColor: t.colors.text },
  section: { gap: t.spacing.sm },
  sectionTitle: { ...t.typography.overline, color: t.colors.textMuted },
  card: {
    alignItems: 'center',
    padding: t.spacing.xxl,
    borderRadius: t.radius.lg,
    borderWidth: 1,
    borderColor: t.colors.borderAccent,
    backgroundColor: t.colors.surface,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.lg, flexWrap: 'wrap' },
}));
