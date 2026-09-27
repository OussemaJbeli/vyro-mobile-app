/**
 * Notification reconciliation (step 25). Pure: the desired set is recomputed from state,
 * then diffed against what is scheduled, so rescheduling, completing or disabling can
 * never leave stale reminders. The OS caps pending notifications (iOS: 64): keep ≤ 50,
 * prioritized sessions > nudges/follow-ups > body reminders/summary. Timers (rest,
 * intervals) are handled by the execution runner and not counted here.
 */
import { type NotificationKind } from '@/types/enums';

export const MAX_PENDING = 50;
const DAY = 86_400_000;

export type Channel = 'sessions' | 'reminders' | 'summary';

export type Desired = {
  kind: NotificationKind;
  targetId: string | null;
  fireAt: number;
  title: string;
  body: string;
  /** Deep link opened on tap. */
  url: string;
  channel: Channel;
  /** Notification actions category (Start / Snooze / Skip). */
  category?: 'session';
  priority: 1 | 2 | 3;
};

export type NotifySession = {
  id: string;
  date: string;
  startTime: string | null;
  type: string;
  status: string;
  title: string;
  reminderOffsetMinutes: number | null;
};

export type NotifySettings = {
  enabled: boolean;
  sessions: boolean;
  sessionOffset: number;
  running: boolean;
  nudge: boolean;
  nudgeTime: string;
  missed: boolean;
  weight: boolean;
  weightTime: string;
  weightDays: number[];
  measurement: boolean;
  measurementDay: number;
  measurementTime: string;
  photo: boolean;
  photoTime: string;
  photoAnchor: string | null;
  weekly: boolean;
  backup: boolean;
  backupLastAt: string | null;
  quietStart: string;
  quietEnd: string;
};

export type Texts = (key: string, vars?: Record<string, string | number>) => string;

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number) as [number, number];
  return h * 60 + m;
};

/** Local wall time on a local date → epoch ms. */
export function at(date: string, hhmm: string): number {
  const [y, mo, d] = date.split('-').map(Number) as [number, number, number];
  const [h, m] = hhmm.split(':').map(Number) as [number, number];
  return new Date(y, mo - 1, d, h, m, 0, 0).getTime();
}

const localDate = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const addDays = (date: string, n: number) => localDate(at(date, '12:00') + n * DAY);

/** Moves a non-timed reminder out of quiet hours (to the end of the quiet window). */
export function shiftOutOfQuiet(ms: number, quietStart: string, quietEnd: string): number {
  const d = new Date(ms);
  const m = d.getHours() * 60 + d.getMinutes();
  const s = minutes(quietStart);
  const e = minutes(quietEnd);
  const inQuiet = s === e ? false : s < e ? m >= s && m < e : m >= s || m < e;
  if (!inQuiet) return ms;
  const date = localDate(ms);
  // After quiet start (evening) → next day's end; after midnight → today's end.
  const endDay = s > e && m >= s ? addDays(date, 1) : date;
  return at(endDay, quietEnd);
}

