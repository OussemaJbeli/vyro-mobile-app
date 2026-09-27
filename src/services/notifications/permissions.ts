import { Platform } from 'react-native';

import { logger } from '@/utils/logger';

/**
 * Asks for notification permission in context (onboarding step 8, settings in step 25).
 * Never throws: denial or an unsupported environment (for example Expo Go limits)
 * simply returns false, and the app works fully without reminders.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const Notifications = await import('expo-notifications');
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const next = await Notifications.requestPermissionsAsync();
    return next.granted;
  } catch (e) {
    logger.warn('Notification permission unavailable', { error: e });
    return false;
  }
}
