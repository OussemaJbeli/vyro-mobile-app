import { useQueryClient } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { executionRoute, useStartWorkout } from '@/components/execution/useStartWorkout';
import { invalidates, useRepositories } from '@/hooks/data';
import { scheduleOs, setupNotifications } from '@/services/notifications/native';
import { createNotificationSync } from '@/services/notifications/sync';
import { useExecutionStore } from '@/store/executionStore';
import { useSettingsStore } from '@/store/settingsStore';
import { logger } from '@/utils/logger';

const DEBOUNCE_MS = 1000;
const HOURLY_MS = 3_600_000;

type Response = {
  actionIdentifier: string;
  notification: {
    request: {
      content: { title: string | null; body: string | null; data: Record<string, unknown> };
    };
  };
};

/**
 * Keeps local reminders reconciled (step 25): on start, on foreground (and timezone
 * change), after data or settings changes (debounced 1 s) and hourly. Also routes taps
 * and actions (Start / Snooze / Skip) to the right screen.
 */
/** Local notifications are native only; on web this renders just the start dialog. */
export function NotificationSync() {
  const native = Platform.OS !== 'web';
  const repos = useRepositories();
  const client = useQueryClient();
  const starter = useStartWorkout();
  const startRef = useRef(starter.start);
  useEffect(() => {
    startRef.current = starter.start;
  }, [starter.start]);
  const [sync] = useState(() =>
    createNotificationSync({
      schedule: repos.schedule,
      notifications: repos.notifications,
      settings: () => useSettingsStore.getState().values,
    }),
  );

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const soon = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void sync.sync(), DEBOUNCE_MS);
    };
    if (!native) return;
    void setupNotifications().then(() => sync.sync());
    let tz = new Date().getTimezoneOffset();
    const app = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      tz = new Date().getTimezoneOffset();
      void sync.sync();
    });
    const hourly = setInterval(() => {
      if (new Date().getTimezoneOffset() !== tz) tz = new Date().getTimezoneOffset();
      void sync.sync();
    }, HOURLY_MS);
    const queries = client.getQueryCache().subscribe((e) => {
      if (e.type === 'updated' && e.action.type === 'success' && e.query.queryKey[0] === 'sessions')
        soon();
    });
    const mutations = client.getMutationCache().subscribe((e) => {
      if (e.type === 'updated' && e.action.type === 'success') soon();
    });
    const settings = useSettingsStore.subscribe((s, prev) => {
      if (
        Object.keys(s.values).some(
          (k) =>
            k.startsWith('notifications.') &&
            s.values[k as 'notifications.enabled'] !== prev.values[k as 'notifications.enabled'],
        )
      )
        soon();
    });
    const execution = useExecutionStore.subscribe((s, prev) => {
      if (!!s.state !== !!prev.state) soon();
    });
    return () => {
      if (timer) clearTimeout(timer);
      app.remove();
      clearInterval(hourly);
      queries();
      mutations();
      settings();
      execution();
    };
  }, [client, sync, native]);

  useEffect(() => {
    const handle = async (r: Response) => {
      const data = r.notification.request.content.data ?? {};
      const url = typeof data.url === 'string' ? data.url : null;
      const target = typeof data.targetId === 'string' ? data.targetId : null;
      try {
        if (data.kind === 'timer') {
          const active = useExecutionStore.getState().state;
          if (active) router.push(executionRoute(active));
          return;
        }
        if (r.actionIdentifier === 'snooze') {
          await scheduleOs({
            title: r.notification.request.content.title ?? '',
            body: r.notification.request.content.body ?? '',
            url: url ?? '/start',
            channel: 'sessions',
            fireAt: Date.now() + 10 * 60_000,
            category: 'session',
            targetId: target,
          });
          return;
        }
        if (r.actionIdentifier === 'skip' && target) {
          await repos.schedule.skip(target, null);
          await Promise.all(
            invalidates.schedule.map((queryKey) =>
              client.invalidateQueries({ queryKey: [...queryKey] }),
            ),
          );
          return;
        }
        if (r.actionIdentifier === 'start' && target) {
          const s = await repos.schedule.getSession(target);
          await startRef.current({
            templateId: s.templateId,
            scheduledSessionId: s.id,
            title: s.title,
            type: s.type,
          });
          return;
        }
        if (url) router.push(url as Href);
      } catch (error) {
        logger.warn('Notification action failed', { error });
      }
    };
    if (!native) return;
    let sub: { remove: () => void } | null = null;
    let alive = true;
    void import('expo-notifications')
      .then((n) => {
        if (!alive) return;
        const last = n.getLastNotificationResponse();
        if (last) {
          void handle(last as unknown as Response);
          void n.clearLastNotificationResponseAsync();
        }
        sub = n.addNotificationResponseReceivedListener(
          (r) => void handle(r as unknown as Response),
        );
      })
      .catch(() => {});
    return () => {
      alive = false;
      sub?.remove();
    };
  }, [client, repos, native]);

  return starter.element;
}
