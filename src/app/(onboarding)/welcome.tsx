import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { VyroLogo } from '@/components/brand';
import { Button, Icon, Text, type IconName } from '@/components/ui';
import { routes } from '@/constants/routes';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useSettingsStore } from '@/store/settingsStore';
import { makeStyles, useTheme } from '@/theme';
import { withAlpha } from '@/theme/color';

/** Full-screen welcome art (glowing summit path), assets/images/home/home_bg.png. */
const BACKGROUND = require('../../../assets/images/home/home_bg.png') as number;

const FEATURES: { key: 'track' | 'custom' | 'healthy' | 'control'; icon: IconName }[] = [
  { key: 'track', icon: 'progress' },
  { key: 'custom', icon: 'act_dumbbell' },
  { key: 'healthy', icon: 'act_heart' },
  { key: 'control', icon: 'lock' },
];

/** Welcome (template docs/template/1000026522.png): logo, summit art, headline, features, CTA. */
export default function WelcomeScreen() {
  const { t } = useTranslation('onboarding');
  const theme = useTheme();
  const styles = useStyles();
  const hasDraft = useSettingsStore((s) => s.values['onboarding.draft'] !== null);

  const start = () => {
    const draft = useOnboardingStore.getState().begin();
    router.push(routes.setupStep(draft.step));
  };

  return (
    <View style={[styles.fill, { backgroundColor: theme.colors.bg }]}>
      <Image
        source={BACKGROUND}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        contentPosition="top"
        accessibilityIgnoresInvertColors
      />
      {/* Darken top (logo) and bottom (text) so both stay readable over the art. */}
      <LinearGradient
        colors={[
          withAlpha(theme.colors.bg, 0.55),
          'transparent',
          'transparent',
          withAlpha(theme.colors.bg, 0.85),
          theme.colors.bg,
        ]}
        locations={[0, 0.22, 0.45, 0.66, 0.85]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <View style={styles.logo}>
          <VyroLogo width={190} color={theme.colors.primary} tagline testID="welcome-logo" />
        </View>
        <View style={styles.spacer} />
        <View style={styles.bottom}>
          <View>
            <Text align="center" accessibilityRole="header" style={styles.headline}>
              {t('welcome.headline1')}
            </Text>
            <Text align="center" style={[styles.headline, { color: theme.colors.primary }]}>
              {t('welcome.headline2')}
            </Text>
          </View>
          <Text tone="muted" align="center">
            {t('welcome.body')}
          </Text>
          <View style={styles.features}>
            {FEATURES.map((f, i) => (
              <View key={f.key} style={[styles.feature, i > 0 && styles.featureDivider]}>
                <Icon name={f.icon} size={26} color={theme.colors.primary} />
                <Text variant="caption" align="center" numberOfLines={2}>
                  {t(`welcome.features.${f.key}`)}
                </Text>
              </View>
            ))}
          </View>
          <Button
            label={`${hasDraft ? t('welcome.resume') : t('welcome.getStarted')}  →`}
            size="xl"
            fullWidth
            onPress={start}
            testID="welcome-start"
          />
          <View style={styles.dots} accessibilityElementsHidden>
            <View style={[styles.dot, styles.dotOn, { backgroundColor: theme.colors.primary }]} />
            <View style={styles.dot} />
            <View style={styles.dot} />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  fill: { flex: 1 },
  screen: { flex: 1, paddingHorizontal: t.spacing.xl },
  logo: { alignItems: 'center', paddingTop: t.spacing.xxl },
  spacer: { flex: 1 },
  bottom: { gap: t.spacing.lg, paddingBottom: t.spacing.lg },
  headline: { fontFamily: t.typography.title.fontFamily, fontSize: 34, lineHeight: 40 },
  features: { flexDirection: 'row', paddingVertical: t.spacing.sm },
  feature: { flex: 1, alignItems: 'center', gap: t.spacing.xs, paddingHorizontal: t.spacing.xs },
  featureDivider: { borderLeftWidth: 1, borderLeftColor: t.colors.border },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: t.spacing.xs },
  dot: { width: 8, height: 4, borderRadius: 2, backgroundColor: t.colors.border },
  dotOn: { width: 22 },
}));
