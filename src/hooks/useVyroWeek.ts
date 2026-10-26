import { CYCLE_PLAN, routineTemplates } from '@/db/seed/data/routine';

export type VyroCycleItem = { key: string; type: string; minutes: number | null };

/** The default VYRO cycle for previews: Day 1 Push … Day 3 Legs, then Rest. */
export function vyroCycle(): { day: string; items: VyroCycleItem[] }[] {
  const item = (key: string): VyroCycleItem => {
    const tpl = routineTemplates.find((t) => t.key === key);
    return { key, type: tpl?.type ?? 'other', minutes: tpl?.durationMinutes ?? null };
  };
  return [
    ...(['push', 'pull', 'legs'] as const).map((day) => ({
      day,
      items: [item(CYCLE_PLAN[day].run), item(CYCLE_PLAN[day].gym)],
    })),
    { day: 'rest', items: [] },
  ];
}
