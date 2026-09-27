import { type notificationRepo } from '@/db/repositories/notifications';
import { type scheduleRepo } from '@/db/repositories/schedule';
import { addDaysIso } from '@/domain/scheduling/recurrence';
import { i18n } from '@/i18n';
import { type Settings } from '@/types/settings';
import { today } from '@/utils/dates';
import { logger } from '@/utils/logger';

import { cancelOs, notificationsGranted, scheduleOs } from './native';
import { desiredNotifications, reconcile, type NotifySettings } from './reconcile';

export function notifySettings(v: Settings): NotifySettings {
  return {
    enabled: v['notifications.enabled'],
    sessions: v['notifications.sessions'],
    sessionOffset: v['notifications.sessionOffset'],
    running: v['notifications.running'],
    nudge: v['notifications.nudge'],
    nudgeTime: v['notifications.nudgeTime'],
    missed: v['notifications.missed'],
    weight: v['notifications.weight'],
    weightTime: v['notifications.weightTime'],
    weightDays: v['notifications.weightDays'],
    measurement: v['notifications.measurement'],
    measurementDay: v['notifications.measurementDay'],
    measurementTime: v['notifications.measurementTime'],
    photo: v['notifications.photo'],
    photoTime: v['notifications.photoTime'],
    photoAnchor: v['notifications.photoAnchor'],
    weekly: v['notifications.weekly'],
    backup: v['notifications.backup'],
    backupLastAt: v['backup.lastAt'],
    quietStart: v['notifications.quietStart'],
    quietEnd: v['notifications.quietEnd'],
  };
}

/**
 * Applies the reconcile plan (step 25): desired set from state → cancel stale OS
 * notifications → schedule missing ones, keeping notification_schedules in step.
 */
export function createNotificationSync(deps: {
  schedule: ReturnType<typeof scheduleRepo>;
  notifications: ReturnType<typeof notificationRepo>;
  settings: () => Settings;
}) {
  let running: Promise<void> | null = null;
  const run = async () => {
    const settings = notifySettings(deps.settings());
    const granted = settings.enabled && (await notificationsGranted());
    const day = today();
    const sessions = granted
      ? (await deps.schedule.sessionsForRange(addDaysIso(day, -2), addDaysIso(day, 14))).map(
          (s) => ({
            id: s.id,
            date: s.scheduledDate,
            startTime: s.startTime,
            type: s.type,
            status: s.status,
            title: s.title,
            reminderOffsetMinutes: s.reminderOffsetMinutes,
          }),
        )
      : [];
    const desired = granted
      ? desiredNotifications(settings, sessions, Date.now(), (key, vars) =>
          i18n.t(`settings:notify.texts.${key}` as 'settings:notify.texts.session', vars ?? {}),
        )
      : [];
    const plan = reconcile(desired, await deps.notifications.all());
    for (const e of plan.toCancel) {
      await cancelOs(e.osNotificationId);
      await deps.notifications.deleteByOsId(e.osNotificationId);
    }
    for (const d of plan.toSchedule) {
      try {
        const osId = await scheduleOs(d);
        await deps.notifications.insert({
          kind: d.kind,
          targetId: d.targetId,
          osNotificationId: osId,
          fireAt: new Date(d.fireAt).toISOString(),
        });
      } catch (error) {
        logger.warn('Reminder not scheduled', { error, kind: d.kind });
      }
    }
  };
  return {
    /** Serialized: overlapping triggers coalesce into one pass. */
    sync(): Promise<void> {
      running ??= run()
        .catch((error: unknown) => logger.warn('Notification sync failed', { error }))
        .finally(() => {
          running = null;
        });
      return running;
    },
  };
}

export type NotificationSync = ReturnType<typeof createNotificationSync>;
