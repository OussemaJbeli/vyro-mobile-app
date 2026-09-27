/**
 * Calendar and duration helpers (AD-05).
 * - LocalDate 'YYYY-MM-DD' and LocalTime 'HH:mm' are wall-clock values in the user's timezone.
 * - IsoInstant is a UTC ISO string for real moments (started_at, recorded_at…).
 */
import {
  addDays as addDaysFns,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isValid,
  parse,
  startOfMonth,
  startOfWeek as startOfWeekFns,
} from 'date-fns';

import { now } from './clock';

export type LocalDate = string & { readonly __brand: 'LocalDate' };
export type LocalTime = string & { readonly __brand: 'LocalTime' };
export type IsoInstant = string & { readonly __brand: 'IsoInstant' };

/** 0 = Sunday … 6 = Saturday (date-fns convention). */
export type WeekStart = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function asLocalDate(value: string): LocalDate {
  if (!DATE_RE.test(value) || !isValid(parse(value, 'yyyy-MM-dd', new Date(0)))) {
    throw new Error(`Invalid LocalDate: ${value}`);
  }
  return value as LocalDate;
}

export function asLocalTime(value: string): LocalTime {
  if (!TIME_RE.test(value)) throw new Error(`Invalid LocalTime: ${value}`);
  return value as LocalTime;
}

/** Local-midnight Date for a LocalDate (never parsed as UTC). */
export const toDate = (d: LocalDate): Date => parse(d, 'yyyy-MM-dd', new Date(0));

/** The LocalDate of a Date in the device timezone. */
export const fromDate = (date: Date): LocalDate => format(date, 'yyyy-MM-dd') as LocalDate;

export const today = (): LocalDate => fromDate(now());

export const nowInstant = (): IsoInstant => now().toISOString() as IsoInstant;

/** The local calendar day an instant falls on. */
export const toLocalDate = (instant: IsoInstant | string): LocalDate => fromDate(new Date(instant));

/** LocalDate + LocalTime → the real moment, in the device timezone. */
export function combine(date: LocalDate, time: LocalTime): Date {
  const [h, m] = time.split(':').map(Number) as [number, number];
  const d = toDate(date);
  d.setHours(h, m, 0, 0);
  return d;
}

/** Calendar-day arithmetic (DST-safe: always lands on the same wall-clock day). */
export const addDays = (d: LocalDate, days: number): LocalDate =>
  fromDate(addDaysFns(toDate(d), days));

export const startOfWeek = (d: LocalDate, weekStartsOn: WeekStart = 1): LocalDate =>
  fromDate(startOfWeekFns(toDate(d), { weekStartsOn }));

/** The 7 days of the week containing `d`. */
export function weekDays(d: LocalDate, weekStartsOn: WeekStart = 1): LocalDate[] {
  const start = startOfWeek(d, weekStartsOn);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Month grid as full weeks (leading/trailing days from adjacent months included). */
export function monthGrid(d: LocalDate, weekStartsOn: WeekStart = 1): LocalDate[][] {
  const first = startOfMonth(toDate(d));
  const days = eachDayOfInterval({
    start: startOfWeekFns(first, { weekStartsOn }),
    end: endOfWeek(endOfMonth(first), { weekStartsOn }),
  }).map(fromDate);
  const weeks: LocalDate[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

export const addMonthsLocal = (d: LocalDate, months: number): LocalDate =>
  fromDate(addMonths(toDate(d), months));

/** Lexical comparison works for 'YYYY-MM-DD'. */
export const isPast = (d: LocalDate, ref: LocalDate = today()): boolean => d < ref;
export const isToday = (d: LocalDate, ref: LocalDate = today()): boolean => d === ref;

/** i18n key suffix for the greeting ("home.greeting.evening"). */
export function greetingKey(date: Date = now()): 'morning' | 'afternoon' | 'evening' | 'night' {
  const h = date.getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 18) return 'afternoon';
  if (h >= 18 && h < 23) return 'evening';
  return 'night';
}

/** Durations for summaries: "45 min", "1h 36m", "30 s". */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  if (s < 60) return `${s} s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Timer display: "02:41", "1:02:41". Negative values clamp to zero. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
