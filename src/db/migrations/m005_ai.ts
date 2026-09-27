import { type Migration } from './types';

/**
 * AI layer (step 31): cached insights (keyed by payload hash), suggestions the user can
 * apply or ignore, and coach chat messages. Excluded from backups by default.
 */
export const m005_ai: Migration = {
  id: 5,
  name: 'ai',
  statements: [
    `CREATE TABLE ai_insights (
      id TEXT PRIMARY KEY, kind TEXT NOT NULL, period_start TEXT, period_end TEXT,
      provider TEXT NOT NULL, model TEXT NOT NULL, prompt_version TEXT NOT NULL,
      payload_hash TEXT NOT NULL, response_json TEXT NOT NULL,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
    )`,
    'CREATE INDEX idx_ai_insights_hash ON ai_insights(payload_hash)',
    `CREATE TABLE ai_suggestions (
      id TEXT PRIMARY KEY, insight_id TEXT REFERENCES ai_insights(id),
      kind TEXT NOT NULL, payload TEXT NOT NULL, rationale TEXT,
      status TEXT NOT NULL CHECK (status IN ('pending','applied','ignored','expired')),
      decided_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
    )`,
    'CREATE INDEX idx_ai_suggestions_insight ON ai_suggestions(insight_id)',
    `CREATE TABLE ai_messages (
      id TEXT PRIMARY KEY, thread_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user','assistant')),
      content TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
    )`,
    'CREATE INDEX idx_ai_messages_thread ON ai_messages(thread_id, created_at)',
  ],
};
