import {
  type ExerciseSet,
  type IntervalLog,
  type PlannedSnapshot,
  type RuntimeState,
  type SessionExecution,
  type SessionExercise,
} from '@/types/domain';
import { type DbChange, type ExecSet, type LastPerformance } from '@/domain/execution';
import { type EXECUTION_OUTCOMES, type SessionType } from '@/types/enums';
import { AppError } from '@/utils/errors';

import { type Database, type Db } from '../client';
import { type SqlValue } from '../driver';
import { tables } from '../mappers';

import {
  findMany,
  getOrThrow,
  insertModel,
  nowIso,
  pageByTime,
  patchModel,
  type Page,
} from './base';

const exec = tables.sessionExecutions;
type Outcome = (typeof EXECUTION_OUTCOMES)[number];

export type StartExecutionInput = {
  scheduledSessionId: string | null;
  templateId: string | null;
  type: SessionType;
  title: string;
  snapshot: PlannedSnapshot;
  startedAt?: string;
  isRetroactive?: boolean;
};

export type ExecutionDetail = SessionExecution & {
  exercises: (SessionExercise & { sets: ExerciseSet[] })[];
  intervals: IntervalLog[];
};

export type SetActuals = Partial<
  Pick<ExerciseSet, 'actualReps' | 'actualWeightKg' | 'actualDurationSeconds' | 'restTakenSeconds'>
> & { status?: ExerciseSet['status'] };

export type IntervalActuals = Partial<
  Pick<
    IntervalLog,
    | 'actualDurationSeconds'
    | 'actualSpeedKmh'
    | 'actualInclinePercent'
    | 'status'
    | 'startedAt'
    | 'endedAt'
  >
>;

export type CompleteInput = {
  outcome: Outcome;
  endedAt?: string;
  activeSeconds: number;
  pausedSeconds: number;
  perceivedEffort?: number | null;
  distanceKm?: number | null;
  notes?: string | null;
};

export type HistoryFilter = { types?: SessionType[] };

export type DoneSetRow = {
  exerciseId: string;
  executionId: string;
  startedAt: string;
  reps: number | null;
  weightKg: number | null;
  durationSeconds: number | null;
  primaryMuscle: string;
  secondaryMuscles: string[];
};

const iso = (ms: number | null) => (ms === null ? null : new Date(ms).toISOString());

async function insertSetIn(db: Db, sessionExerciseId: string, s: ExecSet) {
  await insertModel(
    db,
    tables.exerciseSets,
    {
      sessionExerciseId,
      setIndex: s.index,
      plannedReps: s.plannedReps,
      plannedWeightKg: s.plannedWeightKg,
      plannedDurationSeconds: s.plannedDurationSeconds,
      actualReps: s.actualReps,
      actualWeightKg: s.actualWeightKg,
      actualDurationSeconds: s.actualDurationSeconds,
      restTakenSeconds: s.restTakenSeconds,
      status: s.status,
      isExtra: s.isExtra,
      completedAt: iso(s.completedAt),
    },
    { id: s.id },
  );
}

