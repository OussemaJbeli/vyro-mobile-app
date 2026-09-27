/**
 * Shared repository helpers (step 10). Repositories are the only code that runs SQL.
 * Table and column names always come from the static registry; values are always bound.
 */
import { type z } from 'zod';

import { now } from '@/utils/clock';
import { AppError } from '@/utils/errors';
import { newId } from '@/utils/id';

import { type Db } from '../client';
import { type SqlValue } from '../driver';
import { fromRow, toRow, type TableSpec } from '../mappers';

type AnySpec = TableSpec;
type ModelOf<S extends AnySpec> = z.infer<S['schema']>;

export const nowIso = (): string => now().toISOString();

const snake = (k: string) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

/** Explicit column list for SELECTs (never SELECT *). */
export function columns(spec: AnySpec, alias?: string): string {
  return Object.keys(spec.schema.shape)
    .map((f) => (alias ? `${alias}.${snake(f)}` : snake(f)))
    .join(', ');
}

export type Page<T> = { items: T[]; nextCursor: string | null };

/** System columns filled by the repository, not the caller. */
export type NewModel<S extends AnySpec> = Omit<
  ModelOf<S>,
  'id' | 'createdAt' | 'updatedAt' | 'deletedAt'
>;

export async function insertModel<S extends AnySpec>(
  db: Db,
  spec: S,
  input: NewModel<S>,
  opts: { id?: string; at?: string } = {},
): Promise<ModelOf<S>> {
  const at = opts.at ?? nowIso();
  const model = { ...input, id: opts.id ?? newId(), createdAt: at, updatedAt: at, deletedAt: null };
  const row = toRow(spec, model as ModelOf<S>);
  const cols = Object.keys(row);
  await db.run(
    'INSERT INTO ' +
      spec.table +
      ' (' +
      cols.join(', ') +
      ') VALUES (' +
      cols.map(() => '?').join(', ') +
      ')',
    Object.values(row),
  );
  return model as ModelOf<S>;
}

/** Partial update of an active row; bumps updated_at. Throws NOT_FOUND when nothing changed. */
export async function patchModel<S extends AnySpec>(
  db: Db,
  spec: S,
  id: string,
  patch: Partial<NewModel<S>> & { deletedAt?: string | null },
  opts: { includeDeleted?: boolean } = {},
): Promise<void> {
  const row = toRow(spec, { ...patch, updatedAt: nowIso() } as unknown as Partial<ModelOf<S>>, {
    partial: true,
  });
  delete row.id;
  delete row.created_at;
  const cols = Object.keys(row);
  const res = await db.run(
    'UPDATE ' +
      spec.table +
      ' SET ' +
      cols.map((c) => c + ' = ?').join(', ') +
      ' WHERE id = ?' +
      (opts.includeDeleted ? '' : ' AND deleted_at IS NULL'),
    [...Object.values(row), id],
  );
  if (res.changes === 0) throw new AppError('NOT_FOUND', `${spec.table} ${id} not found`);
}

export async function softDeleteModel(db: Db, spec: AnySpec, id: string): Promise<void> {
  const at = nowIso();
  const res = await db.run(
    'UPDATE ' +
      spec.table +
      ' SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL',
    [at, at, id],
  );
  if (res.changes === 0) throw new AppError('NOT_FOUND', `${spec.table} ${id} not found`);
}

export async function findById<S extends AnySpec>(
  db: Db,
  spec: S,
  id: string,
  opts: { includeDeleted?: boolean } = {},
): Promise<ModelOf<S> | null> {
  const row = await db.get<Record<string, unknown>>(
    'SELECT ' +
      columns(spec) +
      ' FROM ' +
      spec.table +
      ' WHERE id = ?' +
      (opts.includeDeleted ? '' : ' AND deleted_at IS NULL'),
    [id],
  );
  return row ? (fromRow(spec, row) as ModelOf<S>) : null;
}

export async function getOrThrow<S extends AnySpec>(
  db: Db,
  spec: S,
  id: string,
): Promise<ModelOf<S>> {
  const model = await findById(db, spec, id);
  if (!model) throw new AppError('NOT_FOUND', `${spec.table} ${id} not found`);
  return model;
}

/**
 * SELECT with a static WHERE/ORDER fragment written by the repository (never user text)
 * and bound parameters.
 */
export async function findMany<S extends AnySpec>(
  db: Db,
  spec: S,
  where: string,
  params: SqlValue[] = [],
  tail = '',
): Promise<ModelOf<S>[]> {
  const rows = await db.all<Record<string, unknown>>(
    'SELECT ' +
      columns(spec) +
      ' FROM ' +
      spec.table +
      (where ? ' WHERE ' + where : '') +
      (tail ? ' ' + tail : ''),
    params,
  );
  return rows.map((r) => fromRow(spec, r) as ModelOf<S>);
}

/**
 * Cursor pagination on a descending time column (FS §62). The cursor is "time|id" so
 * rows sharing a timestamp are neither skipped nor repeated.
 */
export async function pageByTime<S extends AnySpec>(
  db: Db,
  spec: S,
  timeColumn: string,
  where: string,
  params: SqlValue[],
  cursor: string | null,
  limit: number,
): Promise<Page<ModelOf<S>>> {
  const conds = [where];
  const args = [...params];
  if (cursor) {
    const sep = cursor.lastIndexOf('|');
    const [t, id] = [cursor.slice(0, sep), cursor.slice(sep + 1)];
    conds.push('(' + timeColumn + ' < ? OR (' + timeColumn + ' = ? AND id < ?))');
    args.push(t, t, id);
  }
  const items = await findMany(
    db,
    spec,
    conds.filter(Boolean).join(' AND '),
    [...args, limit + 1],
    'ORDER BY ' + timeColumn + ' DESC, id DESC LIMIT ?',
  );
  const hasMore = items.length > limit;
  const page = hasMore ? items.slice(0, limit) : items;
  const last = page.at(-1) as Record<string, unknown> | undefined;
  const timeField = timeColumn.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
  return {
    items: page,
    nextCursor: hasMore && last ? `${String(last[timeField])}|${String(last.id)}` : null,
  };
}
