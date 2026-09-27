import { bytesToHex } from '@noble/hashes/utils.js';
import { sha256 } from '@noble/hashes/sha2.js';

import { type Database } from '@/db/client';
import { aiRepo, type StoredInsight } from '@/db/repositories/ai';
import { scheduleRepo } from '@/db/repositories/schedule';
import { templateRepo } from '@/db/repositories/templates';
import { detectConflicts } from '@/domain/scheduling/conflicts';
import { addDaysIso, weekStart } from '@/domain/scheduling/recurrence';

import { loadCoachData } from './data';
import { parseInsight } from './parser';
import { PROMPT_VERSION, systemPrompt, userPrompt, type PromptPrefs } from './prompts';
import { guardWording } from './prompts/wording';
import {
  INSIGHT_JSON_SCHEMA,
  addRestPayload,
  moveSessionPayload,
  replaceExercisePayload,
  type Insight,
} from './schemas';
import { buildPayload, stableStringify, type AIMethod, type Extra } from './summarizer';
import { AIError, err, ok, type AIProvider, type ProviderId, type Result } from './types';

export type AIConfig = {
  enabled: boolean;
  provider: ProviderId;
  model: string;
  prefs: PromptPrefs;
  includeNotes: boolean;
};

export type Deps = {
  db: Database;
  config: () => AIConfig;
  /** Builds the provider (key read from SecureStore); null when no key is saved. */
  provider: (config: AIConfig) => Promise<AIProvider | null>;
  isOnline: () => Promise<boolean>;
  today: () => string;
};

export type Prepared = {
  method: AIMethod;
  period: { start: string; end: string } | null;
  payload: unknown;
  /** Exactly what is sent (pretty JSON) for the "What will be sent" preview. */
  preview: string;
  hash: string;
};

export type InsightResult = {
  insightId: string;
  kind: string;
  insight: Insight;
  suggestionIds: string[];
  cached: boolean;
  provider: string;
  model: string;
  /** Data period the report is based on ("Based on your recorded data from …"). */
  period: { start: string; end: string } | null;
  createdAt: string;
  /** Token usage when the provider reports it (fresh answers only). */
  usage: { inputTokens?: number | undefined; outputTokens?: number | undefined } | null;
};

export type SuggestionPreview = {
  canApply: boolean;
  description: string;
  warnings: string[];
  /** Exact before/after (the day's plan or the workout's exercises). */
  diff: { before: string[]; after: string[] } | null;
};

const MAX_TOKENS = 16_000;

/**
 * The only entry point to AI (AD-18, FS §40). Two phases so the UI can show the payload
 * before anything is sent: `prepare` (local, no network) → `run` (network, on tap).
 */
