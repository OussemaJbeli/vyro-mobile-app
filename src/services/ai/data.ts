import { type Database } from '@/db/client';
import { scheduleRepo } from '@/db/repositories/schedule';
import { sessionProgress } from '@/domain/planner/progress';
import { addDaysIso, isoWeekday } from '@/domain/scheduling/recurrence';

import { type CoachData } from './summarizer';

/** Age bracket from a date of birth ("30-39"); the date itself never leaves the device. */
export function ageBracket(dob: string | null, today: string): string | null {
  if (!dob) return null;
  const age =
    Number(today.slice(0, 4)) - Number(dob.slice(0, 4)) - (today.slice(5) < dob.slice(5) ? 1 : 0);
  if (!Number.isFinite(age) || age < 10 || age > 110) return null;
  const lo = Math.floor(age / 10) * 10;
  return `${lo}-${lo + 9}`;
}

/**
 * Reads the local database into CoachData for [start, end] (inclusive days). Only the
 * fields the summarizer may use are selected; names/notes of the user are never read
 * (workout notes only when `includeNotes`).
 */
export async function loadCoachData(
  db: Database,
  {
    start,
    end,
    today,
    includeNotes,
  }: { start: string; end: string; today: string; includeNotes: boolean },
): Promise<CoachData> {
  const profile = await db.get<{
    weight_unit: 'kg' | 'lb';
    distance_unit: 'km' | 'mi';
    speed_unit: 'kmh' | 'mph';
    date_of_birth: string | null;
  }>(
    'SELECT weight_unit, distance_unit, speed_unit, date_of_birth FROM user_profile WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1',
  );
  const goal = await db.get<{
    type: string;
    target_value: number | null;
    unit: string | null;
    start_value: number | null;
    target_date: string | null;
  }>(
    "SELECT type, target_value, unit, start_value, target_date FROM goals WHERE status = 'active' AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1",
  );
  const weights = await db.all<{ day: string; kg: number }>(
    'SELECT substr(recorded_at, 1, 10) AS day, value_kg AS kg FROM weight_entries ' +
      'WHERE deleted_at IS NULL AND substr(recorded_at, 1, 10) BETWEEN ? AND ? ORDER BY recorded_at',
    [start, end],
  );

  const repo = scheduleRepo(db);
  const sessions = await repo.sessionsForRange(start, end);
  const work = await repo.workForRange(start, end);
  const upcoming = await repo.sessionsForRange(today, addDaysIso(today, 7));

  const strength = await db.all<{
    exercise: string;
    sets: number;
    best_weight: number | null;
    best_reps: number | null;
  }>(
    'SELECT e.name AS exercise, COUNT(s.id) AS sets, MAX(s.actual_weight_kg) AS best_weight, MAX(s.actual_reps) AS best_reps ' +
      'FROM exercise_sets s JOIN session_exercises se ON se.id = s.session_exercise_id ' +
      'JOIN session_executions x ON x.id = se.execution_id JOIN exercises e ON e.id = se.exercise_id ' +
      "WHERE s.status = 'done' AND s.deleted_at IS NULL AND x.deleted_at IS NULL " +
      'AND substr(x.started_at, 1, 10) BETWEEN ? AND ? GROUP BY e.id ORDER BY sets DESC LIMIT 20',
    [start, end],
  );
  const runs = await db.all<{
    day: string;
    minutes: number;
    avg_speed: number | null;
    max_speed: number | null;
    done: number;
    total: number;
  }>(
    'SELECT substr(x.started_at, 1, 10) AS day, COALESCE(x.active_seconds, 0) / 60.0 AS minutes, ' +
      'AVG(l.actual_speed_kmh) AS avg_speed, MAX(l.actual_speed_kmh) AS max_speed, ' +
      "SUM(CASE WHEN l.status IN ('done','partial') THEN 1 ELSE 0 END) AS done, COUNT(l.id) AS total " +
      'FROM session_executions x JOIN running_interval_logs l ON l.execution_id = x.id ' +
      "WHERE x.type = 'running' AND x.status <> 'in_progress' AND x.deleted_at IS NULL AND l.is_repeat = 0 " +
      'AND substr(x.started_at, 1, 10) BETWEEN ? AND ? GROUP BY x.id ORDER BY x.started_at',
    [start, end],
  );
  const subs = await db.all<{ from_name: string; to_name: string; n: number }>(
    'SELECT pe.name AS from_name, e.name AS to_name, COUNT(*) AS n FROM session_exercises se ' +
      'JOIN exercises e ON e.id = se.exercise_id JOIN exercises pe ON pe.id = se.planned_exercise_id ' +
      'JOIN session_executions x ON x.id = se.execution_id ' +
      'WHERE se.planned_exercise_id IS NOT NULL AND se.planned_exercise_id <> se.exercise_id AND se.deleted_at IS NULL ' +
      'AND substr(x.started_at, 1, 10) BETWEEN ? AND ? GROUP BY pe.id, e.id ORDER BY n DESC LIMIT 5',
    [start, end],
  );
  const notes = includeNotes
    ? (
        await db.all<{ notes: string }>(
          'SELECT se.notes AS notes FROM session_exercises se JOIN session_executions x ON x.id = se.execution_id ' +
            "WHERE se.notes IS NOT NULL AND se.notes <> '' AND se.deleted_at IS NULL " +
            'AND substr(x.started_at, 1, 10) BETWEEN ? AND ? LIMIT 10',
          [start, end],
        )
      ).map((r) => r.notes.slice(0, 200))
    : [];

  return {
    period: { start, end },
    units: {
      weight: profile?.weight_unit ?? 'kg',
      distance: profile?.distance_unit ?? 'km',
      speed: profile?.speed_unit ?? 'kmh',
    },
    ageBracket: ageBracket(profile?.date_of_birth ?? null, today),
    goal: goal
      ? {
          type: goal.type,
          target: goal.target_value,
          unit: goal.unit,
          start: goal.start_value,
          targetDate: goal.target_date,
        }
      : null,
    weights: weights.map((w) => ({ date: w.day, kg: w.kg })),
    sessions: sessions.map((s) => ({
      date: s.scheduledDate,
      weekday: isoWeekday(s.scheduledDate),
      type: s.type,
      status: s.status,
      progress: sessionProgress(s, work[s.id]),
    })),
    strength: strength.map((s) => ({
      exercise: s.exercise,
      sets: s.sets,
      bestWeightKg: s.best_weight,
      bestReps: s.best_reps,
    })),
    runs: runs.map((r) => ({
      date: r.day,
      minutes: r.minutes,
      avgSpeedKmh: r.avg_speed,
      maxSpeedKmh: r.max_speed,
      completion: r.total ? r.done / r.total : 0,
    })),
    substitutions: subs.map((s) => ({ from: s.from_name, to: s.to_name, count: s.n })),
    upcoming: upcoming
      .filter((s) => s.status === 'planned' && s.type !== 'rest')
      .map((s) => ({ id: s.id, date: s.scheduledDate, startTime: s.startTime, type: s.type })),
    notes,
  };
}