export function desiredNotifications(
  settings: NotifySettings,
  sessions: readonly NotifySession[],
  now: number,
  t: Texts,
  horizonDays = 7,
): Desired[] {
  if (!settings.enabled) return [];
  const today = localDate(now);
  const end = addDays(today, horizonDays);
  const out: Desired[] = [];
  const quiet = (ms: number) => shiftOutOfQuiet(ms, settings.quietStart, settings.quietEnd);
  const push = (d: Desired) => {
    if (d.fireAt > now && d.fireAt <= at(end, '23:59')) out.push(d);
  };

  const planned = sessions.filter((s) => s.type !== 'rest' && s.status === 'planned');
  for (const s of planned) {
    if (s.date < today || s.date > end) continue;
    const on = s.type === 'running' ? settings.running : settings.sessions;
    if (s.startTime && on) {
      const offset = s.reminderOffsetMinutes ?? settings.sessionOffset;
      push({
        kind: 'session',
        targetId: s.id,
        fireAt: at(s.date, s.startTime) - offset * 60_000,
        title: t(s.type === 'running' ? 'run' : 'session', { title: s.title, minutes: offset }),
        body: t('sessionBody', { time: s.startTime }),
        url: `/session/${s.id}`,
        channel: 'sessions',
        category: 'session',
        priority: 1,
      });
    }
  }

  if (settings.nudge) {
    const byDay = new Map<string, NotifySession[]>();
    for (const s of planned) if (!s.startTime) byDay.set(s.date, [...(byDay.get(s.date) ?? []), s]);
    for (const [date, list] of byDay) {
      push({
        kind: 'session',
        targetId: `nudge:${date}`,
        fireAt: quiet(at(date, settings.nudgeTime)),
        title: t('nudge', { titles: list.map((s) => s.title).join(' · ') }),
        body: t('nudgeBody'),
        url: '/start',
        channel: 'reminders',
        priority: 2,
      });
    }
  }

  if (settings.missed) {
    for (const s of planned.filter((x) => x.date < today && x.date >= addDays(today, -2))) {
      push({
        kind: 'session',
        targetId: `missed:${s.id}`,
        fireAt: quiet(at(addDays(s.date, 1), '09:00')),
        title: t('missed', { title: s.title }),
        body: t('missedBody'),
        url: `/session/${s.id}?action=reschedule`,
        channel: 'reminders',
        priority: 2,
      });
    }
  }

  for (let i = 0; i <= horizonDays; i++) {
    const date = addDays(today, i);
    const dow = new Date(at(date, '12:00')).getDay();
    if (settings.weight && settings.weightDays.includes(dow)) {
      push({
        kind: 'weight',
        targetId: `weight:${date}`,
        fireAt: quiet(at(date, settings.weightTime)),
        title: t('weight'),
        body: t('weightBody'),
        url: '/body/weight?log=1',
        channel: 'reminders',
        priority: 3,
      });
    }
    if (settings.measurement && dow === settings.measurementDay) {
      push({
        kind: 'measurement',
        targetId: `measurement:${date}`,
        fireAt: quiet(at(date, settings.measurementTime)),
        title: t('measurement'),
        body: t('measurementBody'),
        url: '/body/measure',
        channel: 'reminders',
        priority: 3,
      });
    }
    if (settings.photo) {
      const anchor = settings.photoAnchor ?? today;
      const diff = Math.round((at(date, '12:00') - at(anchor, '12:00')) / DAY);
      if (diff >= 0 && diff % 14 === 0) {
        push({
          kind: 'photo',
          targetId: `photo:${date}`,
          fireAt: quiet(at(date, settings.photoTime)),
          title: t('photo'),
          body: t('photoBody'),
          url: '/photos/capture',
          channel: 'reminders',
          priority: 3,
        });
      }
    }
    if (settings.weekly && dow === 0) {
      const next = sessions.filter(
        (s) =>
          s.type !== 'rest' &&
          s.status !== 'cancelled' &&
          s.date > date &&
          s.date <= addDays(date, 7),
      ).length;
      push({
        kind: 'weekly_summary',
        targetId: `weekly:${date}`,
        fireAt: quiet(at(date, '19:00')),
        title: t('weekly', { count: next }),
        body: t('weeklyBody'),
        url: '/plan',
        channel: 'summary',
        priority: 3,
      });
    }
  }

  if (settings.backup) {
    // Monthly: 30 days after the last backup (or tomorrow if never), 10:00, out of quiet hours.
    const due = settings.backupLastAt
      ? addDays(localDate(Date.parse(settings.backupLastAt)), 30)
      : addDays(today, 1);
    let day = due < today ? today : due;
    if (day === today && at(day, '10:00') <= now) day = addDays(today, 1); // overdue → next 10:00
    push({
      kind: 'weekly_summary',
      targetId: `backup:${day}`,
      fireAt: quiet(at(day, '10:00')),
      title: t('backup'),
      body: t('backupBody'),
      url: '/settings/backup',
      channel: 'summary',
      priority: 3,
    });
  }

  return out.sort((a, b) => a.priority - b.priority || a.fireAt - b.fireAt).slice(0, MAX_PENDING);
}

export type Existing = {
  osNotificationId: string;
  kind: string;
  targetId: string | null;
  fireAt: string;
};

export const keyOf = (d: { kind: string; targetId: string | null; fireAt: number | string }) =>
  `${d.kind}|${d.targetId ?? ''}|${typeof d.fireAt === 'number' ? new Date(d.fireAt).toISOString() : d.fireAt}`;

/** Idempotent diff: identical (kind, target, time) entries are left alone. */
export function reconcile(desired: readonly Desired[], existing: readonly Existing[]) {
  const want = new Map(desired.map((d) => [keyOf(d), d]));
  const have = new Set(existing.map(keyOf));
  return {
    toSchedule: [...want.entries()].filter(([k]) => !have.has(k)).map(([, d]) => d),
    toCancel: existing.filter((e) => !want.has(keyOf(e))),
  };
}
