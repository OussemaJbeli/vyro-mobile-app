import { type ScheduledSession } from '@/types/domain';

export type StartSession = Pick<
  ScheduledSession,
  'id' | 'type' | 'status' | 'startTime' | 'orderInDay' | 'title' | 'templateId'
>;

export type ActiveLike = { executionId: string; title: string } | null;

export type StartState = {
  fab: 'start' | 'continue' | 'done' | 'rest' | 'empty';
  primary:
    | { kind: 'resume'; executionId: string; label: string }
    | { kind: 'begin'; sessionId: string; label: string }
    | null;
  /** Today's training activities (rest and cancelled excluded), in order. */
  activities: StartSession[];
  done: number;
};

const PENDING = new Set(['planned', 'in_progress']);
const DONE = new Set(['completed', 'modified']);

/** Today's order: `order_in_day`, then start time (untimed last), then title. */
export function orderToday<S extends StartSession>(sessions: readonly S[]): S[] {
  return [...sessions].sort(
    (a, b) =>
      a.orderInDay - b.orderInDay ||
      (a.startTime ?? '99:99').localeCompare(b.startTime ?? '99:99') ||
      a.title.localeCompare(b.title),
  );
}

export const isPendingSession = (s: Pick<StartSession, 'status'>) => PENDING.has(s.status);
export const isDoneSession = (s: Pick<StartSession, 'status'>) => DONE.has(s.status);

/**
 * The Start FAB and screen state (UI §10–11), by priority: an active workout →
 * continue; pending training today → start the next; all handled with ≥ 1 done → done;
 * only rest → rest; otherwise empty.
 */
export function resolveStartState(
  todaySessions: readonly StartSession[],
  active: ActiveLike,
): StartState {
  const activities = orderToday(
    todaySessions.filter((s) => s.type !== 'rest' && s.status !== 'cancelled'),
  );
  const done = activities.filter(isDoneSession).length;
  const base = { activities, done };
  if (active) {
    return {
      ...base,
      fab: 'continue',
      primary: { kind: 'resume', executionId: active.executionId, label: active.title },
    };
  }
  const next = activities.find(isPendingSession);
  if (next)
    return {
      ...base,
      fab: 'start',
      primary: { kind: 'begin', sessionId: next.id, label: next.title },
    };
  if (activities.length && done > 0) return { ...base, fab: 'done', primary: null };
  if (todaySessions.some((s) => s.type === 'rest' && s.status !== 'cancelled')) {
    return { ...base, fab: 'rest', primary: null };
  }
  return { ...base, fab: 'empty', primary: null };
}
