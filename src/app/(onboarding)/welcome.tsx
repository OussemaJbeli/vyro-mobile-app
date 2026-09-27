import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { VyroLogo } from '@/components/brand';
import { Button, HeroBackground, Text } from '@/components/ui';
import { routes } from '@/constants/routes';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useSettingsStore } from '@/store/settingsStore';
import { makeStyles, useTheme } from '@/theme';

/** Welcome (template "Theme Variations" splash: "Train smarter. Live stronger." + Get Started). */
export default function WelcomeScreen() {
  const { t } = useTranslation('onboarding');
  const theme = useTheme();
  const styles = useStyles();
  const hasDraft = useSettingsStore((s) => s.values['onboarding.draft'] !== null);

  const start = () => {
    const draft = useOnboardingStore.getState().begin();
    router.push(routes.setupStep(draft.step));
  };

  // Template "Theme Variations": compact logo, mountains mid-screen, two-line tagline, button.
  const [line1, line2] = t('welcome.tagline').split(/(?<=\.)\s+/);
  return (
    <HeroBackground>
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <View style={styles.logo}>
          <VyroLogo
            width={170}
            color={theme.colors.primary}
            tagline={false}
            testID="welcome-logo"
          />
        </View>
        <View style={styles.spacer} />
        <View style={styles.bottom}>
          <Text variant="title" align="center" accessibilityRole="header" style={styles.tagline}>
            {line2 ? `${line1}\n${line2}` : t('welcome.tagline')}
          </Text>
          <Button
            label={hasDraft ? t('welcome.resume') : t('welcome.getStarted')}
            size="xl"
            fullWidth
            onPress={start}
            testID="welcome-start"
          />
          <Text variant="caption" tone="muted" align="center">
            {t('welcome.subtitle')}
          </Text>
        </View>
      </SafeAreaView>
    </HeroBackground>
  );
}

const useStyles = makeStyles((t) => ({
  screen: { flex: 1, paddingHorizontal: t.spacing.xxl },
  logo: { alignItems: 'center', paddingTop: '14%' },
  spacer: { flex: 1 },
  bottom: { gap: t.spacing.lg, paddingBottom: t.spacing.xxl },
  tagline: { fontSize: 26, lineHeight: 34 },
}));
