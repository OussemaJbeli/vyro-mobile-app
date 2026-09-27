import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { i18n } from '@/i18n';
import { brand } from '@/theme/brand';
import { logger } from '@/utils/logger';
import { fontFamily } from '@/theme/fonts';

type Props = { children: ReactNode };
type State = { failed: boolean };

/**
 * Last-resort boundary. Shows a human message (FS §57) and lets the user retry.
 * It sits outside ThemeProvider, so it uses plain RN components and brand primitives.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error('Unhandled render error', { error, componentStack: info.componentStack });
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View style={styles.screen}>
        <Text accessibilityRole="header" style={styles.title}>
          {i18n.t('errors:boundaryTitle')}
        </Text>
        <Text style={styles.muted}>{i18n.t('errors:boundaryBody')}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => this.setState({ failed: false })}
          style={styles.button}
        >
          <Text style={styles.buttonText}>{i18n.t('common:retry')}</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 32,
    backgroundColor: brand.background,
  },
  title: { color: brand.white, fontFamily: fontFamily.bold, fontSize: 24, textAlign: 'center' },
  muted: { color: brand.white, opacity: 0.7, fontFamily: fontFamily.medium, textAlign: 'center' },
  button: {
    minHeight: 52,
    paddingHorizontal: 28,
    borderRadius: 999,
    justifyContent: 'center',
    backgroundColor: brand.primary,
  },
  buttonText: { color: brand.background, fontFamily: fontFamily.semibold, fontSize: 15 },
});
