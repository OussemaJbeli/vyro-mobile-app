import { type TemplateExercise, type TemplateInterval, type WorkoutTemplate } from '@/types/domain';
import { type TemplateType } from '@/types/enums';

import { type Database, type Db } from '../client';
import { type SqlValue } from '../driver';
import { tables } from '../mappers';

import {
  findMany,
  getOrThrow,
  insertModel,
  nowIso,
  patchModel,
  softDeleteModel,
  type NewModel,
} from './base';

const spec = tables.workoutTemplates;

export type TemplateFilter = {
  type?: TemplateType | TemplateType[];
  q?: string;
  includeArchived?: boolean;
};

export type TemplateExerciseInput = Omit<
  NewModel<typeof tables.templateExercises>,
  'templateId' | 'orderIndex'
>;
export type TemplateIntervalInput = Omit<
  NewModel<typeof tables.templateIntervals>,
  'templateId' | 'orderIndex'
>;

export type TemplateInput = Omit<NewModel<typeof spec>, 'isSeed' | 'archivedAt'> & {
  exercises?: TemplateExerciseInput[];
  intervals?: TemplateIntervalInput[];
};

export type TemplateDetail = WorkoutTemplate & {
  exercises: TemplateExercise[];
  intervals: TemplateInterval[];
};

async function replaceChildren(tx: Db, templateId: string, input: TemplateInput) {
  if (input.exercises) {
    await tx.run('DELETE FROM workout_template_exercises WHERE template_id = ?', [templateId]);
    for (const [i, e] of input.exercises.entries()) {
      await insertModel(tx, tables.templateExercises, { ...e, templateId, orderIndex: i });
    }
  }
  if (input.intervals) {
    await tx.run('DELETE FROM template_running_intervals WHERE template_id = ?', [templateId]);
    for (const [i, iv] of input.intervals.entries()) {
      await insertModel(tx, tables.templateIntervals, { ...iv, templateId, orderIndex: i });
    }
  }
}

const split = (input: Partial<TemplateInput>) => {
  const { exercises: _e, intervals: _i, ...fields } = input;
  return fields;
};

export function templateRepo(db: Database) {
  const get = async (id: string): Promise<TemplateDetail> => {
    const tpl = await getOrThrow(db, spec, id);
    const exercises = await findMany(
      db,
      tables.templateExercises,
      'template_id = ? AND deleted_at IS NULL',
      [id],
      'ORDER BY order_index',
    );
    const intervals = await findMany(
      db,
      tables.templateIntervals,
      'template_id = ? AND deleted_at IS NULL',
      [id],
      'ORDER BY order_index',
    );
    return { ...tpl, exercises, intervals };
  };

  const create = (input: TemplateInput) =>
    db.tx(async (tx) => {
      const fields = { ...split(input), isSeed: false, archivedAt: null } as NewModel<typeof spec>;
      const tpl = await insertModel(tx, spec, fields);
      await replaceChildren(tx, tpl.id, input);
      return tpl;
    });

  return {
    create,

    async list(filter: TemplateFilter = {}): Promise<WorkoutTemplate[]> {
      const where = ['deleted_at IS NULL'];
      const params: SqlValue[] = [];
      if (!filter.includeArchived) where.push('archived_at IS NULL');
      const types = filter.type === undefined ? [] : ([] as TemplateType[]).concat(filter.type);
      if (types.length) {
        where.push('type IN (' + types.map(() => '?').join(', ') + ')');
        params.push(...types);
      }
      if (filter.q?.trim()) {
        where.push("name LIKE ? ESCAPE '\\'");
        params.push(`%${filter.q.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
      }
      return findMany(db, spec, where.join(' AND '), params, 'ORDER BY updated_at DESC');
    },

    get,

    /**
     * Exercise ids per template and interval counts per running template, for list
     * subtitles ("6 exercises") and availability tags on the Train tab (step 14).
     */
    async summaries(): Promise<{
      exercises: Record<string, string[]>;
      intervals: Record<string, number>;
    }> {
      const ex = await db.all<{ template_id: string; exercise_id: string }>(
        'SELECT template_id, exercise_id FROM workout_template_exercises WHERE deleted_at IS NULL ORDER BY order_index',
      );
      const iv = await db.all<{ template_id: string; n: number }>(
        'SELECT template_id, COUNT(*) AS n FROM template_running_intervals WHERE deleted_at IS NULL GROUP BY template_id',
      );
      const exercises: Record<string, string[]> = {};
      for (const r of ex) (exercises[r.template_id] ??= []).push(r.exercise_id);
      return { exercises, intervals: Object.fromEntries(iv.map((r) => [r.template_id, r.n])) };
    },

    /** Replaces child rows in one transaction. Past executions are unaffected (snapshots). */
    update: (id: string, input: Partial<TemplateInput>) =>
      db.tx(async (tx) => {
        await patchModel(tx, spec, id, split(input));
        await replaceChildren(tx, id, input as TemplateInput);
      }),

    async duplicate(id: string, name?: string): Promise<WorkoutTemplate> {
      const src = await get(id);
      const exercises = src.exercises.map((e): TemplateExerciseInput => ({
        exerciseId: e.exerciseId,
        sets: e.sets,
        targetReps: e.targetReps,
        targetDurationSeconds: e.targetDurationSeconds,
        targetWeightKg: e.targetWeightKg,
        restSeconds: e.restSeconds,
        supersetGroup: e.supersetGroup,
        notes: e.notes,
      }));
      const intervals = src.intervals.map((i): TemplateIntervalInput => ({
        kind: i.kind,
        durationSeconds: i.durationSeconds,
        speedKmh: i.speedKmh,
        inclinePercent: i.inclinePercent,
        label: i.label,
      }));
      return create({
        name: name ?? `${src.name} (copy)`,
        type: src.type,
        description: src.description,
        durationMinutes: src.durationMinutes,
        difficulty: src.difficulty,
        coverKey: src.coverKey,
        distanceTargetKm: src.distanceTargetKm,
        notes: src.notes,
        exercises,
        intervals,
      });
    },

    archive: (id: string) => patchModel(db, spec, id, { archivedAt: nowIso() }),
    unarchive: (id: string) => patchModel(db, spec, id, { archivedAt: null }),

    /**
     * Invariant 5: a template used by any execution is archived, never deleted,
     * so history keeps its context. Returns what actually happened.
     */
    async remove(id: string): Promise<'archived' | 'deleted'> {
      const used = await db.get<{ n: number }>(
        'SELECT COUNT(*) AS n FROM session_executions WHERE template_id = ?',
        [id],
      );
      if ((used?.n ?? 0) > 0) {
        await patchModel(db, spec, id, { archivedAt: nowIso() });
        return 'archived';
      }
      await softDeleteModel(db, spec, id);
      return 'deleted';
    },
  };
}
