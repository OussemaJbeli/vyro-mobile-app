import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { I18nextProvider } from 'react-i18next';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AnimatedSplash } from '@/components/brand';
import { DatabaseGate } from '@/components/system/DatabaseGate';
import { DayRollover } from '@/components/system/DayRollover';
import { ErrorBoundary } from '@/components/system/ErrorBoundary';
import { LockGate } from '@/components/system/LockGate';
import { NotificationSync } from '@/components/system/NotificationSync';
import { ToastHost } from '@/components/ui';
import '@/hooks/bootstrap';
import { RepositoriesProvider } from '@/hooks/data';
import { DatabaseProvider } from '@/hooks/database';
import { i18n } from '@/i18n';
import { lockPortrait } from '@/services/orientation';
import { ThemeProvider, useTheme } from '@/theme';
import { fontAssets } from '@/theme/fonts';

// Keep the native splash (V on #01070C) until fonts and the database are ready.
// DatabaseGate hides it once the database is ready (or failed).
lockPortrait();

SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden (for example after a fast refresh): nothing to do.
});

const MODAL_FORMS = [
  'workout/new',
  'running/new',
  'exercise/new',
  'session/new',
  'log/new',
  'body/measure',
];
const EXECUTION = [
  'execute/[executionId]',
  'execute/run/[executionId]',
  'execute/complete/[executionId]',
];

function RootStack() {
  const { colors } = useTheme();
  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        {MODAL_FORMS.map((name) => (
          <Stack.Screen key={name} name={name} options={{ presentation: 'modal' }} />
        ))}
        {/* Execution: fullscreen, no swipe-to-dismiss, so a gesture can't abandon a set. */}
        {EXECUTION.map((name) => (
          <Stack.Screen
            key={name}
            name={name}
            options={{ presentation: 'fullScreenModal', gestureEnabled: false, animation: 'fade' }}
          />
        ))}
        <Stack.Screen name="today-complete" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen
          name="lock"
          options={{ presentation: 'fullScreenModal', gestureEnabled: false }}
        />
      </Stack>
      <ToastHost />
      <AnimatedSplash />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const ready = fontsLoaded || fontError !== null;

  // Render nothing until ready: the native splash is still covering the screen.
  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <DatabaseProvider>
            <I18nextProvider i18n={i18n}>
              <ThemeProvider>
                <DatabaseGate>
                  <RepositoriesProvider>
                    <DayRollover />
                    <NotificationSync />
                    <LockGate>
                      <RootStack />
                    </LockGate>
                  </RepositoriesProvider>
                </DatabaseGate>
              </ThemeProvider>
            </I18nextProvider>
          </DatabaseProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
