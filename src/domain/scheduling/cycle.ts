/**
 * Completion-based training cycle: the user's day groups in order (e.g. Push, Pull, Legs),
 * then a rest day, repeating. A training day only moves the cycle forward once it is
 * completed; a missed day comes back the next day. A rest day always passes.
 * Pure: dates are 'YYYY-MM-DD' local calendar strings.
 */
import { addDaysIso } from './recurrence';

export const REST = 'rest';

/** One day group: a run and/or a gym workout, done together (run first). */
export type CycleGroup = {
  id: string;
  name: string;
  runTemplateId: string | null;
  gymTemplateId: string | null;
};

export type CyclePlan = { groups: CycleGroup[] };

/** Day ids in cycle order: every group, then the rest day. */
export const cycleOrder = (plan: CyclePlan): string[] => [...plan.groups.map((g) => g.id), REST];

/** Where the cycle stands: on `date`, the day to do is `order[index]`. */
export type CycleState = { date: string; index: number };

const norm = (i: number, n: number) => ((i % n) + n) % n;

/**
 * Walks from `state.date` up to (not including) `today`: each past day advances the cycle
 * only if it was the rest day or its workout was completed.
 */
export function advanceCycle(
  state: CycleState,
  today: string,
  order: readonly string[],
  completed: (date: string, dayId: string) => boolean,
): CycleState {
  let index = norm(state.index, order.length);
  for (let d = state.date; d < today; d = addDaysIso(d, 1)) {
    const day = order[index]!;
    if (day === REST || completed(d, day)) index = norm(index + 1, order.length);
  }
  return { date: today > state.date ? today : state.date, index };
}

/** The days ahead from `state.date`, assuming each one gets done (what Plan shows). */
export function projectCycle(
  state: CycleState,
  order: readonly string[],
  days: number,
): { date: string; dayId: string }[] {
  return Array.from({ length: days }, (_, i) => ({
    date: addDaysIso(state.date, i),
    dayId: order[norm(state.index + i, order.length)]!,
  }));
}

/** First start: Day 1 on the day the app is set up. */
export const initialCycle = (today: string): CycleState => ({ date: today, index: 0 });

/**
 * After the order changes, keep pointing at the same day group (so reordering never jumps
 * you to another workout today); unknown ids fall back to Day 1.
 */
export function remapState(
  state: CycleState,
  before: readonly string[],
  after: readonly string[],
): CycleState {
  const current = before[norm(state.index, before.length)];
  const index = current ? after.indexOf(current) : -1;
  return { date: state.date, index: index >= 0 ? index : 0 };
}
