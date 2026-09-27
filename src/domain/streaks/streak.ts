/**
 * Streak (step 24, FS §33). A day is:
 * - satisfied: every non-rest planned session is completed/modified, or it is a planned rest
 *   day, or it had an ad-hoc workout;
 * - broken: a planned session was missed or skipped (and nothing satisfied it);
 * - neutral: nothing planned and nothing done — neither counts nor breaks.
 * The current streak walks back from today; while today still has pending sessions it starts
 * from yesterday. Dates are local-date strings (AD-05), so a timezone change cannot split a day.
 */
import { addDaysIso } from '@/domain/scheduling/recurrence';

export type StreakSession = { date: string; type: string; status: string };
export type DayState = 'satisfied' | 'broken' | 'neutral' | 'pending';

const DONE = new Set(['completed', 'modified']);

export function dayState(
  sessions: readonly StreakSession[],
  adhoc: boolean,
  isToday: boolean,
): DayState {
  const active = sessions.filter((s) => s.status !== 'cancelled');
  const training = active.filter((s) => s.type !== 'rest');
  const rest = active.some((s) => s.type === 'rest');
  if (training.length === 0) return rest || adhoc ? 'satisfied' : 'neutral';
  if (training.every((s) => DONE.has(s.status))) return 'satisfied';
  const open = training.some((s) => s.status === 'planned' || s.status === 'in_progress');
  if (isToday && open) return 'pending';
  return adhoc ? 'satisfied' : 'broken';
}

export type StreakInput = {
  sessions: readonly StreakSession[];
  /** Local dates with an ad-hoc (unscheduled) completed workout. */
  adhocDates: readonly string[];
  today: string;
  /** Earliest date to look at (history start). */
  since: string;
};

function states({ sessions, adhocDates, today, since }: StreakInput): Map<string, DayState> {
  const byDay = new Map<string, StreakSession[]>();
  for (const s of sessions) byDay.set(s.date, [...(byDay.get(s.date) ?? []), s]);
  const adhoc = new Set(adhocDates);
  const out = new Map<string, DayState>();
  for (let d = since; d <= today; d = addDaysIso(d, 1)) {
    out.set(d, dayState(byDay.get(d) ?? [], adhoc.has(d), d === today));
  }
  return out;
}

export function streaks(input: StreakInput): { current: number; longest: number } {
  const map = states(input);
  let current = 0;
  for (let d = input.today; d >= input.since; d = addDaysIso(d, -1)) {
    const s = map.get(d);
    if (s === 'broken') break;
    if (s === 'satisfied') current++;
  }
  let longest = 0;
  let run = 0;
  for (const s of map.values()) {
    if (s === 'satisfied') longest = Math.max(longest, ++run);
    else if (s === 'broken') run = 0;
  }
  return { current, longest: Math.max(longest, current) };
}

/** Per-day states for the consistency heatmap. */
export const streakCalendar = (input: StreakInput) => states(input);
