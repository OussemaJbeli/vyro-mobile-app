/**
 * Dev-only demo dataset (step 28): ~2 years of plan, executions with sets, weights,
 * measurements and photo rows, for performance checks. Deterministic (seeded PRNG),
 * inserted in one transaction with raw SQL for speed. Photo files are written by the
 * dev screen (native only); rows reference `photos/demo/…`.
 */
import { type Database, type Db } from './client';

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const iso = (d: Date) => d.toISOString();
const day = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

async function insert(db: Db, table: string, row: Record<string, string | number | null>) {
  const keys = Object.keys(row);
  await db.run(
    'INSERT INTO ' +
      table +
      ' (' +
      keys.join(', ') +
      ') VALUES (' +
      keys.map(() => '?').join(', ') +
      ')',
    keys.map((k) => row[k] ?? null),
  );
}

export type DemoCounts = Record<string, number>;

export async function loadDemoData(
  db: Database,
  opts: { now?: Date; days?: number } = {},
): Promise<DemoCounts> {
  const now = opts.now ?? new Date();
  const days = opts.days ?? 730;
  const rand = rng(42);
  const exercises = await db.all<{ id: string; tracking: string }>(
    "SELECT id, tracking FROM exercises WHERE deleted_at IS NULL AND tracking IN ('weight_reps', 'reps') ORDER BY slug LIMIT 12",
  );
  const types = await db.all<{ id: string; kind: string }>(
    'SELECT id, kind FROM measurement_types WHERE deleted_at IS NULL',
  );
  const counts: DemoCounts = {
    scheduled_sessions: 0,
    session_executions: 0,
    exercise_sets: 0,
    weight_entries: 0,
    body_measurements: 0,
    progress_photos: 0,
  };
  const created = iso(now);
  const base = { created_at: created, updated_at: created, deleted_at: null };
  let n = 0;
  const id = (p: string) => `demo-${p}-${(n++).toString(36)}`;
  const snapshot = (name: string, type: string) =>
    JSON.stringify({
      schemaVersion: 1,
      templateId: null,
      name,
      type,
      exercises: [],
      intervals: [],
    });

  await db.tx(async (tx) => {
    let weight = 84;
    for (let i = days; i >= 1; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i, 18, 0, 0);
      const date = day(d);
      const dow = d.getDay();
      const plan =
        dow === 1 || dow === 3 || dow === 5
          ? 'gym'
          : dow === 2
            ? 'running'
            : dow === 6
              ? 'abs'
              : 'rest';
      const sessionId = id('s');
      const roll = rand();
      const status =
        plan === 'rest'
          ? 'planned'
          : roll < 0.84
            ? 'completed'
            : roll < 0.9
              ? 'modified'
              : roll < 0.95
                ? 'skipped'
                : 'planned';
      await insert(tx, 'scheduled_sessions', {
        id: sessionId,
        rule_id: null,
        template_id: null,
        title:
          plan === 'gym'
            ? 'Upper Body'
            : plan === 'running'
              ? 'Interval Run'
              : plan === 'abs'
                ? 'Six Pack'
                : 'Rest',
        type: plan,
        scheduled_date: date,
        start_time: plan === 'rest' ? null : '18:00',
        end_time: null,
        duration_minutes: plan === 'rest' ? null : 45,
        order_in_day: 0,
        status,
        original_date: date,
        original_start_time: null,
        reschedule_count: rand() < 0.05 ? 1 : 0,
        reminder_offset_minutes: null,
        skip_reason: null,
        notes: null,
        ...base,
      });
      counts.scheduled_sessions!++;
      if (status === 'completed' || status === 'modified') {
        const x = id('x');
        const active =
          plan === 'running' ? 1800 + Math.round(rand() * 900) : 2400 + Math.round(rand() * 1200);
        await insert(tx, 'session_executions', {
          id: x,
          scheduled_session_id: sessionId,
          template_id: null,
          type: plan,
          title: plan,
          status: 'completed',
          outcome: status === 'completed' ? 'as_planned' : 'modified',
          started_at: iso(d),
          ended_at: iso(new Date(d.getTime() + active * 1000)),
          active_seconds: active,
          paused_seconds: 0,
          planned_snapshot: snapshot(plan, plan),
          runtime_state: null,
          is_retroactive: 0,
          perceived_effort: 6,
          distance_km: plan === 'running' ? Math.round((active / 3600) * 10 * 100) / 100 : null,
          notes: null,
          ...base,
        });
        counts.session_executions!++;
        if (plan !== 'running') {
          const list =
            plan === 'gym'
              ? exercises.slice(0, 10)
              : exercises.slice(10, 12).concat(exercises.slice(0, 3));
          for (const [k, e] of list.entries()) {
            const se = id('se');
            await insert(tx, 'session_exercises', {
              id: se,
              execution_id: x,
              exercise_id: e.id,
              planned_exercise_id: e.id,
              order_index: k,
              planned_sets: 4,
              planned_reps: 10,
              planned_duration_seconds: null,
              planned_weight_kg: e.tracking === 'weight_reps' ? 40 : null,
              planned_rest_seconds: 90,
              status: 'done',
              substitution_reason: null,
              notes: null,
              ...base,
            });
            const progress = (days - i) / days;
            for (let s = 0; s < 4; s++) {
              await insert(tx, 'exercise_sets', {
                id: id('set'),
                session_exercise_id: se,
                set_index: s,
                planned_reps: 10,
                planned_weight_kg: e.tracking === 'weight_reps' ? 40 : null,
                planned_duration_seconds: null,
                actual_reps: 8 + Math.round(rand() * 4),
                actual_weight_kg:
                  e.tracking === 'weight_reps' ? Math.round((35 + progress * 30) * 2) / 2 : null,
                actual_duration_seconds: null,
                rest_taken_seconds: 90,
                status: 'done',
                is_extra: 0,
                completed_at: iso(d),
                ...base,
              });
              counts.exercise_sets!++;
            }
          }
        }
      }
      if (rand() < 0.96) {
        weight += (rand() - 0.55) * 0.3;
        await insert(tx, 'weight_entries', {
          id: id('w'),
          value_kg: Math.round(weight * 10) / 10,
          unit_entered: 'kg',
          recorded_at: iso(new Date(d.getTime() - 11 * 3600_000)),
          notes: null,
          ...base,
        });
        counts.weight_entries!++;
      }
      if (dow === 0 && counts.body_measurements! < 1000) {
        for (const t of types) {
          await insert(tx, 'body_measurements', {
            id: id('m'),
            measurement_type_id: t.id,
            value: t.kind === 'percent' ? 15 + rand() * 3 : 30 + rand() * 60,
            unit_entered: t.kind === 'percent' ? 'percent' : 'cm',
            recorded_at: iso(new Date(d.getTime() - 10 * 3600_000)),
            notes: null,
            ...base,
          });
          counts.body_measurements!++;
        }
      }
      if (i % 2 === 0 && counts.progress_photos! < 300) {
        const pid = id('p');
        const sub = ['body.front', 'body.side', 'body.back'][counts.progress_photos! % 3]!;
        await insert(tx, 'progress_photos', {
          id: pid,
          category: 'body',
          sub_category: sub,
          file_path: `photos/demo/${pid}.jpg`,
          thumb_path: `thumbs/demo-${pid}.jpg`,
          width: 1,
          height: 1,
          bytes: 125,
          captured_at: iso(d),
          weight_entry_id: null,
          notes: null,
          ...base,
        });
        counts.progress_photos!++;
      }
    }
  });
  return counts;
}

