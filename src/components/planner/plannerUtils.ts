import { type IconName } from '@/components/ui';
import { displayStatus } from '@/domain/scheduling/conflicts';
import { currentLanguage } from '@/i18n';
import { type ScheduledSession } from '@/types/domain';
import { asLocalDate, toDate } from '@/utils/dates';

export const SESSION_ICON: Record<ScheduledSession['type'], IconName> = {
  gym: 'gym',
  running: 'running',
  home: 'home_workout',
  abs: 'abs',
  recovery: 'recovery',
  rest: 'rest',
  other: 'other',
};

/** Locale-aware date text for a 'YYYY-MM-DD' local date. */
export const formatDay = (date: string, opts: Intl.DateTimeFormatOptions) =>
  toDate(asLocalDate(date)).toLocaleDateString(currentLanguage(), opts);

export type DayMarkers = { planned: number; done: number; rest: boolean; missed: number };

/** Per-day markers for the week strip and month grid (icons, not colour alone). */
export function markersByDay(
  sessions: readonly ScheduledSession[],
  today: string,
): Map<string, DayMarkers> {
  const out = new Map<string, DayMarkers>();
  for (const s of sessions) {
    const m = out.get(s.scheduledDate) ?? { planned: 0, done: 0, rest: false, missed: 0 };
    const status = displayStatus(s, today);
    if (status === 'rest') m.rest = true;
    else if (status === 'completed' || status === 'modified') m.done += 1;
    else if (status === 'missed') m.missed += 1;
    else if (status === 'planned' || status === 'in_progress') m.planned += 1;
    out.set(s.scheduledDate, m);
  }
  return out;
}
