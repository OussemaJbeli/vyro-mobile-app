import { type Goal } from '@/types/domain';
import { type GOAL_STATUSES } from '@/types/enums';

import { type Db } from '../client';
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

const spec = tables.goals;
type Status = (typeof GOAL_STATUSES)[number];

/** Goals are historical (FS §9): status changes, never hard deletes. */
export function goalRepo(db: Db) {
  return {
    list: (status?: Status): Promise<Goal[]> =>
      status
        ? findMany(
            db,
            spec,
            'deleted_at IS NULL AND status = ?',
            [status],
            'ORDER BY created_at DESC',
          )
        : findMany(
            db,
            spec,
            'deleted_at IS NULL',
            [],
            "ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END, created_at DESC",
          ),
    get: (id: string) => getOrThrow(db, spec, id),
    create: (input: NewModel<typeof spec>) => insertModel(db, spec, input),
    update: (id: string, patch: Partial<NewModel<typeof spec>>) => patchModel(db, spec, id, patch),
    setStatus: (id: string, status: Status) =>
      patchModel(db, spec, id, { status, achievedAt: status === 'achieved' ? nowIso() : null }),
    softDelete: (id: string) => softDeleteModel(db, spec, id),
  };
}
