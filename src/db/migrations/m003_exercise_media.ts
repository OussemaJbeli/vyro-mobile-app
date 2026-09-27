import { type Migration } from './types';

/**
 * Exercise media (owner request after step 28): images and GIFs (private files, relative
 * paths — AD-13) and video links (YouTube or any https URL) per exercise, seeded or custom.
 */
export const m003_exercise_media: Migration = {
  id: 3,
  name: 'exercise_media',
  statements: [
    `
      CREATE TABLE exercise_media (
        id TEXT PRIMARY KEY,
        exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
        kind TEXT NOT NULL CHECK (kind IN ('image', 'gif', 'video')),
        file_path TEXT,
        url TEXT,
        order_index INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT,
        CHECK ((kind = 'video' AND url IS NOT NULL) OR (kind <> 'video' AND file_path IS NOT NULL))
      )
    `,
    'CREATE INDEX idx_media_exercise ON exercise_media(exercise_id, order_index) WHERE deleted_at IS NULL',
  ],
};
