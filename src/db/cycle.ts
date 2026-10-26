/**
 * The training cycle on the device (1.3.0): Push → Pull → Legs → Rest, advancing only when a
 * training day is completed. Runs on every start: it settles the days that passed, then
 * rewrites the untouched planned sessions ahead from the current cycle position.
 */
import {
  REST,
  advanceCycle,
  cycleOrder,
  initialCycle,
  projectCycle,
  remapState,
  type CyclePlan,
  type CycleState,
} from '@/domain/scheduling/cycle';
import { addDaysIso, isoWeekday } from '@/domain/scheduling/recurrence';

import { type Database, type Db } from './client';
import { tables } from './mappers';
import { insertModel, nowIso } from './repositories/base';
import { CYCLE_PLAN, RUN_TIMES } from './seed/data/routine';
import { seedId } from './seed/ids';

/** Sessions created by the cycle point at these (inactive) rules, one per kind. */
export const CYCLE_RULES = { run: 'cycle-run', gym: 'cycle-gym', rest: 'cycle-rest' } as const;
const RULE_IDS = Object.values(CYCLE_RULES);
const AHEAD_DAYS = 56;

export async function readCycleState(db: Db): Promise<CycleState | null> {
  const row = await db.get<{ value: string }>(
    "SELECT value FROM app_settings WHERE key = 'cycle_state'",
  );
  return row ? (JSON.parse(row.value) as CycleState) : null;
}

async function writeCycleState(db: Db, state: CycleState, at: string) {
  await db.run(
    "INSERT INTO app_settings (key, value, updated_at) VALUES ('cycle_state', ?, ?) " +
      'ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
    [JSON.stringify(state), at],
  );
}

/** The VYRO day groups out of the box: Push, Pull, Legs (run + gym each). */
export const DEFAULT_CYCLE_PLAN: CyclePlan = {
  groups: (['push', 'pull', 'legs'] as const).map((id) => ({
    id,
    name: id[0]!.toUpperCase() + id.slice(1),
    runTemplateId: seedId.template(CYCLE_PLAN[id].run),
    gymTemplateId: seedId.template(CYCLE_PLAN[id].gym),
  })),
};

export async function readCyclePlan(db: Db): Promise<CyclePlan> {
  const row = await db.get<{ value: string }>(
    "SELECT value FROM app_settings WHERE key = 'cycle_plan'",
  );
  const plan = row ? (JSON.parse(row.value) as CyclePlan) : null;
  return plan?.groups?.length ? plan : DEFAULT_CYCLE_PLAN;
}

/**
 * Saves edited day groups (names, workouts, order). The current position stays on the same
 * group, then the plan ahead is rewritten. Done/moved sessions are never touched.
 */
export async function saveCyclePlan(db: Database, plan: CyclePlan, today: string) {
  const before = cycleOrder(await readCyclePlan(db));
  const state = await readCycleState(db);
  const at = nowIso();
  await db.run(
    "INSERT INTO app_settings (key, value, updated_at) VALUES ('cycle_plan', ?, ?) " +
      'ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
    [JSON.stringify(plan), at],
  );
  if (state) await writeCycleState(db, remapState(state, before, cycleOrder(plan)), at);
  // Untouched planned sessions ahead change with the groups.
  await db.run(
    'DELETE FROM scheduled_sessions WHERE scheduled_date >= ? AND rule_id IN (' +
      RULE_IDS.map(() => '?').join(', ') +
      ") AND status = 'planned' AND is_exception = 0 AND deleted_at IS NULL " +
      'AND id NOT IN (SELECT scheduled_session_id FROM session_executions WHERE scheduled_session_id IS NOT NULL)',
    [today, ...RULE_IDS],
  );
  return reconcileCycle(db, today);
}

/** "Restart from Day 1 today": resets the position and redraws the plan ahead. */
export async function restartCycle(db: Database, today: string) {
  await startCycle(db, today);
  return saveCyclePlan(db, await readCyclePlan(db), today);
}

/** Starts (or restarts) the cycle: Day 1 on the setup day (see `initialCycle`). */
export async function startCycle(db: Db, today: string): Promise<void> {
  await writeCycleState(db, initialCycle(today), nowIso());
}

async function ensureRules(db: Db, at: string) {
  for (const [kind, id] of Object.entries(CYCLE_RULES)) {
    await db.run(
      'INSERT OR IGNORE INTO schedule_rules (id, template_id, title, type, freq, interval, start_date, active, created_at, updated_at) ' +
        "VALUES (?, NULL, ?, ?, 'custom', 1, ?, 0, ?, ?)",
      [id, `VYRO cycle · ${kind}`, kind === 'run' ? 'running' : kind, at.slice(0, 10), at, at],
    );
    await db.run('UPDATE schedule_rules SET deleted_at = NULL, active = 0 WHERE id = ?', [id]);
  }
}

/**
 * A training day counts once its gym workout is completed (or completed with changes); a
 * day group without a gym workout counts its run instead.
 */
async function dayDoneOn(db: Db, date: string, rule: string): Promise<boolean> {
  const row = await db.get<{ n: number }>(
    'SELECT COUNT(*) AS n FROM scheduled_sessions WHERE scheduled_date = ? AND rule_id = ? ' +
      "AND status IN ('completed', 'modified') AND deleted_at IS NULL",
    [date, rule],
  );
  return (row?.n ?? 0) > 0;
}

