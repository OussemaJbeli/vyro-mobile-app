import { type Equipment } from '@/types/domain';

import { type Db } from '../client';
import { tables } from '../mappers';

import { findMany, insertModel, patchModel, softDeleteModel, type NewModel } from './base';

const spec = tables.equipment;

export function equipmentRepo(db: Db) {
  return {
    list: (): Promise<Equipment[]> =>
      findMany(db, spec, 'deleted_at IS NULL', [], 'ORDER BY category, name COLLATE NOCASE'),
    setAvailable: (id: string, available: boolean) => patchModel(db, spec, id, { available }),
    /** Applies a preset in one transaction (step 12): ids not listed become unavailable. */
    setAvailableOnly: (ids: string[]) => {
      // An empty preset still needs one placeholder: '' matches no id, so all become unavailable.
      const list = ids.length ? ids : [''];
      return db.run(
        'UPDATE equipment SET available = CASE WHEN id IN (' +
          list.map(() => '?').join(', ') +
          ') THEN 1 ELSE 0 END WHERE deleted_at IS NULL',
        list,
      );
    },
    /**
     * How many exercises (and workouts) in active templates need each equipment item.
     * Drives the "3 exercises in your workouts need Cable machine" hint (step 12).
     */
    async usage(): Promise<Record<string, { exercises: number; templates: number }>> {
      const rows = await db.all<{ id: string; exercises: number; templates: number }>(
        'SELECT ee.equipment_id AS id, COUNT(DISTINCT te.exercise_id) AS exercises, ' +
          'COUNT(DISTINCT te.template_id) AS templates ' +
          'FROM workout_template_exercises te ' +
          'JOIN workout_templates t ON t.id = te.template_id AND t.deleted_at IS NULL AND t.archived_at IS NULL ' +
          'JOIN exercise_equipment ee ON ee.exercise_id = te.exercise_id ' +
          'WHERE te.deleted_at IS NULL GROUP BY ee.equipment_id',
      );
      return Object.fromEntries(
        rows.map((r) => [r.id, { exercises: r.exercises, templates: r.templates }]),
      );
    },
    create: (input: Omit<NewModel<typeof spec>, 'isCustom' | 'iconKey' | 'imagePath'>) =>
      insertModel(db, spec, { iconKey: null, imagePath: null, ...input, isCustom: true }),
    /** Custom icon or picture (Train → Equipment). Setting one clears the other. */
    setVisual: (id: string, visual: { iconKey: string | null; imagePath: string | null }) =>
      patchModel(db, spec, id, visual),
    update: (id: string, patch: Partial<NewModel<typeof spec>>) => patchModel(db, spec, id, patch),
    softDelete: (id: string) => softDeleteModel(db, spec, id),
  };
}
