/**
 * Recurrence and materialization (step 16, AD-09). Pure: dates are 'YYYY-MM-DD' local
 * calendar strings; weekdays are ISO (1 = Monday … 7 = Sunday).
 */
export type RuleLike = {
  id: string;
  freq: 'daily' | 'weekly' | 'monthly' | 'custom';
  interval: number;
  byWeekday: number[] | null;
  byMonthDay: number | null;
  startDate: string;
  endDate: string | null;
  active: boolean;
};

const MS_DAY = 86_400_000;

/** Calendar-day arithmetic via UTC noon: immune to DST and the device timezone. */
const toUtc = (d: string) =>
  Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)), 12);
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export const addDaysIso = (d: string, n: number) => fromUtc(toUtc(d) + n * MS_DAY);
export const daysBetween = (a: string, b: string) => Math.round((toUtc(b) - toUtc(a)) / MS_DAY);
/** ISO weekday of a date: 1 = Monday … 7 = Sunday. */
export const isoWeekday = (d: string) => ((new Date(toUtc(d)).getUTCDay() + 6) % 7) + 1;

/** Start of the week containing `d`; `weekStartsOn` 0 = Sunday, 1 = Monday. */
export function weekStart(d: string, weekStartsOn: 0 | 1 = 1): string {
  const js = new Date(toUtc(d)).getUTCDay(); // 0 = Sunday
  const back = (js - weekStartsOn + 7) % 7;
  return addDaysIso(d, -back);
}

const lastDayOfMonth = (y: number, m0: number) => new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();

/**
 * Every occurrence date of `rule` within [from, to] (inclusive), respecting its start
 * and end dates. Weekly/custom intervals are anchored on the week of the start date, so
 * "every 2 weeks" keeps its rhythm regardless of the window.
 */
export function occurrences(
  rule: RuleLike,
  from: string,
  to: string,
  weekStartsOn: 0 | 1 = 1,
): string[] {
  if (!rule.active) return [];
  const start = from > rule.startDate ? from : rule.startDate;
  const end = rule.endDate && rule.endDate < to ? rule.endDate : to;
  if (start > end) return [];
  const interval = Math.max(1, Math.floor(rule.interval));
  const out: string[] = [];

  if (rule.freq === 'daily') {
    // First occurrence on or after `start`, stepping from the rule start.
    const offset = daysBetween(rule.startDate, start);
    let d = addDaysIso(rule.startDate, Math.ceil(offset / interval) * interval);
    for (; d <= end; d = addDaysIso(d, interval)) out.push(d);
    return out;
  }

  if (rule.freq === 'weekly' || rule.freq === 'custom') {
    const days = [
      ...new Set(rule.byWeekday?.length ? rule.byWeekday : [isoWeekday(rule.startDate)]),
    ];
    const anchor = weekStart(rule.startDate, weekStartsOn);
    for (let d = start; d <= end; d = addDaysIso(d, 1)) {
      const weekIndex = Math.floor(daysBetween(anchor, d) / 7);
      if (weekIndex % interval === 0 && days.includes(isoWeekday(d))) out.push(d);
    }
    return out;
  }

  // monthly: on byMonthDay (default: the start date's day), clamped to the month's end.
  const day = rule.byMonthDay ?? Number(rule.startDate.slice(8, 10));
  const sy = Number(rule.startDate.slice(0, 4));
  const sm = Number(rule.startDate.slice(5, 7)) - 1;
  for (let k = 0; ; k += interval) {
    const y = sy + Math.floor((sm + k) / 12);
    const m0 = (sm + k) % 12;
    const d = `${y}-${String(m0 + 1).padStart(2, '0')}-${String(Math.min(day, lastDayOfMonth(y, m0))).padStart(2, '0')}`;
    if (d > end) break;
    if (d >= start) out.push(d);
  }
  return out;
}

/** Days ahead that stay materialized (AD-09). */
export const MATERIALIZE_DAYS = 56;

export type MaterializeInput = RuleLike & { materializedUntil: string | null };

/**
 * Occurrence dates still missing for each rule, from `today` to `until`. `existing` holds
 * "ruleId|originalDate" keys already stored (including moved, skipped or deleted ones, so
 * nothing the user touched is ever recreated).
 */
export function planMaterialization(
  rules: readonly MaterializeInput[],
  existing: ReadonlySet<string>,
  today: string,
  until: string,
  weekStartsOn: 0 | 1 = 1,
): { ruleId: string; date: string }[] {
  return rules.flatMap((rule) =>
    occurrences(rule, today, until, weekStartsOn)
      .filter((date) => !existing.has(`${rule.id}|${date}`))
      .map((date) => ({ ruleId: rule.id, date })),
  );
}

/** How many occurrences fit before `endDate`-less rule ends after N times → its end date. */
export function endDateAfterCount(
  rule: RuleLike,
  count: number,
  weekStartsOn: 0 | 1 = 1,
): string | null {
  if (count < 1) return null;
  const horizon = addDaysIso(rule.startDate, 366 * 5);
  const dates = occurrences({ ...rule, endDate: null }, rule.startDate, horizon, weekStartsOn);
  return dates[count - 1] ?? null;
}
