import { type BodyMeasurement, type MeasurementType, type WeightEntry } from '@/types/domain';
import { type MEASUREMENT_UNITS } from '@/types/enums';

import { type Database } from '../client';
import { type SqlValue } from '../driver';
import { fromRow, tables } from '../mappers';

import {
  columns,
  findMany,
  insertModel,
  nowIso,
  pageByTime,
  patchModel,
  softDeleteModel,
  type NewModel,
  type Page,
} from './base';

const weights = tables.weightEntries;
const types = tables.measurementTypes;
const measurements = tables.bodyMeasurements;

export type Range = { from?: string; to?: string };

function rangeWhere(
  column: string,
  range: Range,
  base: string[],
): { where: string; params: SqlValue[] } {
  const where = [...base];
  const params: SqlValue[] = [];
  if (range.from) {
    where.push(column + ' >= ?');
    params.push(range.from);
  }
  if (range.to) {
    where.push(column + ' <= ?');
    params.push(range.to);
  }
  return { where: where.join(' AND '), params };
}

export function weightRepo(db: Database) {
  return {
    /** Chronological entries in a range (charts). */
    list: (range: Range = {}): Promise<WeightEntry[]> => {
      const { where, params } = rangeWhere('recorded_at', range, ['deleted_at IS NULL']);
      return findMany(db, weights, where, params, 'ORDER BY recorded_at');
    },
    /** Newest first, paginated (history list). */
    page: (cursor: string | null = null, limit = 50): Promise<Page<WeightEntry>> =>
      pageByTime(db, weights, 'recorded_at', 'deleted_at IS NULL', [], cursor, limit),
    latest: (n = 1): Promise<WeightEntry[]> =>
      findMany(db, weights, 'deleted_at IS NULL', [n], 'ORDER BY recorded_at DESC LIMIT ?'),
    create: (input: NewModel<typeof weights>) => insertModel(db, weights, input),
    update: (id: string, patch: Partial<NewModel<typeof weights>>) =>
      patchModel(db, weights, id, patch),
    softDelete: (id: string) => softDeleteModel(db, weights, id),
  };
}

export type MeasurementEntryInput = {
  measurementTypeId: string;
  value: number;
  unitEntered: (typeof MEASUREMENT_UNITS)[number];
  notes?: string | null;
};

export function measurementRepo(db: Database) {
  return {
    types: {
      list: (includeArchived = false): Promise<MeasurementType[]> =>
        findMany(
          db,
          types,
          includeArchived ? 'deleted_at IS NULL' : 'deleted_at IS NULL AND archived_at IS NULL',
          [],
          'ORDER BY order_index, name COLLATE NOCASE',
        ),
      create: (input: Omit<NewModel<typeof types>, 'isCustom' | 'archivedAt'>) =>
        insertModel(db, types, { ...input, isCustom: true, archivedAt: null }),
      update: (id: string, patch: Partial<NewModel<typeof types>>) =>
        patchModel(db, types, id, patch),
      archive: (id: string) => patchModel(db, types, id, { archivedAt: nowIso() }),
      reorder: (orderedIds: string[]) =>
        db.tx(async (tx) => {
          for (const [i, id] of orderedIds.entries())
            await patchModel(tx, types, id, { orderIndex: i });
        }),
    },

    list: (typeId: string, range: Range = {}): Promise<BodyMeasurement[]> => {
      const { where, params } = rangeWhere('recorded_at', range, [
        'deleted_at IS NULL',
        'measurement_type_id = ?',
      ]);
      return findMany(db, measurements, where, [typeId, ...params], 'ORDER BY recorded_at');
    },

    /** Every entry in a range, all types (history timeline). */
    between: (range: Range): Promise<BodyMeasurement[]> => {
      const { where, params } = rangeWhere('recorded_at', range, ['deleted_at IS NULL']);
      return findMany(db, measurements, where, params, 'ORDER BY recorded_at DESC');
    },

    /** Latest active entry for each measurement type. */
    async latestPerType(): Promise<BodyMeasurement[]> {
      const rows = await db.all<Record<string, unknown>>(
        'SELECT ' +
          columns(measurements, 'm') +
          ' FROM body_measurements m WHERE m.deleted_at IS NULL AND m.recorded_at = (' +
          'SELECT MAX(recorded_at) FROM body_measurements x WHERE x.measurement_type_id = m.measurement_type_id AND x.deleted_at IS NULL)',
      );
      return rows.map((r) => fromRow(measurements, r));
    },

    /** A measurement session: every filled field saved together with one timestamp. */
    createSession: (entries: MeasurementEntryInput[], recordedAt: string = nowIso()) =>
      db.tx(async (tx) => {
        const out: BodyMeasurement[] = [];
        for (const e of entries) {
          out.push(
            await insertModel(tx, measurements, { ...e, notes: e.notes ?? null, recordedAt }),
          );
        }
        return out;
      }),

    update: (id: string, patch: Partial<NewModel<typeof measurements>>) =>
      patchModel(db, measurements, id, patch),
    softDelete: (id: string) => softDeleteModel(db, measurements, id),
  };
}
