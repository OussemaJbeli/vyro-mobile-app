import { type NotificationSchedule } from '@/types/domain';

import { type Database } from '../client';
import { tables } from '../mappers';

import { findMany, insertModel, type NewModel } from './base';

const spec = tables.notificationSchedules;

/** OS notification id mapping for the reconcile engine (step 25). Rows are disposable. */
export function notificationRepo(db: Database) {
  return {
    all: (): Promise<NotificationSchedule[]> =>
      findMany(db, spec, 'deleted_at IS NULL', [], 'ORDER BY fire_at'),
    byTarget: (targetId: string) =>
      findMany(db, spec, 'deleted_at IS NULL AND target_id = ?', [targetId]),
    insert: (input: NewModel<typeof spec>) => insertModel(db, spec, input),
    deleteByOsId: (osNotificationId: string) =>
      db.run('DELETE FROM notification_schedules WHERE os_notification_id = ?', [osNotificationId]),
    deleteByTarget: (targetId: string) =>
      db.run('DELETE FROM notification_schedules WHERE target_id = ?', [targetId]),
    clear: () => db.run('DELETE FROM notification_schedules'),
  };
}
