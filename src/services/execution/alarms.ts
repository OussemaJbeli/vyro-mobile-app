import { type Alarm, type ExecState } from '@/domain/execution';
import { i18n } from '@/i18n';
import { formatQuantity, type UnitPrefs } from '@/utils/units';
import { logger } from '@/utils/logger';

import { type AlarmNotifier } from './runner';

/**
 * Background timer notifications (steps 18–19): rest end, timed set end, and the next
 * interval changes of a run ("Sprint · 12.9 km/h", "ends 18:25"). Cancelled when the app
 * comes back. Silent no-op without permission.
 *
 * Limitation: expo-notifications has no ongoing/foreground-service notification, so the
 * lock screen shows the latest delivered change rather than a live-updating card.
 */
export function createNotificationAlarm(opts: { units: () => Promise<UnitPrefs> }): AlarmNotifier {
  let pending: string[] = [];

  const cancelAll = async () => {
    const ids = pending;
    pending = [];
    if (!ids.length) return;
    try {
      const N = await import('expo-notifications');
      await Promise.all(ids.map((id) => N.cancelScheduledNotificationAsync(id)));
    } catch {
      // Already delivered or unsupported: nothing to cancel.
    }
  };

  const content = (a: Alarm, s: ExecState, prefs: UnitPrefs) => {
    const locale = i18n.language;
    if (a.reason !== 'interval') {
      return { title: i18n.t('execution:alarm.title'), body: i18n.t('execution:alarm.body') };
    }
    const iv = a.nextIndex !== null ? s.intervals[a.nextIndex] : undefined;
    if (!iv) {
      return {
        title: i18n.t('execution:alarm.runDone'),
        body: i18n.t('execution:alarm.runDoneBody'),
      };
    }
    const speed = iv.actualSpeedKmh ?? iv.plannedSpeedKmh;
    const ends = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(
      new Date(a.at + iv.targetSeconds * 1000),
    );
    return {
      title: [
        i18n.t(`running:kinds.${iv.kind}`),
        speed ? formatQuantity(speed, 'speed', prefs, locale) : null,
      ]
        .filter(Boolean)
        .join(' · '),
      body: i18n.t('execution:alarm.intervalEnds', { time: ends }),
    };
  };

  return {
    async schedule(alarms, state) {
      await cancelAll();
      if (!alarms.length) return;
      try {
        const N = await import('expo-notifications');
        const prefs = await opts.units();
        for (const a of alarms) {
          const id = await N.scheduleNotificationAsync({
            content: { ...content(a, state, prefs), sound: true, data: { kind: 'timer' } },
            trigger: {
              type: N.SchedulableTriggerInputTypes.DATE,
              date: new Date(a.at),
              channelId: 'timers',
            },
          });
          pending.push(id);
        }
      } catch (error) {
        logger.warn('Timer alarms not scheduled', { error });
      }
    },
    cancel: cancelAll,
  };
}