/**
 * Dev-only "template scenario" (UI phase): reproduces docs/template/template.png data so
 * screens can be compared side by side — Alex, today Running ✓ / Gym 18:00 / Six Pack
 * 20:00, upcoming rest/run/full body, weights trending to 74.6 kg, height 180, body fat 12.4.
 */
export async function loadTemplateScenario(db: Database, now: Date = new Date()): Promise<void> {
  const created = iso(now);
  const base = { created_at: created, updated_at: created, deleted_at: null };
  let n = 0;
  const id = (p: string) => `scn-${p}-${(n++).toString(36)}-${now.getTime().toString(36)}`;
  const at = (offsetDays: number, h = 12, m = 0) =>
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + offsetDays, h, m, 0);
  const snap = (name: string, type: string) =>
    JSON.stringify({
      schemaVersion: 1,
      templateId: null,
      name,
      type,
      exercises: [],
      intervals: [],
    });
  await db.tx(async (tx) => {
    await tx.run("UPDATE user_profile SET name = 'Alex', height_cm = 180");
    const session = async (
      offset: number,
      tpl: string | null,
      title: string,
      type: string,
      time: string | null,
      minutes: number | null,
      status: string,
      order = 0,
    ) => {
      const sid = id('s');
      const date = day(at(offset));
      await insert(tx, 'scheduled_sessions', {
        id: sid,
        rule_id: null,
        template_id: tpl,
        title,
        type,
        scheduled_date: date,
        start_time: time,
        end_time: null,
        duration_minutes: minutes,
        order_in_day: order,
        status,
        original_date: date,
        original_start_time: time,
        reschedule_count: 0,
        reminder_offset_minutes: null,
        skip_reason: null,
        notes: null,
        ...base,
      });
      return sid;
    };
    const execution = async (
      sid: string | null,
      offset: number,
      type: string,
      title: string,
      minutes: number,
      tpl: string | null,
      km: number | null = null,
    ) => {
      const start = at(offset, 7, 0);
      await insert(tx, 'session_executions', {
        id: id('x'),
        scheduled_session_id: sid,
        template_id: tpl,
        type,
        title,
        status: 'completed',
        outcome: 'as_planned',
        started_at: iso(start),
        ended_at: iso(new Date(start.getTime() + minutes * 60_000)),
        active_seconds: minutes * 60,
        paused_seconds: 0,
        planned_snapshot: snap(title, type),
        runtime_state: null,
        is_retroactive: 0,
        perceived_effort: 6,
        distance_km: km,
        notes: null,
        ...base,
      });
    };
    // Today (template screen 1 / 3 / 5).
    const run = await session(
      0,
      'seed-tpl-run_30',
      'Running',
      'running',
      '07:00',
      30,
      'completed',
      0,
    );
    await execution(run, 0, 'running', 'Running', 30, 'seed-tpl-run_30', 5);
    await session(0, 'seed-tpl-upper_body', 'Gym', 'gym', '18:00', 55, 'planned', 1);
    await session(0, 'seed-tpl-abs', 'Six Pack', 'abs', '20:00', 12, 'planned', 2);
    // Upcoming.
    await session(1, null, 'Rest Day', 'rest', null, null, 'planned');
    await session(2, 'seed-tpl-run_30', 'Running', 'running', '18:00', 30, 'planned');
    await session(3, 'seed-tpl-full_body', 'Gym', 'gym', '18:00', 60, 'planned');
    // Earlier this week: 3 gym, 1 run, 3 abs (with today's run: 4 · 2 · 3 in "This Week").
    for (const [off, type, title, min, tpl] of [
      [-1, 'gym', 'Upper Body', 55, 'seed-tpl-upper_body'],
      [-2, 'abs', 'Six Pack', 12, 'seed-tpl-abs'],
      [-3, 'gym', 'Leg Day', 60, 'seed-tpl-leg_day'],
      [-3, 'abs', 'Six Pack', 12, 'seed-tpl-abs'],
      [-4, 'running', 'Running', 30, 'seed-tpl-run_30'],
      [-5, 'gym', 'Push', 50, 'seed-tpl-push'],
      [-5, 'abs', 'Six Pack', 12, 'seed-tpl-abs'],
      [-2, 'gym', 'Pull', 50, 'seed-tpl-pull'],
    ] as const) {
      await execution(null, off, type, title, min, tpl, type === 'running' ? 5 : null);
    }
    // Weights: 75.0 → 74.6 over the last week (template "↓ 0.4 kg this week").
    const weights = [76.1, 75.9, 75.6, 75.5, 75.3, 75.0, 75.0, 74.9, 74.8, 74.8, 74.7, 74.6];
    for (const [i, kg] of weights.entries()) {
      await insert(tx, 'weight_entries', {
        id: id('w'),
        value_kg: kg,
        unit_entered: 'kg',
        recorded_at: iso(at(i - weights.length + 1, 7, 30)),
        notes: null,
        ...base,
      });
    }
    const fat = await tx.get<{ id: string }>(
      "SELECT id FROM measurement_types WHERE slug = 'body_fat'",
    );
    if (fat) {
      await insert(tx, 'body_measurements', {
        id: id('m'),
        measurement_type_id: fat.id,
        value: 12.4,
        unit_entered: 'percent',
        recorded_at: iso(at(0, 7, 35)),
        notes: null,
        ...base,
      });
    }
  });
}