export function createAIService(deps: Deps) {
  const repo = aiRepo(deps.db);

  const periodFor = (method: AIMethod, range?: { start: string; end: string }) => {
    if (range) return range;
    const today = deps.today();
    if (method === 'summarizeWeek' || method === 'chat') {
      const start = weekStart(today, 1);
      return { start, end: addDaysIso(start, 6) };
    }
    if (method === 'adaptWorkout' || method === 'suggestAlternative') return null;
    return { start: addDaysIso(today, -27), end: today };
  };

  async function prepare(
    method: AIMethod,
    opts: { range?: { start: string; end: string }; extra?: Extra } = {},
  ): Promise<Prepared> {
    const cfg = deps.config();
    const today = deps.today();
    const period = periodFor(method, opts.range);
    const data = await loadCoachData(deps.db, {
      start: period?.start ?? today,
      end: period?.end ?? today,
      today,
      includeNotes: cfg.includeNotes,
    });
    const payload = buildPayload(method, data, today, opts.extra);
    const canonical = stableStringify(payload);
    const hash = bytesToHex(
      sha256(
        new TextEncoder().encode(
          [
            method,
            cfg.provider,
            cfg.model,
            PROMPT_VERSION,
            cfg.prefs.tone,
            cfg.prefs.language,
            canonical,
          ].join('|'),
        ),
      ),
    );
    return { method, period, payload, preview: JSON.stringify(payload, null, 2), hash };
  }

  async function ready(): Promise<Result<{ provider: AIProvider; cfg: AIConfig }>> {
    const cfg = deps.config();
    if (!cfg.enabled) return err(new AIError('disabled', 'AI is off'));
    const provider = await deps.provider(cfg);
    if (!provider) return err(new AIError('no_key', 'No API key'));
    if (cfg.provider !== 'mock' && !(await deps.isOnline())) {
      return err(new AIError('offline', 'No connection'));
    }
    return ok({ provider, cfg });
  }

  async function run(
    prepared: Prepared,
    { refresh = false, signal }: { refresh?: boolean; signal?: AbortSignal } = {},
  ): Promise<Result<InsightResult>> {
    if (!refresh) {
      const cached = await repo.insightByHash(prepared.hash);
      const parsed = cached ? parseInsight(cached.responseJson) : null;
      if (cached && parsed?.ok) {
        return ok(await toResult(cached, parsed.value, true));
      }
    }
    const r = await ready();
    if (!r.ok) return r;
    const { provider, cfg } = r.value;
    const system = systemPrompt(prepared.method, cfg.prefs, true);
    const messages = [
      { role: 'user' as const, content: userPrompt(stableStringify(prepared.payload)) },
    ];
    const first = await provider.complete({
      system,
      messages,
      jsonSchema: INSIGHT_JSON_SCHEMA,
      maxTokens: MAX_TOKENS,
      ...(signal ? { signal } : {}),
    });
    if (!first.ok) return first;
    let parsed = parseInsight(first.value.text);
    if (!parsed.ok) {
      // One repair retry: show the model its answer and the validation problem.
      const repair = await provider.complete({
        system,
        messages: [
          ...messages,
          { role: 'assistant', content: first.value.text },
          {
            role: 'user',
            content: `That answer did not match the schema (${parsed.reason}). Reply again with valid JSON only.`,
          },
        ],
        jsonSchema: INSIGHT_JSON_SCHEMA,
        maxTokens: MAX_TOKENS,
        ...(signal ? { signal } : {}),
      });
      if (!repair.ok) return repair;
      parsed = parseInsight(repair.value.text);
      if (!parsed.ok) return err(new AIError('bad_response', parsed.reason));
    }
    const insight = guardWording(parsed.value, cfg.prefs.language);
    const saved = await repo.saveInsight({
      kind: prepared.method,
      periodStart: prepared.period?.start ?? null,
      periodEnd: prepared.period?.end ?? null,
      provider: provider.id,
      model: provider.model,
      promptVersion: PROMPT_VERSION,
      payloadHash: prepared.hash,
      responseJson: JSON.stringify(insight),
      suggestions: insight.suggestions,
    });
    return ok({
      insightId: saved.id,
      kind: prepared.method,
      insight,
      suggestionIds: saved.suggestionIds,
      cached: false,
      provider: provider.id,
      model: provider.model,
      period: prepared.period,
      createdAt: new Date().toISOString(),
      usage: first.value.usage ?? null,
    });
  }

  async function toResult(stored: StoredInsight, insight: Insight, cached: boolean) {
    const suggestions = await repo.suggestions(stored.id);
    return {
      insightId: stored.id,
      kind: stored.kind,
      insight,
      suggestionIds: suggestions.map((s) => s.id),
      cached,
      provider: stored.provider,
      model: stored.model,
      period:
        stored.periodStart && stored.periodEnd
          ? { start: stored.periodStart, end: stored.periodEnd }
          : null,
      createdAt: stored.createdAt,
      usage: null,
    } satisfies InsightResult;
  }

  /** A saved report (Coach "Recent reports"). */
  async function report(id: string): Promise<InsightResult | null> {
    const stored = await repo.insight(id);
    const parsed = stored ? parseInsight(stored.responseJson) : null;
    return stored && parsed?.ok ? toResult(stored, parsed.value, true) : null;
  }

  /** Coach chat: the week summary as context + the thread history. Plain text answer. */
  async function chat(
    threadId: string,
    message: string,
    signal?: AbortSignal,
  ): Promise<Result<string>> {
    const r = await ready();
    if (!r.ok) return r;
    const { provider, cfg } = r.value;
    const context = await prepare('chat', { extra: { question: message } });
    const history = await repo.messages(threadId);
    const res = await provider.complete({
      system: systemPrompt('chat', cfg.prefs, false),
      messages: [
        ...history.slice(-10),
        { role: 'user', content: `${userPrompt(stableStringify(context.payload))}\n${message}` },
      ],
      maxTokens: MAX_TOKENS,
      ...(signal ? { signal } : {}),
    });
    if (!res.ok) return res;
    await repo.addMessage(threadId, 'user', message);
    await repo.addMessage(threadId, 'assistant', res.value.text);
    return ok(res.value.text);
  }

  async function testConnection(signal?: AbortSignal): Promise<Result<void>> {
    const r = await ready();
    if (!r.ok) return r;
    return r.value.provider.testConnection(signal);
  }

  const sessionLine = (x: { title: string; startTime: string | null; type: string }) =>
    x.type === 'rest' ? 'Rest' : `${x.startTime ?? '--:--'}  ${x.title}`;

  /** Marks a suggestion whose target changed as expired (with a note for the UI). */
  const expire = async (id: string, note: string): Promise<SuggestionPreview> => {
    await repo.setSuggestionStatus(id, 'expired');
    return { canApply: false, description: note, warnings: [note], diff: null };
  };

  /**
   * Local re-validation + the exact diff preview. Nothing is written here (except marking
   * a stale suggestion as expired).
   */
  async function previewSuggestion(id: string): Promise<SuggestionPreview> {
    const s = await repo.getSuggestion(id);
    const none = { canApply: false, description: '', warnings: [], diff: null };
    if (!s) return none;
    if (s.status !== 'pending') return { ...none, description: `Already ${s.status}.` };
    const schedule = scheduleRepo(deps.db);
    const today = deps.today();
    let raw: unknown;
    try {
      raw = JSON.parse(s.payload || '{}');
    } catch {
      return expire(id, 'This suggestion is unreadable.');
    }
    if (s.kind === 'move_session') {
      const p = moveSessionPayload.safeParse(raw);
      if (!p.success) return expire(id, 'This suggestion is incomplete.');
      const session = (await schedule.sessionsForRange(today, addDaysIso(today, 60))).find(
        (x) => x.id === p.data.sessionId,
      );
      if (!session || session.status !== 'planned') {
        return expire(id, 'That session changed since the suggestion was made.');
      }
      if (p.data.date < today) return expire(id, 'The suggested date is already past.');
      const time = p.data.startTime === undefined ? session.startTime : p.data.startTime;
      const target = await schedule.sessionsForDate(p.data.date);
      const conflicts = detectConflicts(
        { ...session, scheduledDate: p.data.date, startTime: time },
        target,
      );
      const moved = { ...session, scheduledDate: p.data.date, startTime: time };
      const after = [...target.filter((x) => x.id !== session.id), moved].sort((a, b) =>
        (a.startTime ?? '99').localeCompare(b.startTime ?? '99'),
      );
      return {
        canApply: true,
        description: `${session.title}: ${session.scheduledDate} ${session.startTime ?? ''} → ${p.data.date} ${time ?? ''}`,
        warnings: conflicts.map((c) =>
          c.kind === 'rest_day'
            ? 'The target day is a rest day.'
            : c.kind === 'heavy_day'
              ? `Busy day: ${c.sessions} sessions, ${c.minutes} min.`
              : `Overlaps ${c.with.title}.`,
        ),
        diff: {
          before: [`${p.data.date}:`, ...target.map(sessionLine)],
          after: [`${p.data.date}:`, ...after.map(sessionLine)],
        },
      };
    }
    if (s.kind === 'add_rest') {
      const p = addRestPayload.safeParse(raw);
      if (!p.success || p.data.date < today) return expire(id, 'The suggested date is not valid.');
      const day = await schedule.sessionsForDate(p.data.date);
      return {
        canApply: true,
        description: `Rest day on ${p.data.date}`,
        warnings: day.some((x) => x.type !== 'rest' && x.status === 'planned')
          ? ['Planned sessions that day stay; skip them if you rest.']
          : [],
        diff: {
          before: [`${p.data.date}:`, ...day.map(sessionLine)],
          after: [`${p.data.date}:`, ...day.map(sessionLine), 'Rest'],
        },
      };
    }
    if (s.kind === 'replace_exercise') {
      const p = replaceExercisePayload.safeParse(raw);
      if (!p.success) return expire(id, 'This suggestion is incomplete.');
      const tpl = await templateRepo(deps.db)
        .get(p.data.templateId)
        .catch(() => null);
      const rows = await deps.db.all<{ id: string; name: string; missing: number }>(
        'SELECT e.id, e.name, (SELECT COUNT(*) FROM exercise_equipment ee JOIN equipment q ON q.id = ee.equipment_id ' +
          'WHERE ee.exercise_id = e.id AND q.available = 0) AS missing FROM exercises e WHERE e.deleted_at IS NULL',
      );
      const names = new Map(rows.map((r) => [r.id, r]));
      const from = names.get(p.data.fromExerciseId);
      const to = names.get(p.data.toExerciseId);
      if (!tpl || !from || !to || !tpl.exercises.some((e) => e.exerciseId === from.id)) {
        return expire(id, 'The workout or exercise changed since the suggestion was made.');
      }
      const line = (exerciseId: string, sets: number, reps: number | null) =>
        `${names.get(exerciseId)?.name ?? '?'} · ${sets} × ${reps ?? '—'}`;
      return {
        canApply: true,
        description: `${tpl.name}: ${from.name} → ${to.name}`,
        warnings: to.missing ? ['You marked some of its equipment as unavailable.'] : [],
        diff: {
          before: tpl.exercises.map((e) => line(e.exerciseId, e.sets, e.targetReps)),
          after: tpl.exercises.map((e) =>
            line(e.exerciseId === from.id ? to.id : e.exerciseId, e.sets, e.targetReps),
          ),
        },
      };
    }
    return { ...none, description: s.rationale ?? '' };
  }

  /**
   * Applies a suggestion on the user's tap, through the normal repositories only, and
   * returns an undo that restores the previous state (within the session).
   */
  async function applySuggestion(id: string): Promise<Result<{ undo: () => Promise<void> }>> {
    const check = await previewSuggestion(id);
    if (!check.canApply)
      return err(new AIError('bad_response', check.warnings[0] ?? 'Not applicable'));
    const s = (await repo.getSuggestion(id))!;
    const raw = JSON.parse(s.payload) as unknown;
    const schedule = scheduleRepo(deps.db);
    let undo: () => Promise<void> = async () => {};
    if (s.kind === 'move_session') {
      const p = moveSessionPayload.parse(raw);
      const before = (
        await schedule.sessionsForRange(deps.today(), addDaysIso(deps.today(), 60))
      ).find((x) => x.id === p.sessionId)!;
      await schedule.move(p.sessionId, p.date, p.startTime);
      undo = () =>
        schedule
          .edit(p.sessionId, {
            scheduledDate: before.scheduledDate,
            startTime: before.startTime,
            rescheduleCount: before.rescheduleCount,
            isException: before.isException,
          })
          .then(() => undefined);
    } else if (s.kind === 'add_rest') {
      const rest = await schedule.setRestDay(addRestPayload.parse(raw).date);
      undo = () => schedule.softDelete(rest.id).then(() => undefined);
    } else if (s.kind === 'replace_exercise') {
      const p = replaceExercisePayload.parse(raw);
      const templates = templateRepo(deps.db);
      const tpl = await templates.get(p.templateId);
      const copy = (swap: boolean) =>
        tpl.exercises.map((e) => ({
          exerciseId: swap && e.exerciseId === p.fromExerciseId ? p.toExerciseId : e.exerciseId,
          sets: e.sets,
          targetReps: e.targetReps,
          targetDurationSeconds: e.targetDurationSeconds,
          targetWeightKg: e.targetWeightKg,
          restSeconds: e.restSeconds,
          supersetGroup: e.supersetGroup,
          notes: e.notes,
        }));
      await templates.update(p.templateId, { exercises: copy(true) });
      undo = () => templates.update(p.templateId, { exercises: copy(false) }).then(() => undefined);
    }
    await repo.setSuggestionStatus(id, 'applied');
    return ok({
      undo: async () => {
        await undo();
        await repo.setSuggestionStatus(id, 'pending');
      },
    });
  }

  return {
    prepare,
    run,
    chat,
    testConnection,
    previewSuggestion,
    applySuggestion,
    ignoreSuggestion: (id: string) => repo.setSuggestionStatus(id, 'ignored'),
    suggestions: (insightId: string) => repo.suggestions(insightId),
    latestInsight: (kind: AIMethod) => repo.latestInsight(kind),
    report,
    recentReports: (limit?: number) => repo.recentInsights(limit),
    threads: () => repo.threads(),
    threadMessages: (threadId: string) => repo.messages(threadId),
    deleteThread: (threadId: string) => repo.deleteThread(threadId),
    clearHistory: () => repo.clearAll(),
  };
}

export type AIService = ReturnType<typeof createAIService>;
