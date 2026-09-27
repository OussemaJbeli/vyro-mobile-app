import { type Exercise, type ExerciseAlternative } from '@/types/domain';
import { type EXERCISE_CATEGORIES } from '@/types/enums';

import { type Database } from '../client';
import { type SqlValue } from '../driver';
import { tables } from '../mappers';

import { findMany, getOrThrow, insertModel, nowIso, patchModel, type NewModel } from './base';

const spec = tables.exercises;

export type ExerciseFilter = {
  q?: string;
  category?: (typeof EXERCISE_CATEGORIES)[number];
  /** Only exercises whose required equipment is all available. */
  availableOnly?: boolean;
  customOnly?: boolean;
  includeArchived?: boolean;
};

export type ExerciseDetail = Exercise & {
  equipmentIds: string[];
  alternatives: ExerciseAlternative[];
};

// Missing-equipment test used by filters: any required item deleted or unavailable.
const MISSING_EQUIPMENT =
  'EXISTS (SELECT 1 FROM exercise_equipment ee JOIN equipment e ON e.id = ee.equipment_id ' +
  'WHERE ee.exercise_id = exercises.id AND (e.available = 0 OR e.deleted_at IS NOT NULL))';

export function exerciseRepo(db: Database) {
  const withRelations = async (ex: Exercise): Promise<ExerciseDetail> => {
    const equipment = await db.all<{ equipment_id: string }>(
      'SELECT equipment_id FROM exercise_equipment WHERE exercise_id = ?',
      [ex.id],
    );
    const alternatives = await findMany(
      db,
      tables.exerciseAlternatives,
      'exercise_id = ?',
      [ex.id],
      'ORDER BY priority',
    );
    return { ...ex, equipmentIds: equipment.map((r) => r.equipment_id), alternatives };
  };

  return {
    async search(filter: ExerciseFilter = {}): Promise<Exercise[]> {
      const where = ['deleted_at IS NULL'];
      const params: SqlValue[] = [];
      if (!filter.includeArchived) where.push('archived_at IS NULL');
      if (filter.q?.trim()) {
        // Simple local search (FS §73). Escape LIKE wildcards in user text.
        where.push("name LIKE ? ESCAPE '\\'");
        params.push(`%${filter.q.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
      }
      if (filter.category) {
        where.push('category = ?');
        params.push(filter.category);
      }
      if (filter.customOnly) where.push('is_custom = 1');
      if (filter.availableOnly) where.push('NOT ' + MISSING_EQUIPMENT);
      return findMany(
        db,
        spec,
        where.join(' AND '),
        params,
        'ORDER BY category, name COLLATE NOCASE',
      );
    },

    get: async (id: string) => withRelations(await getOrThrow(db, spec, id)),

    /** Every exercise with its equipment ids, for the alternative engine (step 13). */
    async listWithEquipment(): Promise<ExerciseDetail[]> {
      const all = await findMany(db, spec, 'deleted_at IS NULL', []);
      const links = await db.all<{ exercise_id: string; equipment_id: string }>(
        'SELECT exercise_id, equipment_id FROM exercise_equipment',
      );
      const alts = await findMany(db, tables.exerciseAlternatives, '', [], 'ORDER BY priority');
      return all.map((ex) => ({
        ...ex,
        equipmentIds: links.filter((l) => l.exercise_id === ex.id).map((l) => l.equipment_id),
        alternatives: alts.filter((a) => a.exerciseId === ex.id),
      }));
    },

    create: (
      input: Omit<NewModel<typeof spec>, 'isCustom' | 'archivedAt'>,
      equipmentIds: string[] = [],
    ) =>
      db.tx(async (tx) => {
        const ex = await insertModel(tx, spec, { ...input, isCustom: true, archivedAt: null });
        for (const eq of equipmentIds) {
          await tx.run('INSERT INTO exercise_equipment (exercise_id, equipment_id) VALUES (?, ?)', [
            ex.id,
            eq,
          ]);
        }
        return ex;
      }),

    update: (id: string, patch: Partial<NewModel<typeof spec>>, equipmentIds?: string[]) =>
      db.tx(async (tx) => {
        if (Object.keys(patch).length) await patchModel(tx, spec, id, patch);
        if (equipmentIds) {
          await tx.run('DELETE FROM exercise_equipment WHERE exercise_id = ?', [id]);
          for (const eq of equipmentIds) {
            await tx.run(
              'INSERT INTO exercise_equipment (exercise_id, equipment_id) VALUES (?, ?)',
              [id, eq],
            );
          }
        }
      }),

    /** Copies an exercise (with equipment and alternatives) as a new custom exercise. */
    async duplicate(id: string, name: string): Promise<Exercise> {
      const src = await withRelations(await getOrThrow(db, spec, id));
      return db.tx(async (tx) => {
        const copy = await insertModel(tx, spec, {
          slug: null,
          name,
          category: src.category,
          primaryMuscle: src.primaryMuscle,
          secondaryMuscles: src.secondaryMuscles,
          tracking: src.tracking,
          instructions: src.instructions,
          defaultSets: src.defaultSets,
          defaultReps: src.defaultReps,
          defaultDurationSeconds: src.defaultDurationSeconds,
          defaultRestSeconds: src.defaultRestSeconds,
          difficulty: src.difficulty,
          isCustom: true,
          archivedAt: null,
        });
        for (const eq of src.equipmentIds) {
          await tx.run('INSERT INTO exercise_equipment (exercise_id, equipment_id) VALUES (?, ?)', [
            copy.id,
            eq,
          ]);
        }
        for (const a of src.alternatives) {
          await tx.run(
            'INSERT INTO exercise_alternatives (exercise_id, alternative_id, priority, note) VALUES (?, ?, ?, ?)',
            [copy.id, a.alternativeId, a.priority, a.note],
          );
        }
        return copy;
      });
    },

    /** Archived exercises leave pickers but stay in history (step 13). */
    archive: (id: string) => patchModel(db, spec, id, { archivedAt: nowIso() }),
    unarchive: (id: string) => patchModel(db, spec, id, { archivedAt: null }),

    /** Replaces the ordered alternatives list (priority = position + 1). */
    setAlternatives: (id: string, alternativeIds: string[]) =>
      db.tx(async (tx) => {
        await tx.run('DELETE FROM exercise_alternatives WHERE exercise_id = ?', [id]);
        for (const [i, alt] of alternativeIds.entries()) {
          if (alt === id) continue;
          await tx.run(
            'INSERT INTO exercise_alternatives (exercise_id, alternative_id, priority, note) VALUES (?, ?, ?, NULL)',
            [id, alt, i + 1],
          );
        }
      }),
  };
}
