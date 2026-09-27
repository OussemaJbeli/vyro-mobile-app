import { addDaysIso, MATERIALIZE_DAYS, planMaterialization } from '@/domain/scheduling/recurrence';
import { type ScheduleRule, type ScheduledSession } from '@/types/domain';
import { type SessionStatusValue } from '@/types/enums';

import { type Database, type Db } from '../client';
import { tables } from '../mappers';

import {
  findMany,
  getOrThrow,
  insertModel,
  patchModel,
  softDeleteModel,
  type NewModel,
} from './base';

const rules = tables.scheduleRules;
const sessions = tables.scheduledSessions;

export type OneTimeSessionInput = Omit<
  NewModel<typeof sessions>,
  'ruleId' | 'status' | 'originalDate' | 'originalStartTime' | 'rescheduleCount' | 'isException'
> & { status?: SessionStatusValue };

/**
 * Rules + sessions storage (step 10). Recurrence expansion, materialization and conflict
 * detection are domain logic added in step 16 on top of these primitives.
 */
async function weekStartsOn(x: Db): Promise<0 | 1> {
  const row = await x.get<{ week_starts_on: number }>(
    'SELECT week_starts_on FROM user_profile WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1',
  );
  return row?.week_starts_on === 0 ? 0 : 1;
}

/**
 * Inserts missing rule occurrences from `today` to `until` (AD-09). Existing keys include
 * soft-deleted, moved and skipped rows, so nothing the user touched is recreated.
 */
async function materializeIn(x: Db, today: string, until: string): Promise<number> {
  // By start time, so a day's sessions are ordered by the clock (no time = last).
  const active = (await findMany(x, rules, 'deleted_at IS NULL AND active = 1', [])).sort((a, b) =>
    (a.startTime ?? '99:99').localeCompare(b.startTime ?? '99:99'),
  );
  if (active.length === 0) return 0;
  const keys = await x.all<{ k: string }>(
    "SELECT rule_id || '|' || original_date AS k FROM scheduled_sessions WHERE rule_id IS NOT NULL",
  );
  const plan = planMaterialization(
    active,
    new Set(keys.map((r) => r.k)),
    today,
    until,
    await weekStartsOn(x),
  );
  const byId = new Map(active.map((r) => [r.id, r]));
  const order = new Map<string, number>();
  for (const { ruleId, date } of plan) {
    const rule = byId.get(ruleId)!;
    const n = order.get(date) ?? 0;
    order.set(date, n + 1);
    await insertModel(x, sessions, {
      ruleId,
      templateId: rule.templateId,
      title: rule.title,
      type: rule.type,
      scheduledDate: date,
      startTime: rule.startTime,
      endTime: null,
      durationMinutes: rule.durationMinutes,
      status: 'planned',
      originalDate: date,
      originalStartTime: rule.startTime,
      rescheduleCount: 0,
      isException: false,
      orderInDay: n,
      reminderOffsetMinutes: rule.reminderOffsetMinutes,
      skipReason: null,
      notes: null,
    });
  }
  for (const r of active) {
    if (!r.materializedUntil || r.materializedUntil < until)
      await patchModel(x, rules, r.id, { materializedUntil: until });
  }
  return plan.length;
}

/** Removes future occurrences that are still untouched plan (planned, not an exception). */
async function clearFutureOccurrences(x: Db, ruleId: string, fromDate: string) {
  await x.run(
    "DELETE FROM scheduled_sessions WHERE rule_id = ? AND original_date >= ? AND status = 'planned' AND is_exception = 0",
    [ruleId, fromDate],
  );
}