/** Settles past days and rewrites the plan ahead. Returns the current cycle state. */
export async function reconcileCycle(db: Database, today: string): Promise<CycleState | null> {
  const saved = await readCycleState(db);
  if (!saved) return null;
  const plan = await readCyclePlan(db);
  const order = cycleOrder(plan);
  const groups = new Map(plan.groups.map((g) => [g.id, g]));
  const gymDone = new Map<string, boolean>();
  const runDone = new Map<string, boolean>();
  for (let d = saved.date; d < today; d = addDaysIso(d, 1)) {
    gymDone.set(d, await dayDoneOn(db, d, CYCLE_RULES.gym));
    runDone.set(d, await dayDoneOn(db, d, CYCLE_RULES.run));
  }
  // A group with a gym workout needs the gym; one with only a run needs the run.
  const state = advanceCycle(saved, today, order, (d, id) =>
    groups.get(id)?.gymTemplateId ? (gymDone.get(d) ?? false) : (runDone.get(d) ?? false),
  );

  await db.tx(async (tx) => {
    const at = nowIso();
    await ensureRules(tx, at);
    await writeCycleState(tx, state, at);
    const marks = RULE_IDS.map(() => '?').join(', ');
    // Today already started or finished: keep it, and plan from tomorrow (today counts as done).
    const touched = await tx.get<{ n: number }>(
      'SELECT COUNT(*) AS n FROM scheduled_sessions WHERE scheduled_date = ? AND deleted_at IS NULL ' +
        'AND rule_id IN (' +
        marks +
        ") AND (status <> 'planned' OR is_exception = 1)",
      [today, ...RULE_IDS],
    );
    const keepToday = (touched?.n ?? 0) > 0;
    const from = keepToday ? addDaysIso(today, 1) : today;
    const start: CycleState = keepToday ? { date: from, index: state.index + 1 } : state;

    // Untouched cycle sessions ahead are regenerated; moved/edited/done ones stay.
    await tx.run(
      'DELETE FROM scheduled_sessions WHERE scheduled_date >= ? AND rule_id IN (' +
        marks +
        ') ' +
        "AND status = 'planned' AND is_exception = 0 AND deleted_at IS NULL " +
        'AND id NOT IN (SELECT scheduled_session_id FROM session_executions WHERE scheduled_session_id IS NOT NULL)',
      [from, ...RULE_IDS],
    );
    const templates = await loadTemplates(tx, plan);
    for (const { date, dayId } of projectCycle(start, order, AHEAD_DAYS)) {
      await addDay(tx, date, dayId === REST ? null : (groups.get(dayId) ?? null), templates);
    }
  });
  return state;
}

type Tpl = { id: string; name: string; type: string; duration_minutes: number | null };

async function loadTemplates(tx: Db, plan: CyclePlan): Promise<Map<string, Tpl>> {
  const ids = plan.groups
    .flatMap((g) => [g.runTemplateId, g.gymTemplateId])
    .filter((x): x is string => !!x);
  if (!ids.length) return new Map();
  const rows = await tx.all<Tpl>(
    'SELECT id, name, type, duration_minutes FROM workout_templates WHERE deleted_at IS NULL AND id IN (' +
      ids.map(() => '?').join(', ') +
      ')',
    ids,
  );
  return new Map(rows.map((r) => [r.id, r]));
}

const minutesOf = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const hhmm = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

async function addDay(
  tx: Db,
  date: string,
  group: CyclePlan['groups'][number] | null,
  templates: Map<string, Tpl>,
) {
  const exists = async (rule: string) =>
    !!(await tx.get('SELECT id FROM scheduled_sessions WHERE rule_id = ? AND original_date = ?', [
      rule,
      date,
    ]));
  const add = async (rule: string, tpl: Tpl | null, time: string | null, order: number) => {
    if (await exists(rule)) return;
    await insertModel(tx, tables.scheduledSessions, {
      ruleId: rule,
      templateId: tpl?.id ?? null,
      title: tpl?.name ?? 'Rest',
      type: (tpl?.type ?? 'rest') as 'rest',
      scheduledDate: date,
      startTime: time,
      endTime: null,
      durationMinutes: tpl?.duration_minutes ?? null,
      status: 'planned',
      originalDate: date,
      originalStartTime: time,
      rescheduleCount: 0,
      isException: false,
      orderInDay: order,
      reminderOffsetMinutes: tpl ? 15 : null,
      skipReason: null,
      notes: null,
    });
  };
  if (!group) return add(CYCLE_RULES.rest, null, null, 0);
  const run = group.runTemplateId ? (templates.get(group.runTemplateId) ?? null) : null;
  const gym = group.gymTemplateId ? (templates.get(group.gymTemplateId) ?? null) : null;
  const runAt = RUN_TIMES[isoWeekday(date)] ?? '16:30';
  if (run) await add(CYCLE_RULES.run, run, runAt, 0);
  // The gym follows the run: end + 5 min, rounded up to 5 (or at the run time without a run).
  const gymAt = run
    ? hhmm(Math.ceil((minutesOf(runAt) + (run.duration_minutes ?? 30) + 5) / 5) * 5)
    : runAt;
  if (gym) await add(CYCLE_RULES.gym, gym, gymAt, 1);
}
