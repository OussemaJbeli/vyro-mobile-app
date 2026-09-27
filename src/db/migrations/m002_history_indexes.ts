import { type Migration } from './types';

/**
 * Step 28 performance: indexes for the unified history timeline (measurements across all
 * types by date) and the photo gallery (all photos by capture date). Found with
 * EXPLAIN QUERY PLAN on the demo dataset.
 */
export const m002_history_indexes: Migration = {
  id: 2,
  name: 'history_indexes',
  statements: [
    'CREATE INDEX idx_measure_recorded ON body_measurements(recorded_at) WHERE deleted_at IS NULL',
    'CREATE INDEX idx_photos_captured ON progress_photos(captured_at) WHERE deleted_at IS NULL',
  ],
};
