import { routineTemplates, routineWeek } from '@/db/seed/data/routine';

export type VyroWeekItem = { key: string; type: string; time: string | null };

/** The default VYRO week (docs/plan/weak.md) per ISO weekday, ordered by time. */
export function vyroWeek(): Record<number, VyroWeekItem[]> {
  const out: Record<number, VyroWeekItem[]> = {};
  for (const rule of routineWeek) {
    for (const day of rule.days) {
      const tpl = rule.key ? routineTemplates.find((t) => t.key === rule.key) : undefined;
      (out[day] ??= []).push({
        key: rule.key ?? 'rest',
        type: tpl?.type ?? 'rest',
        time: rule.time,
      });
    }
  }
  for (const list of Object.values(out)) {
    list.sort((a, b) => (a.time ?? '99').localeCompare(b.time ?? '99'));
  }
  return out;
}
