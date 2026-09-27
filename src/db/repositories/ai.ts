import { newId } from '@/utils/id';

import { type Database } from '../client';

import { nowIso } from './base';

export type StoredSuggestion = {
  id: string;
  insightId: string;
  kind: string;
  payload: string;
  rationale: string | null;
  status: 'pending' | 'applied' | 'ignored' | 'expired';
};

export type StoredInsight = {
  id: string;
  kind: string;
  provider: string;
  model: string;
  createdAt: string;
  periodStart: string | null;
  periodEnd: string | null;
  responseJson: string;
};

type InsightRow = {
  id: string;
  kind: string;
  provider: string;
  model: string;
  created_at: string;
  period_start: string | null;
  period_end: string | null;
  response_json: string;
};
const COLS = 'id, kind, provider, model, created_at, period_start, period_end, response_json';
const toInsight = (r: InsightRow): StoredInsight => ({
  id: r.id,
  kind: r.kind,
  provider: r.provider,
  model: r.model,
  createdAt: r.created_at,
  periodStart: r.period_start,
  periodEnd: r.period_end,
  responseJson: r.response_json,
});

/** AI persistence (step 31). Raw SQL: these tables are local caches, not synced domain data. */
export function aiRepo(db: Database) {
  return {
    async insightByHash(hash: string): Promise<StoredInsight | null> {
      const row = await db.get<InsightRow>(
        'SELECT ' +
          COLS +
          ' FROM ai_insights WHERE payload_hash = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1',
        [hash],
      );
      return row ? toInsight(row) : null;
    },

    async latestInsight(kind: string): Promise<StoredInsight | null> {
      const row = await db.get<InsightRow>(
        'SELECT ' +
          COLS +
          ' FROM ai_insights WHERE kind = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1',
        [kind],
      );
      return row ? toInsight(row) : null;
    },

    async insight(id: string): Promise<StoredInsight | null> {
      const row = await db.get<InsightRow>(
        'SELECT ' + COLS + ' FROM ai_insights WHERE id = ? AND deleted_at IS NULL',
        [id],
      );
      return row ? toInsight(row) : null;
    },

    /** Coach "Recent reports", with how many suggestions were applied. */
    async recentInsights(limit = 10): Promise<(StoredInsight & { applied: number })[]> {
      const rows = await db.all<InsightRow & { applied: number }>(
        'SELECT i.id, i.kind, i.provider, i.model, i.created_at, i.period_start, i.period_end, i.response_json, ' +
          "(SELECT COUNT(*) FROM ai_suggestions s WHERE s.insight_id = i.id AND s.status = 'applied') AS applied " +
          'FROM ai_insights i WHERE i.deleted_at IS NULL ORDER BY i.created_at DESC LIMIT ?',
        [limit],
      );
      return rows.map((r) => ({ ...toInsight(r), applied: r.applied }));
    },

    async saveInsight(input: {
      kind: string;
      periodStart: string | null;
      periodEnd: string | null;
      provider: string;
      model: string;
      promptVersion: string;
      payloadHash: string;
      responseJson: string;
      suggestions: { kind: string; payload: string; rationale: string }[];
    }): Promise<{ id: string; suggestionIds: string[] }> {
      const id = newId();
      const at = nowIso();
      const suggestionIds: string[] = [];
      await db.tx(async (tx) => {
        await tx.run(
          'INSERT INTO ai_insights (id, kind, period_start, period_end, provider, model, prompt_version, payload_hash, response_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            id,
            input.kind,
            input.periodStart,
            input.periodEnd,
            input.provider,
            input.model,
            input.promptVersion,
            input.payloadHash,
            input.responseJson,
            at,
            at,
          ],
        );
        for (const s of input.suggestions) {
          const sid = newId();
          suggestionIds.push(sid);
          await tx.run(
            "INSERT INTO ai_suggestions (id, insight_id, kind, payload, rationale, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)",
            [sid, id, s.kind, s.payload, s.rationale, at, at],
          );
        }
      });
      return { id, suggestionIds };
    },

    async suggestions(insightId: string): Promise<StoredSuggestion[]> {
      const rows = await db.all<{
        id: string;
        insight_id: string;
        kind: string;
        payload: string;
        rationale: string | null;
        status: StoredSuggestion['status'];
      }>(
        'SELECT id, insight_id, kind, payload, rationale, status FROM ai_suggestions WHERE insight_id = ? AND deleted_at IS NULL ORDER BY created_at, id',
        [insightId],
      );
      return rows.map((r) => ({
        id: r.id,
        insightId: r.insight_id,
        kind: r.kind,
        payload: r.payload,
        rationale: r.rationale,
        status: r.status,
      }));
    },

    async getSuggestion(id: string): Promise<StoredSuggestion | null> {
      const r = await db.get<{
        id: string;
        insight_id: string;
        kind: string;
        payload: string;
        rationale: string | null;
        status: StoredSuggestion['status'];
      }>(
        'SELECT id, insight_id, kind, payload, rationale, status FROM ai_suggestions WHERE id = ?',
        [id],
      );
      return r
        ? {
            id: r.id,
            insightId: r.insight_id,
            kind: r.kind,
            payload: r.payload,
            rationale: r.rationale,
            status: r.status,
          }
        : null;
    },

    setSuggestionStatus: (id: string, status: StoredSuggestion['status']) => {
      const at = nowIso();
      return db.run(
        'UPDATE ai_suggestions SET status = ?, decided_at = ?, updated_at = ? WHERE id = ?',
        [status, at, at, id],
      );
    },

    async addMessage(threadId: string, role: 'user' | 'assistant', content: string) {
      const at = nowIso();
      await db.run(
        'INSERT INTO ai_messages (id, thread_id, role, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [newId(), threadId, role, content, at, at],
      );
    },

    messages: (threadId: string) =>
      db.all<{ role: 'user' | 'assistant'; content: string }>(
        'SELECT role, content FROM ai_messages WHERE thread_id = ? AND deleted_at IS NULL ORDER BY created_at, rowid',
        [threadId],
      ),

    /** Chat threads, newest first, with their last message. */
    threads: () =>
      db.all<{ threadId: string; last: string; at: string; count: number }>(
        'SELECT m.thread_id AS threadId, COUNT(*) AS count, MAX(m.created_at) AS at, ' +
          "(SELECT content FROM ai_messages x WHERE x.thread_id = m.thread_id AND x.role = 'user' AND x.deleted_at IS NULL ORDER BY x.created_at DESC, x.rowid DESC LIMIT 1) AS last " +
          'FROM ai_messages m WHERE m.deleted_at IS NULL GROUP BY m.thread_id ORDER BY at DESC',
      ),

    deleteThread: (threadId: string) =>
      db.run('DELETE FROM ai_messages WHERE thread_id = ?', [threadId]),

    /** "Delete AI history" in Settings → AI. */
    clearAll: () =>
      db.tx(async (tx) => {
        await tx.run('DELETE FROM ai_suggestions');
        await tx.run('DELETE FROM ai_insights');
        await tx.run('DELETE FROM ai_messages');
      }),
  };
}

export type AIRepo = ReturnType<typeof aiRepo>;
