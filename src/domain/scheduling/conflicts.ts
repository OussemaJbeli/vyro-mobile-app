/** Schedule conflicts and display status (step 16, FS §37, AD-17). Warnings, never blocks. */
export type SessionLike = {
  id?: string;
  type: 'gym' | 'running' | 'home' | 'abs' | 'recovery' | 'rest' | 'other';
  title: string;
  scheduledDate: string;
  startTime: string | null;
  durationMinutes: number | null;
  status: 'planned' | 'in_progress' | 'completed' | 'modified' | 'skipped' | 'cancelled';
};

export type Conflict =
  | { kind: 'time_overlap'; with: SessionLike }
  | { kind: 'same_type_same_day'; with: SessionLike }
  | { kind: 'rest_day' }
  | { kind: 'heavy_day'; sessions: number; minutes: number };

const HEAVY_SESSIONS = 2;
const HEAVY_MINUTES = 150;
const DEFAULT_MINUTES = 45;

const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const active = (s: SessionLike) => s.status !== 'cancelled' && s.status !== 'skipped';

/** Conflicts of adding/moving `candidate` into a day that already has `sameDay` sessions. */
export function detectConflicts(
  candidate: SessionLike,
  sameDay: readonly SessionLike[],
): Conflict[] {
  const others = sameDay.filter((s) => active(s) && (!candidate.id || s.id !== candidate.id));
  if (candidate.type === 'rest') return [];
  const conflicts: Conflict[] = [];

  if (others.some((s) => s.type === 'rest')) conflicts.push({ kind: 'rest_day' });

  if (candidate.startTime) {
    const a0 = toMin(candidate.startTime);
    const a1 = a0 + (candidate.durationMinutes ?? DEFAULT_MINUTES);
    for (const s of others) {
      if (!s.startTime || s.type === 'rest') continue;
      const b0 = toMin(s.startTime);
      const b1 = b0 + (s.durationMinutes ?? DEFAULT_MINUTES);
      if (a0 < b1 && b0 < a1) conflicts.push({ kind: 'time_overlap', with: s });
    }
  }

  for (const s of others) {
    if (s.type === candidate.type && candidate.type !== 'other') {
      conflicts.push({ kind: 'same_type_same_day', with: s });
    }
  }

  const training = [...others.filter((s) => s.type !== 'rest'), candidate];
  const minutes = training.reduce((m, s) => m + (s.durationMinutes ?? DEFAULT_MINUTES), 0);
  if (training.length > HEAVY_SESSIONS || minutes > HEAVY_MINUTES) {
    conflicts.push({ kind: 'heavy_day', sessions: training.length, minutes });
  }
  return conflicts;
}

export type DisplayStatus = SessionLike['status'] | 'missed' | 'rest';

/**
 * What to show for a session. "Missed" is derived (planned + in the past), never stored.
 * A planned rest day is honoured rest, not a missed workout (FS §22).
 */
export function displayStatus(
  s: Pick<SessionLike, 'type' | 'status' | 'scheduledDate'>,
  today: string,
): DisplayStatus {
  if (s.type === 'rest') return s.status === 'cancelled' ? 'cancelled' : 'rest';
  if (s.status === 'planned' && s.scheduledDate < today) return 'missed';
  return s.status;
}

/** First day after `from` (within `horizon` days) with no active training session. */
export function nextFreeDay(
  from: string,
  sessions: readonly SessionLike[],
  horizon = 14,
): string | null {
  const busy = new Set(
    sessions.filter((s) => active(s) && s.type !== 'rest').map((s) => s.scheduledDate),
  );
  const d0 = Date.UTC(
    Number(from.slice(0, 4)),
    Number(from.slice(5, 7)) - 1,
    Number(from.slice(8, 10)),
    12,
  );
  for (let i = 1; i <= horizon; i++) {
    const d = new Date(d0 + i * 86_400_000).toISOString().slice(0, 10);
    if (!busy.has(d)) return d;
  }
  return null;
}