async function completeIn(db: Db, id: string, input: CompleteInput) {
  const x = await getOrThrow(db, exec, id);
  await patchModel(db, exec, id, {
    status: 'completed',
    outcome: input.outcome,
    endedAt: input.endedAt ?? nowIso(),
    activeSeconds: input.activeSeconds,
    pausedSeconds: input.pausedSeconds,
    // Only overwrite review fields that were provided: notes typed during the workout stay.
    ...(input.perceivedEffort !== undefined ? { perceivedEffort: input.perceivedEffort } : {}),
    ...(input.distanceKm !== undefined ? { distanceKm: input.distanceKm } : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
    runtimeState: null,
  });
  if (x.scheduledSessionId) {
    await patchModel(db, tables.scheduledSessions, x.scheduledSessionId, {
      status: input.outcome === 'as_planned' ? 'completed' : 'modified',
    });
  }
}

async function abandonIn(db: Db, id: string, endedAt = nowIso()) {
  const x = await getOrThrow(db, exec, id);
  await patchModel(db, exec, id, { status: 'abandoned', endedAt, runtimeState: null });
  if (x.scheduledSessionId) {
    await patchModel(db, tables.scheduledSessions, x.scheduledSessionId, { status: 'planned' });
  }
}

/**
 * Execution storage (step 10). The pure execution engine (step 17) drives these writes.
 * Planned values come from the snapshot and are never modified afterwards (AD-07).
 */
export function executionRepo(db: Database) {
  const getActive = async (): Promise<SessionExecution | null> =>
    (await findMany(db, exec, "status = 'in_progress' AND deleted_at IS NULL", [], 'LIMIT 1'))[0] ??
    null;

  const get = async (id: string): Promise<ExecutionDetail> => {
    const x = await getOrThrow(db, exec, id);
    const exercises = await findMany(
      db,
      tables.sessionExercises,
      'execution_id = ? AND deleted_at IS NULL',
      [id],
      'ORDER BY order_index',
    );
    const sets = exercises.length
      ? await findMany(
          db,
          tables.exerciseSets,
          'session_exercise_id IN (' +
            exercises.map(() => '?').join(', ') +
            ') AND deleted_at IS NULL',
          exercises.map((e) => e.id),
          'ORDER BY set_index',
        )
      : [];
    const intervals = await findMany(
      db,
      tables.intervalLogs,
      'execution_id = ? AND deleted_at IS NULL',
      [id],
      'ORDER BY order_index',
    );
    return {
      ...x,
      exercises: exercises.map((e) => ({
        ...e,
        sets: sets.filter((s) => s.sessionExerciseId === e.id),
      })),
      intervals,
    };
  };

  return {
    getActive,
    get,

    /**
     * Starts an execution from a frozen plan. Enforces invariant 1 (one active execution)
     * and invariant 2 (rest sessions are never executed). Creates pending actual rows.
     */
    start: (input: StartExecutionInput) =>
      db.tx(async (tx) => {
        const active = await tx.get<{ id: string }>(
          "SELECT id FROM session_executions WHERE status = 'in_progress' AND deleted_at IS NULL LIMIT 1",
        );
        if (active && !input.isRetroactive) {
          throw new AppError('VALIDATION', 'Another workout is already in progress', {
            userMessageKey: 'errors:EXECUTION_ACTIVE',
            context: { activeId: active.id },
          });
        }
        if (input.type === 'rest') {
          throw new AppError('VALIDATION', 'Rest sessions cannot be executed');
        }
        const startedAt = input.startedAt ?? nowIso();
        const x = await insertModel(tx, exec, {
          scheduledSessionId: input.scheduledSessionId,
          templateId: input.templateId,
          type: input.type,
          title: input.title,
          status: 'in_progress',
          outcome: null,
          startedAt,
          endedAt: null,
          activeSeconds: null,
          pausedSeconds: null,
          plannedSnapshot: input.snapshot,
          runtimeState: null,
          isRetroactive: input.isRetroactive ?? false,
          perceivedEffort: null,
          distanceKm: null,
          notes: null,
        });
        for (const e of input.snapshot.exercises) {
          const se = await insertModel(tx, tables.sessionExercises, {
            executionId: x.id,
            exerciseId: e.exerciseId,
            plannedExerciseId: e.exerciseId,
            orderIndex: e.orderIndex,
            plannedSets: e.sets,
            plannedReps: e.targetReps,
            plannedDurationSeconds: e.targetDurationSeconds,
            plannedWeightKg: e.targetWeightKg,
            plannedRestSeconds: e.restSeconds,
            status: 'pending',
            substitutionReason: null,
            notes: null,
          });
          for (let i = 0; i < e.sets; i++) {
            await insertModel(tx, tables.exerciseSets, {
              sessionExerciseId: se.id,
              setIndex: i,
              plannedReps: e.targetReps,
              plannedWeightKg: e.targetWeightKg,
              plannedDurationSeconds: e.targetDurationSeconds,
              actualReps: null,
              actualWeightKg: null,
              actualDurationSeconds: null,
              restTakenSeconds: null,
              status: 'pending',
              isExtra: false,
              completedAt: null,
            });
          }
        }
        for (const iv of input.snapshot.intervals) {
          await insertModel(tx, tables.intervalLogs, {
            executionId: x.id,
            orderIndex: iv.orderIndex,
            kind: iv.kind,
            label: iv.label,
            plannedDurationSeconds: iv.durationSeconds,
            plannedSpeedKmh: iv.speedKmh,
            plannedInclinePercent: iv.inclinePercent,
            actualDurationSeconds: null,
            actualSpeedKmh: null,
            actualInclinePercent: null,
            status: 'pending',
            isRepeat: false,
            startedAt: null,
            endedAt: null,
          });
        }
        if (input.scheduledSessionId && !input.isRetroactive) {
          await patchModel(tx, tables.scheduledSessions, input.scheduledSessionId, {
            status: 'in_progress',
          });
        }
        return x;
      }),

    saveRuntimeState: (id: string, state: RuntimeState) =>
      patchModel(db, exec, id, { runtimeState: state }),

    logSet: (setId: string, actuals: SetActuals) =>
      patchModel(db, tables.exerciseSets, setId, {
        ...actuals,
        status: actuals.status ?? 'done',
        completedAt: nowIso(),
      }),

    /** Extra set beyond the plan (is_extra = 1, no planned values). */
    async addSet(sessionExerciseId: string): Promise<ExerciseSet> {
      const last = await db.get<{ n: number | null }>(
        'SELECT MAX(set_index) AS n FROM exercise_sets WHERE session_exercise_id = ?',
        [sessionExerciseId],
      );
      return insertModel(db, tables.exerciseSets, {
        sessionExerciseId,
        setIndex: (last?.n ?? -1) + 1,
        plannedReps: null,
        plannedWeightKg: null,
        plannedDurationSeconds: null,
        actualReps: null,
        actualWeightKg: null,
        actualDurationSeconds: null,
        restTakenSeconds: null,
        status: 'pending',
        isExtra: true,
        completedAt: null,
      });
    },

    setExerciseStatus: (sessionExerciseId: string, status: SessionExercise['status']) =>
      patchModel(db, tables.sessionExercises, sessionExerciseId, { status }),

    /** Swaps the performed exercise; planned_exercise_id keeps the original (FS §14). */
    substitute: (sessionExerciseId: string, exerciseId: string, reason: string | null) =>
      patchModel(db, tables.sessionExercises, sessionExerciseId, {
        exerciseId,
        substitutionReason: reason,
      }),

    logInterval: (logId: string, actuals: IntervalActuals) =>
      patchModel(db, tables.intervalLogs, logId, actuals),

    /** Invariant 3: completion updates the scheduled session to completed or modified. */
    complete: (id: string, input: CompleteInput) => db.tx((tx) => completeIn(tx, id, input)),

    /** Keeps everything logged; the scheduled session goes back to planned for a retry. */
    abandon: (id: string) => db.tx((tx) => abandonIn(tx, id)),

    /**
     * Write-ahead persistence for the execution engine (step 17): the row changes of one
     * transition and the new runtime state commit together, or not at all.
     */
    applyTransition: (id: string, changes: DbChange[], runtime: RuntimeState) =>
      db.tx(async (tx) => {
        let closed = false;
        for (const c of changes) {
          switch (c.kind) {
            case 'set': {
              const { completedAt, ...rest } = c.patch;
              await patchModel(tx, tables.exerciseSets, c.id, {
                ...rest,
                ...(completedAt !== undefined ? { completedAt: iso(completedAt) } : {}),
              });
              break;
            }
            case 'insertSet':
              await insertSetIn(tx, c.exerciseRowId, c.set);
              break;
            case 'exercise':
              await patchModel(tx, tables.sessionExercises, c.id, c.patch);
              break;
            case 'insertExercise': {
              const e = c.exercise;
              const first = e.sets[0];
              await insertModel(
                tx,
                tables.sessionExercises,
                {
                  executionId: id,
                  exerciseId: e.exerciseId,
                  plannedExerciseId: e.plannedExerciseId,
                  orderIndex: c.orderIndex,
                  plannedSets: e.sets.length || null,
                  plannedReps: first?.plannedReps ?? null,
                  plannedDurationSeconds: first?.plannedDurationSeconds ?? null,
                  plannedWeightKg: first?.plannedWeightKg ?? null,
                  plannedRestSeconds: e.restSeconds,
                  status: e.status,
                  substitutionReason: null,
                  notes: null,
                },
                { id: e.id },
              );
              for (const s of e.sets) await insertSetIn(tx, e.id, s);
              break;
            }
            case 'reorderExercises':
              for (const [i, rowId] of c.ids.entries()) {
                await patchModel(tx, tables.sessionExercises, rowId, { orderIndex: i });
              }
              break;
            case 'interval': {
              const { startedAt, endedAt, ...rest } = c.patch;
              await patchModel(tx, tables.intervalLogs, c.id, {
                ...rest,
                ...(startedAt !== undefined ? { startedAt: iso(startedAt) } : {}),
                ...(endedAt !== undefined ? { endedAt: iso(endedAt) } : {}),
              });
              break;
            }
            case 'insertInterval': {
              const iv = c.interval;
              await insertModel(
                tx,
                tables.intervalLogs,
                {
                  executionId: id,
                  orderIndex: c.orderIndex,
                  kind: iv.kind,
                  label: iv.label,
                  plannedDurationSeconds: iv.plannedDurationSeconds,
                  plannedSpeedKmh: iv.plannedSpeedKmh,
                  plannedInclinePercent: iv.plannedInclinePercent,
                  actualDurationSeconds: iv.actualDurationSeconds,
                  actualSpeedKmh: iv.actualSpeedKmh,
                  actualInclinePercent: iv.actualInclinePercent,
                  status: iv.status,
                  isRepeat: iv.isRepeat,
                  startedAt: iso(iv.startedAt),
                  endedAt: iso(iv.endedAt),
                },
                { id: iv.id },
              );
              break;
            }
            case 'reorderIntervals':
              for (const [i, rowId] of c.ids.entries()) {
                await patchModel(tx, tables.intervalLogs, rowId, { orderIndex: i });
              }
              break;
            case 'complete':
              closed = true;
              await completeIn(tx, id, {
                outcome: c.outcome,
                endedAt: new Date(c.endedAt).toISOString(),
                activeSeconds: c.activeSeconds,
                pausedSeconds: c.pausedSeconds,
                ...(c.distanceKm !== null ? { distanceKm: c.distanceKm } : {}),
              });
              break;
            case 'abandon':
              closed = true;
              await abandonIn(tx, id, new Date(c.endedAt).toISOString());
              break;
          }
        }
        if (!closed) await patchModel(tx, exec, id, { runtimeState: runtime });
      }),

    /**
     * "Last time" per exercise: the top set (heaviest, then most reps) of the most recent
     * completed execution that logged it. One query per workout start.
     */
    async lastPerformance(
      exerciseIds: string[],
      excludeExecutionId: string | null = null,
    ): Promise<Record<string, LastPerformance>> {
      if (!exerciseIds.length) return {};
      const rows = await db.all<{
        exerciseId: string;
        executionId: string;
        reps: number | null;
        weightKg: number | null;
        durationSeconds: number | null;
      }>(
        'SELECT se.exercise_id AS exerciseId, x.id AS executionId, s.actual_reps AS reps, ' +
          's.actual_weight_kg AS weightKg, s.actual_duration_seconds AS durationSeconds ' +
          'FROM exercise_sets s ' +
          'JOIN session_exercises se ON se.id = s.session_exercise_id ' +
          'JOIN session_executions x ON x.id = se.execution_id ' +
          "WHERE s.status = 'done' AND x.status = 'completed' AND x.id <> ? " +
          // Only sessions since the current program was applied: its starting weights
          // apply first, then whatever you actually lift.
          "AND x.started_at >= COALESCE((SELECT json_extract(value, '$') FROM app_settings WHERE key = 'routine_applied_at'), '') " +
          'AND s.deleted_at IS NULL AND se.deleted_at IS NULL AND x.deleted_at IS NULL ' +
          'AND se.exercise_id IN (' +
          exerciseIds.map(() => '?').join(', ') +
          ') ORDER BY x.started_at DESC',
        [excludeExecutionId ?? '', ...exerciseIds],
      );
      const out: Record<string, LastPerformance> = {};
      const fromExecution: Record<string, string> = {};
      for (const r of rows) {
        const seen = fromExecution[r.exerciseId];
        if (seen && seen !== r.executionId) continue;
        fromExecution[r.exerciseId] = r.executionId;
        const best = out[r.exerciseId];
        const better =
          !best ||
          (r.weightKg ?? 0) > (best.weightKg ?? 0) ||
          ((r.weightKg ?? 0) === (best.weightKg ?? 0) &&
            ((r.reps ?? 0) > (best.reps ?? 0) ||
              (r.durationSeconds ?? 0) > (best.durationSeconds ?? 0)));
        if (better) {
          out[r.exerciseId] = {
            reps: r.reps,
            weightKg: r.weightKg,
            durationSeconds: r.durationSeconds,
          };
        }
      }
      return out;
    },

    /**
     * "Discard workout": with nothing logged the execution disappears (soft delete);
     * otherwise it is abandoned and every logged set is kept.
     */
    discard: (id: string) =>
      db.tx(async (tx): Promise<'deleted' | 'abandoned'> => {
        const logged = await tx.get<{ n: number }>(
          'SELECT COUNT(*) AS n FROM exercise_sets s ' +
            'JOIN session_exercises se ON se.id = s.session_exercise_id ' +
            "WHERE se.execution_id = ? AND s.status = 'done' AND s.deleted_at IS NULL",
          [id],
        );
        const intervals = await tx.get<{ n: number }>(
          'SELECT COUNT(*) AS n FROM running_interval_logs ' +
            "WHERE execution_id = ? AND status IN ('done', 'partial') AND deleted_at IS NULL",
          [id],
        );
        if ((logged?.n ?? 0) + (intervals?.n ?? 0) > 0) {
          await abandonIn(tx, id);
          return 'abandoned';
        }
        const x = await getOrThrow(tx, exec, id);
        const at = nowIso();
        await tx.run(
          'UPDATE exercise_sets SET deleted_at = ?, updated_at = ? WHERE session_exercise_id IN ' +
            '(SELECT id FROM session_exercises WHERE execution_id = ?)',
          [at, at, id],
        );
        await tx.run(
          'UPDATE session_exercises SET deleted_at = ?, updated_at = ? WHERE execution_id = ?',
          [at, at, id],
        );
        await tx.run(
          'UPDATE running_interval_logs SET deleted_at = ?, updated_at = ? WHERE execution_id = ?',
          [at, at, id],
        );
        await patchModel(tx, exec, id, {
          status: 'abandoned',
          endedAt: at,
          runtimeState: null,
          deletedAt: at,
        });
        if (x.scheduledSessionId) {
          await patchModel(tx, tables.scheduledSessions, x.scheduledSessionId, {
            status: 'planned',
          });
        }
        return 'deleted';
      }),

    /** Completion screen: optional perceived effort and notes (never required). */
    saveReview: (
      id: string,
      review: { perceivedEffort: number | null; notes: string | null; distanceKm?: number | null },
    ) => patchModel(db, exec, id, review),

    setNotes: (id: string, notes: string | null) => patchModel(db, exec, id, { notes }),

    setExerciseNote: (sessionExerciseId: string, notes: string | null) =>
      patchModel(db, tables.sessionExercises, sessionExerciseId, { notes }),

    /**
     * Retroactive log (step 21): creates the execution (is_retroactive = 1, chosen start),
     * then commits the replayed changes. Returns the execution id.
     */
    async logRetroactive(
      input: StartExecutionInput,
      replay: (rows: ExecutionDetail) => { changes: DbChange[]; runtime: RuntimeState },
    ): Promise<string> {
      const x = await this.start({ ...input, isRetroactive: true });
      try {
        const { changes, runtime } = replay(await get(x.id));
        await this.applyTransition(x.id, changes, runtime);
      } catch (error) {
        // Never leave a half-logged execution behind.
        await db.run('UPDATE session_executions SET deleted_at = ? WHERE id = ?', [nowIso(), x.id]);
        throw error;
      }
      return x.id;
    },

    /** Quick start → "Link to today's planned Gym?": attaches and updates the session (invariant 3). */
    linkToSession: (id: string, sessionId: string) =>
      db.tx(async (tx) => {
        const x = await getOrThrow(tx, exec, id);
        await patchModel(tx, exec, id, { scheduledSessionId: sessionId });
        await patchModel(tx, tables.scheduledSessions, sessionId, {
          status: x.outcome === 'as_planned' ? 'completed' : 'modified',
        });
      }),

    /**
     * Logged sets of completed executions (analytics, records, exercise stats), oldest first.
     * Optional filters: a start range, one exercise.
     */
    async doneSets(
      filter: { fromIso?: string; toIso?: string; exerciseId?: string } = {},
    ): Promise<DoneSetRow[]> {
      const where = [
        "s.status = 'done'",
        "x.status = 'completed'",
        's.deleted_at IS NULL',
        'se.deleted_at IS NULL',
        'x.deleted_at IS NULL',
      ];
      const params: SqlValue[] = [];
      if (filter.fromIso) {
        where.push('x.started_at >= ?');
        params.push(filter.fromIso);
      }
      if (filter.toIso) {
        where.push('x.started_at < ?');
        params.push(filter.toIso);
      }
      if (filter.exerciseId) {
        where.push('se.exercise_id = ?');
        params.push(filter.exerciseId);
      }
      const rows = await db.all<
        Omit<DoneSetRow, 'secondaryMuscles'> & { secondaryMuscles: string | null }
      >(
        'SELECT se.exercise_id AS exerciseId, x.id AS executionId, x.started_at AS startedAt, ' +
          's.actual_reps AS reps, s.actual_weight_kg AS weightKg, s.actual_duration_seconds AS durationSeconds, ' +
          'e.primary_muscle AS primaryMuscle, e.secondary_muscles AS secondaryMuscles ' +
          'FROM exercise_sets s JOIN session_exercises se ON se.id = s.session_exercise_id ' +
          'JOIN session_executions x ON x.id = se.execution_id LEFT JOIN exercises e ON e.id = se.exercise_id ' +
          'WHERE ' +
          where.join(' AND ') +
          ' ORDER BY x.started_at',
        params,
      );
      return rows.map((r) => ({
        ...r,
        primaryMuscle: r.primaryMuscle ?? 'other',
        secondaryMuscles: r.secondaryMuscles ? (JSON.parse(r.secondaryMuscles) as string[]) : [],
      }));
    },

    /** Times completed and last performed date for a template (template detail). */
    async templateStats(templateId: string): Promise<{ count: number; last: string | null }> {
      const r = await db.get<{ n: number; last: string | null }>(
        "SELECT COUNT(*) AS n, MAX(started_at) AS last FROM session_executions WHERE template_id = ? AND status = 'completed' AND deleted_at IS NULL",
        [templateId],
      );
      return { count: r?.n ?? 0, last: r?.last ?? null };
    },

    /** History: finished executions (completed or abandoned) started in [fromIso, toIso). */
    finishedBetween: (fromIso: string, toIso: string): Promise<SessionExecution[]> =>
      findMany(
        db,
        exec,
        "status <> 'in_progress' AND deleted_at IS NULL AND started_at >= ? AND started_at < ?",
        [fromIso, toIso],
        'ORDER BY started_at DESC',
      ),

    /** History correction: new actuals, the original completed_at is kept. */
    correctSet: (
      setId: string,
      actuals: Pick<SetActuals, 'actualReps' | 'actualWeightKg' | 'actualDurationSeconds'>,
    ) => patchModel(db, tables.exerciseSets, setId, actuals),

    /** After a correction: the recomputed outcome and the scheduled session status (invariant 3). */
    setOutcome: (id: string, outcome: Outcome) =>
      db.tx(async (tx) => {
        const x = await getOrThrow(tx, exec, id);
        await patchModel(tx, exec, id, { outcome });
        if (x.scheduledSessionId && x.status === 'completed') {
          await patchModel(tx, tables.scheduledSessions, x.scheduledSessionId, {
            status: outcome === 'as_planned' ? 'completed' : 'modified',
          });
        }
      }),

    /** Hard delete (double-confirmed in the UI). The scheduled session goes back to planned. */
    deleteExecution: (id: string) =>
      db.tx(async (tx) => {
        const x = await getOrThrow(tx, exec, id);
        await tx.run(
          'DELETE FROM exercise_sets WHERE session_exercise_id IN (SELECT id FROM session_exercises WHERE execution_id = ?)',
          [id],
        );
        await tx.run('DELETE FROM session_exercises WHERE execution_id = ?', [id]);
        await tx.run('DELETE FROM running_interval_logs WHERE execution_id = ?', [id]);
        await tx.run('DELETE FROM session_executions WHERE id = ?', [id]);
        if (x.scheduledSessionId) {
          await patchModel(tx, tables.scheduledSessions, x.scheduledSessionId, {
            status: 'planned',
          });
        }
      }),

    /** Completed executions started within [fromIso, toIso), newest first (Home week, streak). */
    completedBetween: (fromIso: string, toIso: string): Promise<SessionExecution[]> =>
      findMany(
        db,
        exec,
        "status = 'completed' AND deleted_at IS NULL AND started_at >= ? AND started_at < ?",
        [fromIso, toIso],
        'ORDER BY started_at DESC',
      ),

    /** Finished activity, newest first, cursor-paginated (FS §62). */
    listHistory: (
      filter: HistoryFilter = {},
      cursor: string | null = null,
      limit = 30,
    ): Promise<Page<SessionExecution>> => {
      const where = ["status <> 'in_progress'", 'deleted_at IS NULL'];
      const params: SqlValue[] = [];
      if (filter.types?.length) {
        where.push('type IN (' + filter.types.map(() => '?').join(', ') + ')');
        params.push(...filter.types);
      }
      return pageByTime(db, exec, 'started_at', where.join(' AND '), params, cursor, limit);
    },
  };
}
