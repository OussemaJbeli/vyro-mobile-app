import { Platform } from 'react-native';

import { i18n } from '@/i18n';
import { logger } from '@/utils/logger';

import { type Desired } from './reconcile';

/** Thin expo-notifications layer (dynamic import: never breaks startup where unsupported). */
const N = () => import('expo-notifications');

export async function notificationsGranted(): Promise<boolean> {
  if (Platform.OS === 'web') return false; // local notifications are native only
  try {
    return (await (await N()).getPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/** Foreground presentation, Android channels and the session action category. */
export async function setupNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const n = await N();
    n.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    if (Platform.OS === 'android') {
      const ch = (id: string, importance: number) =>
        n.setNotificationChannelAsync(id, {
          name: i18n.t(`settings:notify.channels.${id}` as 'settings:notify.channels.sessions'),
          importance,
          sound: 'default',
        });
      await ch('sessions', n.AndroidImportance.HIGH);
      await ch('reminders', n.AndroidImportance.DEFAULT);
      await ch('timers', n.AndroidImportance.HIGH);
      await ch('summary', n.AndroidImportance.LOW);
    }
    await n.setNotificationCategoryAsync('session', [
      {
        identifier: 'start',
        buttonTitle: i18n.t('settings:notify.actions.start'),
        options: { opensAppToForeground: true },
      },
      {
        identifier: 'snooze',
        buttonTitle: i18n.t('settings:notify.actions.snooze'),
        options: { opensAppToForeground: false },
      },
      {
        identifier: 'skip',
        buttonTitle: i18n.t('settings:notify.actions.skip'),
        options: { opensAppToForeground: false },
      },
    ]);
  } catch (error) {
    logger.warn('Notification setup unavailable', { error });
  }
}

export async function scheduleOs(
  d: Pick<Desired, 'title' | 'body' | 'url' | 'channel' | 'fireAt' | 'category' | 'targetId'>,
): Promise<string> {
  const n = await N();
  return n.scheduleNotificationAsync({
    content: {
      title: d.title,
      body: d.body,
      data: { url: d.url, targetId: d.targetId },
      sound: true,
      ...(d.category ? { categoryIdentifier: d.category } : {}),
    },
    trigger: {
      type: n.SchedulableTriggerInputTypes.DATE,
      date: new Date(d.fireAt),
      channelId: d.channel,
    },
  });
}

export async function cancelOs(id: string): Promise<void> {
  try {
    await (await N()).cancelScheduledNotificationAsync(id);
  } catch {
    // Already delivered or unsupported.
  }
}
