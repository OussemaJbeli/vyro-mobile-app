import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { migrations } from '../migrations';
import { migrationChecksum } from '../migrations/checksum';

const LOCK = path.resolve(__dirname, '../migrations/migrations.lock.json');
const current = Object.fromEntries(
  migrations.map((m) => [`${m.id}_${m.name}`, migrationChecksum(m)]),
);

/**
 * Migrations are append-only (FS §50). This test fails if a locked migration's SQL changed.
 * After adding a NEW migration run `pnpm db:lock` to record it.
 */
describe('migration lock', () => {
  if (process.env.UPDATE_MIGRATION_LOCK === '1') {
    it('writes the lock file', () => {
      writeFileSync(LOCK, `${JSON.stringify(current, null, 2)}\n`);
    });
    return;
  }

  it('matches every recorded checksum and records every migration', () => {
    const locked = JSON.parse(readFileSync(LOCK, 'utf8')) as Record<string, string>;
    for (const [key, sum] of Object.entries(locked)) {
      expect({ key, sum: current[key] }).toEqual({ key, sum });
    }
    expect(Object.keys(current).sort()).toEqual(Object.keys(locked).sort());
  });
});
