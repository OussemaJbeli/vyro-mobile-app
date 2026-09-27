import { router } from 'expo-router';
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, IconButton, ProgressBar, Text } from '@/components/ui';
import { makeStyles } from '@/theme';

export type OnboardingLayoutProps = {
  title: string;
  subtitle?: string;
  /** 1-based position among the question steps (excludes the summary). */
  index: number;
  total: number;
  onContinue: () => void;
  continueLabel?: string;
  continueDisabled?: boolean;
  /** Optional steps show "Skip" in the header (FS §52). */
  onSkip?: () => void;
  onBack?: () => void;
  secondary?: { label: string; onPress: () => void };
  loading?: boolean;
  children?: ReactNode;
};

/** Shared frame for every setup step: progress, back, skip, content and a sticky CTA. */
export function OnboardingLayout({
  title,
  subtitle,
  index,
  total,
  onContinue,
  continueLabel,
  continueDisabled,
  onSkip,
  onBack,
  secondary,
  loading,
  children,
}: OnboardingLayoutProps) {
  const styles = useStyles();
  const { t } = useTranslation('onboarding');
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.top}>
          <IconButton
            icon="back"
            variant="plain"
            accessibilityLabel={t('nav.back')}
            onPress={onBack ?? (() => router.back())}
          />
          <View style={styles.progress}>
            <ProgressBar
              value={index / total}
              label={t('nav.stepOf', { current: index, total })}
              height={6}
            />
          </View>
          {onSkip ? (
            <Button
              label={t('nav.skip')}
              variant="ghost"
              size="sm"
              onPress={onSkip}
              testID="onboarding-skip"
            />
          ) : (
            <View style={styles.skipSpacer} />
          )}
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text variant="title" accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? <Text tone="muted">{subtitle}</Text> : null}
          <View style={styles.body}>{children}</View>
        </ScrollView>
        <View style={styles.footer}>
          <Button
            label={continueLabel ?? t('nav.continue')}
            size="lg"
            fullWidth
            onPress={onContinue}
            disabled={!!continueDisabled}
            loading={!!loading}
            testID="onboarding-continue"
          />
          {secondary ? (
            <Button label={secondary.label} variant="ghost" fullWidth onPress={secondary.onPress} />
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((t) => ({
  screen: { flex: 1, backgroundColor: t.colors.bg },
  flex: { flex: 1 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    paddingHorizontal: t.spacing.sm,
    paddingTop: t.spacing.sm,
  },
  progress: { flex: 1 },
  skipSpacer: { width: 64 },
  content: { padding: t.spacing.xl, gap: t.spacing.sm },
  body: { marginTop: t.spacing.xl, gap: t.spacing.md },
  footer: { padding: t.spacing.xl, paddingTop: t.spacing.sm, gap: t.spacing.xs },
}));
