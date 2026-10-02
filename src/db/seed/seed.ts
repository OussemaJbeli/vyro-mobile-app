import { type Database, type Db } from '../client';
import { tables, toRow, type TableSpec } from '../mappers';

import { seedData } from './data/content';
import { seedId } from './ids';
import { type SeedData } from './types';

/** Bump when seed content gains rows. Existing rows are never overwritten. */
export const CURRENT_SEED_VERSION = 5;

async function insertMissing(tx: Db, spec: TableSpec, model: object): Promise<number> {
  const row = toRow(spec, model);
  const cols = Object.keys(row);
  // Identifiers come from the static table registry; values are bound.
  const sql =
    'INSERT OR IGNORE INTO ' +
    spec.table +
    ' (' +
    cols.join(', ') +
    ') VALUES (' +
    cols.map(() => '?').join(', ') +
    ')';
  return (await tx.run(sql, Object.values(row))).changes;
}

export async function getSeedVersion(db: Db): Promise<number> {
  const row = await db.get<{ value: string }>(
    "SELECT value FROM app_settings WHERE key = 'seed_version'",
  );
  return row ? Number(JSON.parse(row.value)) || 0 : 0;
}

export type SeedReport = { ran: boolean; inserted: number; version: number };

/**
 * Inserts seed rows that don't exist yet, in one transaction (step 09).
 * User edits to seeded rows survive re-seeding because nothing is updated.
 */
export async function seedDatabase(
  db: Database,
  {
    data = seedData,
    version = CURRENT_SEED_VERSION,
    now = new Date().toISOString(),
  }: {
    data?: SeedData;
    version?: number;
    now?: string;
  } = {},
): Promise<SeedReport> {
  if ((await getSeedVersion(db)) >= version) return { ran: false, inserted: 0, version };
  const base = (id: string) => ({ id, createdAt: now, updatedAt: now, deletedAt: null });
  const exercises = new Map(data.exercises.map((e) => [e.slug, e]));

  const inserted = await db.tx(async (tx) => {
    let n = 0;
    for (const e of data.equipment) {
      n += await insertMissing(tx, tables.equipment, {
        ...base(seedId.equipment(e.slug)),
        slug: e.slug,
        name: e.name,
        category: e.category,
        available: true,
        isCustom: false,
        notes: null,
        iconKey: null,
        imagePath: null,
      });
    }
    for (const x of data.exercises) {
      n += await insertMissing(tx, tables.exercises, {
        ...base(seedId.exercise(x.slug)),
        slug: x.slug,
        name: x.name,
        category: x.category,
        primaryMuscle: x.primaryMuscle,
        secondaryMuscles: x.secondaryMuscles,
        tracking: x.tracking,
        instructions: x.instructions.join('\n'),
        defaultSets: x.defaultSets,
        defaultReps: x.defaultReps,
        defaultDurationSeconds: x.defaultDurationSeconds,
        defaultRestSeconds: x.defaultRestSeconds,
        difficulty: x.difficulty,
        isCustom: false,
        archivedAt: null,
      });
      for (const eq of x.equipment) {
        n += await insertMissing(tx, tables.exerciseEquipment, {
          exerciseId: seedId.exercise(x.slug),
          equipmentId: seedId.equipment(eq),
        });
      }
    }
    for (const [slug, alts] of Object.entries(data.alternatives)) {
      for (const [i, alt] of alts.entries()) {
        n += await insertMissing(tx, tables.exerciseAlternatives, {
          exerciseId: seedId.exercise(slug),
          alternativeId: seedId.exercise(alt),
          priority: i + 1,
          note: null,
        });
      }
    }
    for (const m of data.measurementTypes) {
      n += await insertMissing(tx, tables.measurementTypes, {
        ...base(seedId.measurementType(m.slug)),
        slug: m.slug,
        name: m.name,
        kind: m.kind,
        unitOther: null,
        orderIndex: m.orderIndex,
        isCustom: false,
        archivedAt: null,
      });
    }
    for (const c of data.photoCategories) {
      n += await insertMissing(tx, tables.photoCategories, { ...c, name: null });
    }
    for (const t of data.templates) {
      const templateId = seedId.template(t.key);
      n += await insertMissing(tx, tables.workoutTemplates, {
        ...base(templateId),
        name: t.name,
        type: t.type,
        description: t.description,
        durationMinutes: t.durationMinutes,
        difficulty: t.difficulty,
        coverKey: t.coverKey,
        distanceTargetKm: null,
        isSeed: true,
        archivedAt: null,
        notes: null,
      });
      for (const [i, item] of (t.exercises ?? []).entries()) {
        n += await insertMissing(tx, tables.templateExercises, {
          ...base(seedId.templateExercise(t.key, i)),
          templateId,
          exerciseId: seedId.exercise(item.exercise),
          orderIndex: i,
          sets: item.sets,
          targetReps: item.targetReps ?? null,
          targetDurationSeconds: item.targetDurationSeconds ?? null,
          targetWeightKg: item.targetWeightKg ?? null,
          restSeconds: item.restSeconds ?? exercises.get(item.exercise)?.defaultRestSeconds ?? null,
          supersetGroup: null,
          notes: item.notes ?? null,
        });
      }
      for (const [i, iv] of (t.intervals ?? []).entries()) {
        n += await insertMissing(tx, tables.templateIntervals, {
          ...base(seedId.templateInterval(t.key, i)),
          templateId,
          orderIndex: i,
          kind: iv.kind,
          durationSeconds: iv.durationSeconds,
          speedKmh: iv.speedKmh,
          inclinePercent: iv.inclinePercent,
          label: iv.label,
        });
      }
    }
    await tx.run(
      "INSERT INTO app_settings (key, value, updated_at) VALUES ('seed_version', ?, ?) " +
        'ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
      [JSON.stringify(version), now],
    );
    return n;
  });
  return { ran: true, inserted, version };
}
