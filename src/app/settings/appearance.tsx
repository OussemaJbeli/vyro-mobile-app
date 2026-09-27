import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { goBack } from '@/constants/navigation';
import { routes } from '@/constants/routes';
import { VyroLogo } from '@/components/brand';
import {
  Card,
  Header,
  Icon,
  ScreenContainer,
  SectionHeader,
  SegmentedControl,
  Text,
} from '@/components/ui';
import {
  accentNames,
  accentPresets,
  buildColors,
  makeStyles,
  useTheme,
  useThemeControls,
  type ThemePreference,
} from '@/theme';

/** Appearance (step 12, template "Theme Variations" + "Color Customization Example"). */
export default function AppearanceScreen() {
  const { t } = useTranslation('settings');
  const theme = useTheme();
  const styles = useStyles();
  const { preference, setPreference, accent, setAccent } = useThemeControls();

  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <Header title={t('appearance.title')} onBack={() => goBack(routes.settings)} large={false} />

      <SectionHeader title={t('appearance.theme')} />
      <SegmentedControl<ThemePreference>
        segments={(['system', 'dark', 'light'] as const).map((v) => ({
          value: v,
          label: t(`appearance.${v}`),
        }))}
        value={preference}
        onChange={setPreference}
        testID="appearance-theme"
      />
      <View style={styles.previews}>
        {(['dark', 'light'] as const).map((scheme) => {
          const c = buildColors(scheme, accent);
          const active = theme.scheme === scheme;
          return (
            <View
              key={scheme}
              accessible
              accessibilityLabel={t(`appearance.${scheme}`)}
              style={[
                styles.phone,
                { backgroundColor: c.bg, borderColor: active ? c.primaryInk : c.border },
              ]}
            >
              <VyroLogo width={96} color={c.primary} tagline={false} />
              <Text variant="caption" style={{ color: c.text, textAlign: 'center' }}>
                {t('appearance.preview')}
              </Text>
              <View style={[styles.pill, { backgroundColor: c.primary }]} />
            </View>
          );
        })}
      </View>

      <SectionHeader title={t('appearance.accent')} />
      <Text variant="caption" tone="muted">
        {t('appearance.accentHint')}
      </Text>
      <Card>
        <View style={styles.swatches}>
          {accentNames.map((name) => {
            const on = name === accent;
            return (
              <Pressable
                key={name}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={t(`appearance.accents.${name}`)}
                onPress={() => setAccent(name)}
                style={styles.swatchCell}
                testID={`accent-${name}`}
              >
                <View
                  style={[
                    styles.swatch,
                    { backgroundColor: accentPresets[name] },
                    on && styles.swatchOn,
                  ]}
                >
                  {on ? <Icon name="check" size={20} color={theme.colors.onPrimary} /> : null}
                </View>
                <Text variant="caption" tone={on ? 'default' : 'muted'}>
                  {t(`appearance.accents.${name}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>
    </ScreenContainer>
  );
}

const useStyles = makeStyles((t) => ({
  previews: { flexDirection: 'row', gap: t.spacing.md },
  phone: {
    flex: 1,
    alignItems: 'center',
    gap: t.spacing.sm,
    paddingVertical: t.spacing.xl,
    paddingHorizontal: t.spacing.md,
    borderRadius: t.radius.xl,
    borderWidth: 2,
  },
  pill: { width: '70%', height: 24, borderRadius: t.radius.pill },
  swatches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: t.spacing.lg,
  },
  swatchCell: { width: '30%', alignItems: 'center', gap: t.spacing.xs },
  swatch: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchOn: { borderWidth: 3, borderColor: t.colors.text },
}));