export function scheduleRepo(db: Database) {
  const getSession = (id: string) => getOrThrow(db, sessions, id);

  return {
    /** Materializes every active rule up to `until` (default: today + 8 weeks). */
    materialize: (today: string, until = addDaysIso(today, MATERIALIZE_DAYS)) =>
      db.tx((tx) => materializeIn(tx, today, until)),

    /** Planner navigation past the window: extend it first (AD-09). */
    async ensureMaterialized(today: string, until: string): Promise<void> {
      const behind = await db.get<{ n: number }>(
        'SELECT COUNT(*) AS n FROM schedule_rules WHERE deleted_at IS NULL AND active = 1 AND (materialized_until IS NULL OR materialized_until < ?)',
        [until],
      );
      if ((behind?.n ?? 0) > 0)
        await db.tx((tx) => materializeIn(tx, today, until > today ? until : today));
    },

    /** Creates a rule and materializes it immediately. */
    createRule: (input: NewModel<typeof rules>, today: string) =>
      db.tx(async (tx) => {
        const rule = await insertModel(tx, rules, input);
        await materializeIn(tx, today, addDaysIso(today, MATERIALIZE_DAYS));
        return rule;
      }),

    /**
     * Edits a rule: only future, untouched occurrences are regenerated. Past, completed,
     * skipped, moved (exception) rows stay exactly as they were (FS §78).
     */
    updateRule: (id: string, patch: Partial<NewModel<typeof rules>>, today: string) =>
      db.tx(async (tx) => {
        await patchModel(tx, rules, id, { ...patch, materializedUntil: null });
        await clearFutureOccurrences(tx, id, today);
        await materializeIn(tx, today, addDaysIso(today, MATERIALIZE_DAYS));
      }),

    /**
     * Stops a rule from `fromDate` on. From today (or earlier) the rule is deleted;
     * from a future date it ends the day before. Past rows are kept.
     */
    deleteRule: (id: string, fromDate: string, today: string) =>
      db.tx(async (tx) => {
        await clearFutureOccurrences(tx, id, fromDate > today ? fromDate : today);
        if (fromDate <= today) await softDeleteModel(tx, rules, id);
        else await patchModel(tx, rules, id, { endDate: addDaysIso(fromDate, -1) });
      }),

    /** Planned rest for a day (FS §22). */
    setRestDay: (date: string) =>
      insertModel(db, sessions, {
        ruleId: null,
        templateId: null,
        title: 'Rest',
        type: 'rest',
        scheduledDate: date,
        startTime: null,
        endTime: null,
        durationMinutes: null,
        status: 'planned',
        originalDate: date,
        originalStartTime: null,
        rescheduleCount: 0,
        isException: false,
        orderInDay: 0,
        reminderOffsetMinutes: null,
        skipReason: null,
        notes: null,
      }),

    rules: {
      list: (): Promise<ScheduleRule[]> =>
        findMany(db, rules, 'deleted_at IS NULL', [], 'ORDER BY start_date, start_time'),
      get: (id: string) => getOrThrow(db, rules, id),
      create: (input: NewModel<typeof rules>) => insertModel(db, rules, input),
      update: (id: string, patch: Partial<NewModel<typeof rules>>) =>
        patchModel(db, rules, id, patch),
      softDelete: (id: string) => softDeleteModel(db, rules, id),
    },

    getSession,

    sessionsForDate: (date: string): Promise<ScheduledSession[]> =>
      findMany(
        db,
        sessions,
        'deleted_at IS NULL AND scheduled_date = ?',
        [date],
        'ORDER BY order_in_day, start_time IS NULL, start_time',
      ),

    /**
     * Logged work per session in [from, to] (latest execution wins): done sets over planned
     * sets, or done intervals over planned intervals (a partial interval counts half).
     */
    async workForRange(
      from: string,
      to: string,
    ): Promise<Record<string, { done: number; total: number }>> {
      const rows = await db.all<{
        sid: string;
        sets_total: number;
        sets_done: number;
        iv_total: number;
        iv_done: number;
      }>(
        'SELECT x.scheduled_session_id AS sid, ' +
          '(SELECT COUNT(*) FROM exercise_sets s JOIN session_exercises se ON se.id = s.session_exercise_id ' +
          'WHERE se.execution_id = x.id AND s.is_extra = 0 AND s.deleted_at IS NULL AND se.deleted_at IS NULL) AS sets_total, ' +
          '(SELECT COUNT(*) FROM exercise_sets s JOIN session_exercises se ON se.id = s.session_exercise_id ' +
          "WHERE se.execution_id = x.id AND s.is_extra = 0 AND s.status = 'done' AND s.deleted_at IS NULL AND se.deleted_at IS NULL) AS sets_done, " +
          '(SELECT COUNT(*) FROM running_interval_logs l WHERE l.execution_id = x.id AND l.is_repeat = 0 AND l.deleted_at IS NULL) AS iv_total, ' +
          "(SELECT COALESCE(SUM(CASE l.status WHEN 'done' THEN 1.0 WHEN 'partial' THEN 0.5 ELSE 0 END), 0) " +
          'FROM running_interval_logs l WHERE l.execution_id = x.id AND l.is_repeat = 0 AND l.deleted_at IS NULL) AS iv_done ' +
          'FROM session_executions x JOIN scheduled_sessions ss ON ss.id = x.scheduled_session_id ' +
          'WHERE x.deleted_at IS NULL AND ss.scheduled_date BETWEEN ? AND ? ORDER BY x.started_at',
        [from, to],
      );
      const out: Record<string, { done: number; total: number }> = {};
      for (const r of rows) {
        out[r.sid] =
          r.iv_total > 0
            ? { done: r.iv_done, total: r.iv_total }
            : { done: r.sets_done, total: r.sets_total };
      }
      return out;
    },

    sessionsForRange: (from: string, to: string): Promise<ScheduledSession[]> =>
      findMany(
        db,
        sessions,
        'deleted_at IS NULL AND scheduled_date BETWEEN ? AND ?',
        [from, to],
        'ORDER BY scheduled_date, order_in_day, start_time IS NULL, start_time',
      ),

    /** One-time session: its original date/time are the scheduled ones. */
    create: (input: OneTimeSessionInput) =>
      insertModel(db, sessions, {
        ...input,
        ruleId: null,
        status: input.status ?? 'planned',
        originalDate: input.scheduledDate,
        originalStartTime: input.startTime,
        rescheduleCount: 0,
        isException: false,
      }),

    /** Rule occurrence (step 16 materialization). UNIQUE(rule_id, original_date) keeps it idempotent. */
    createOccurrence: (input: NewModel<typeof sessions>) => insertModel(db, sessions, input),

    /** Invariant 4: move keeps original_date, counts the reschedule, detaches rule occurrences. */
    async move(id: string, date: string, time?: string | null): Promise<void> {
      const s = await getSession(id);
      await patchModel(db, sessions, id, {
        scheduledDate: date,
        ...(time !== undefined ? { startTime: time } : {}),
        rescheduleCount: s.rescheduleCount + 1,
        isException: s.ruleId !== null ? true : s.isException,
      });
    },

    async duplicate(id: string, date: string): Promise<ScheduledSession> {
      const s = await getSession(id);
      return insertModel(db, sessions, {
        ruleId: null,
        templateId: s.templateId,
        title: s.title,
        type: s.type,
        scheduledDate: date,
        startTime: s.startTime,
        endTime: s.endTime,
        durationMinutes: s.durationMinutes,
        status: 'planned',
        originalDate: date,
        originalStartTime: s.startTime,
        rescheduleCount: 0,
        isException: false,
        orderInDay: s.orderInDay,
        reminderOffsetMinutes: s.reminderOffsetMinutes,
        skipReason: null,
        notes: s.notes,
      });
    },

    skip: (id: string, reason: string | null = null) =>
      patchModel(db, sessions, id, { status: 'skipped', skipReason: reason }),
    cancel: (id: string) => patchModel(db, sessions, id, { status: 'cancelled' }),
    setStatus: (id: string, status: SessionStatusValue) => patchModel(db, sessions, id, { status }),
    /** Editing one occurrence detaches it from its rule (AD-09). */
    edit: (id: string, patch: Partial<NewModel<typeof sessions>>) =>
      patchModel(db, sessions, id, { ...patch, isException: true }),
    softDelete: (id: string) => softDeleteModel(db, sessions, id),

    reorderDay: (orderedIds: string[]) =>
      db.tx(async (tx) => {
        for (const [i, id] of orderedIds.entries()) {
          await patchModel(tx, sessions, id, { orderInDay: i });
        }
      }),
  };
}
