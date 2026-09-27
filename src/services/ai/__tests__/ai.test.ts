import { openDatabase, type Database } from '@/db/client';
import { migrations } from '@/db/migrations';
import { runMigrations } from '@/db/migrations/runner';
import { applyRoutine } from '@/db/routine';
import { scheduleRepo } from '@/db/repositories/schedule';
import { seedDatabase } from '@/db/seed/seed';
import { openNodeDriver } from '@/db/testing/nodeDriver';

import { parseInsight } from '../parser';
import { geminiProvider } from '../providers/gemini';
import { mockProvider } from '../providers/mock';
import { createAIService, type AIConfig } from '../service';
import { buildPayload, type AIMethod, type CoachData } from '../summarizer';
import { ok, type AIProvider, type CompleteRequest } from '../types';

const data: CoachData = {
  period: { start: '2026-09-21', end: '2026-09-27' },
  units: { weight: 'kg', distance: 'km', speed: 'mph' },
  ageBracket: '30-39',
  goal: { type: 'weight', target: 78, unit: 'kg', start: 84, targetDate: null },
  weights: [
    { date: '2026-09-21', kg: 82.4 },
    { date: '2026-09-27', kg: 81.9 },
  ],
  sessions: [
    { date: '2026-09-21', weekday: 1, type: 'gym', status: 'completed', progress: 1 },
    { date: '2026-09-22', weekday: 2, type: 'running', status: 'modified', progress: 0.5 },
    { date: '2026-09-24', weekday: 4, type: 'rest', status: 'planned', progress: null },
  ],
  strength: [{ exercise: 'Bench Press', sets: 3, bestWeightKg: 80, bestReps: 8 }],
  runs: [{ date: '2026-09-22', minutes: 25, avgSpeedKmh: 11, maxSpeedKmh: 14.5, completion: 0.5 }],
  substitutions: [{ from: 'Squat', to: 'Leg Press', count: 1 }],
  upcoming: [{ id: 's-1', date: '2026-09-28', startTime: '16:30', type: 'running' }],
  notes: [],
};

const METHODS: AIMethod[] = [
  'summarizeWeek',
  'analyzeProgress',
  'analyzeTraining',
  'analyzeRunning',
  'estimateTrend',
  'improveSchedule',
  'adaptWorkout',
  'suggestAlternative',
  'chat',
];

/** Every key allowed anywhere in a payload (FS §41 whitelist). */
const ALLOWED = new Set([
  'period',
  'start',
  'end',
  'units',
  'weight',
  'distance',
  'speed',
  'goal',
  'type',
  'target',
  'unit',
  'targetDate',
  'ageBracket',
  'currentKg',
  'changeKg',
  'perWeekKg',
  'entries',
  'sessions',
  'byType',
  'planned',
  'done',
  'partial',
  'skipped',
  'missed',
  'completionPct',
  'running',
  'runs',
  'totalMinutes',
  'avgSpeedKmh',
  'bestSpeedKmh',
  'speedChangeKmh',
  'avgCompletionPct',
  'strength',
  'exercises',
  'totalSets',
  'top',
  'exercise',
  'sets',
  'bestWeightKg',
  'bestReps',
  'substitutions',
  'from',
  'to',
  'count',
  'weekdays',
  'upcoming',
  'id',
  'date',
  'startTime',
  'question',
  'notes',
  'workout',
  'templateId',
  'name',
  'exerciseId',
  'reps',
  'constraints',
  'equipment',
  'candidates',
  'muscles',
  'gym',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
]);

function keysOf(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) value.forEach((v) => keysOf(v, out));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      out.push(k);
      keysOf(v, out);
    }
  }
  return out;
}

describe('AI summarizer (privacy whitelist)', () => {
  it.each(METHODS)('%s only sends whitelisted keys, no paths, photos or keys', (method) => {
    const payload = buildPayload(method, data, '2026-09-27', {
      question: 'How was my week?',
      exercise: { name: 'Squat', muscles: ['quads'] },
      equipment: ['Barbell'],
    });
    const unknown = keysOf(payload).filter((k) => !ALLOWED.has(k));
    expect(unknown).toEqual([]);
    const text = JSON.stringify(payload);
    expect(text).not.toMatch(
      /file:|\/vyro-private|photo|thumb|api[_-]?key|date_of_birth|dateOfBirth/i,
    );
    expect(text).not.toContain('"notes"');
  });

  it('adds workout notes only when the user opted in', () => {
    const withNotes = buildPayload(
      'summarizeWeek',
      { ...data, notes: ['Left knee felt tight'] },
      '2026-09-27',
    );
    expect(JSON.stringify(withNotes)).toContain('Left knee felt tight');
  });

  it('aggregates to days and counts (no exact timestamps)', () => {
    const payload = buildPayload('summarizeWeek', data, '2026-09-27');
    expect(JSON.stringify(payload)).not.toMatch(/T\d{2}:\d{2}/);
    expect(payload).toMatchObject({
      weight: { currentKg: 81.9, changeKg: -0.5 },
      sessions: { byType: { gym: { done: 1 }, running: { partial: 1 } }, completionPct: 75 },
    });
  });
});

describe('AI parser', () => {
  it('accepts fenced JSON and rejects the wrong shape', () => {
    const good = parseInsight(
      '```json\n{"title":"T","summary":"S","bullets":[],"suggestions":[],"confidence":"low","disclaimers":[]}\n```',
    );
    expect(good.ok).toBe(true);
    expect(parseInsight('{"title":"T"}').ok).toBe(false);
    expect(parseInsight('no json').ok).toBe(false);
  });
});

describe('AIService', () => {
  let db: Database;
  const base: AIConfig = {
    enabled: true,
    provider: 'mock',
    model: 'mock-1',
    prefs: { tone: 'concise', language: 'en' },
    includeNotes: false,
  };
  let config = base;
  let provider: AIProvider = mockProvider();
  let providerCalls = 0;

  beforeEach(async () => {
    db = await openDatabase(openNodeDriver());
    await runMigrations(db, migrations);
    await seedDatabase(db);
    await applyRoutine(db, { today: '2026-09-27' });
    await scheduleRepo(db).materialize('2026-09-21', '2026-10-05');
    config = base;
    provider = mockProvider();
    providerCalls = 0;
  });
  afterEach(() => db.driver.close());

  const service = () =>
    createAIService({
      db,
      config: () => config,
      provider: async () => {
        providerCalls += 1;
        return provider;
      },
      isOnline: async () => true,
      today: () => '2026-09-27',
    });

  it('makes no provider call at all while AI is disabled', async () => {
    config = { ...base, enabled: false };
    const ai = service();
    const prepared = await ai.prepare('summarizeWeek');
    const res = await ai.run(prepared);
    expect(res.ok).toBe(false);
    expect(!res.ok && res.error.kind).toBe('disabled');
    expect(providerCalls).toBe(0);
  });

  it('caches by payload hash: the same week is not sent twice', async () => {
    const ai = service();
    const first = await ai.run(await ai.prepare('summarizeWeek'));
    expect(first.ok && first.value.cached).toBe(false);
    const second = await ai.run(await ai.prepare('summarizeWeek'));
    expect(second.ok && second.value.cached).toBe(true);
    expect(providerCalls).toBe(1);
    const refreshed = await ai.run(await ai.prepare('summarizeWeek'), { refresh: true });
    expect(refreshed.ok && refreshed.value.cached).toBe(false);
  });

  it('repairs an invalid answer once, then fails gracefully', async () => {
    let n = 0;
    const answers = [
      'not json',
      '{"title":"T","summary":"S","bullets":[],"suggestions":[],"confidence":"high","disclaimers":[]}',
    ];
    provider = {
      ...mockProvider(),
      complete: async (_req: CompleteRequest) => ok({ text: answers[n++] ?? 'still bad' }),
    };
    const ai = service();
    const res = await ai.run(await ai.prepare('analyzeTraining'));
    expect(res.ok && res.value.insight.confidence).toBe('high');
    n = 5;
    const bad = await ai.run(await ai.prepare('analyzeRunning'));
    expect(!bad.ok && bad.error.kind).toBe('bad_response');
  });

  it('applies a move suggestion only through the schedule repository, after validation', async () => {
    const monday = (await scheduleRepo(db).sessionsForDate('2026-09-28')).find(
      (s) => s.type === 'running',
    )!;
    provider = {
      ...mockProvider(),
      complete: async () =>
        ok({
          text: JSON.stringify({
            title: 'Schedule',
            summary: 'Move the run',
            bullets: [],
            suggestions: [
              {
                kind: 'move_session',
                payload: JSON.stringify({
                  sessionId: monday.id,
                  date: '2026-09-29',
                  startTime: '18:00',
                }),
                rationale: 'Tuesday is lighter',
              },
            ],
            confidence: 'medium',
            disclaimers: [],
          }),
        }),
    };
    const ai = service();
    const res = await ai.run(await ai.prepare('improveSchedule'));
    if (!res.ok) throw res.error;
    const id = res.value.suggestionIds[0]!;
    const preview = await ai.previewSuggestion(id);
    expect(preview.canApply).toBe(true);
    expect((await ai.applySuggestion(id)).ok).toBe(true);
    const moved = (await scheduleRepo(db).sessionsForDate('2026-09-29')).find(
      (s) => s.id === monday.id,
    );
    expect(moved?.startTime).toBe('18:00');
    expect((await ai.previewSuggestion(id)).canApply).toBe(false);
  });

  it('shows the exact diff, undoes an applied move, and expires stale suggestions', async () => {
    const tuesday = (await scheduleRepo(db).sessionsForDate('2026-09-29')).find(
      (s) => s.type === 'gym',
    )!;
    const suggestion = (sessionId: string) => ({
      kind: 'move_session',
      payload: JSON.stringify({ sessionId, date: '2026-10-01', startTime: '17:00' }),
      rationale: 'Thursday is free',
    });
    provider = {
      ...mockProvider(),
      complete: async () =>
        ok({
          text: JSON.stringify({
            title: 'Plan',
            summary: 'Move',
            bullets: [],
            suggestions: [suggestion(tuesday.id), suggestion('gone')],
            confidence: 'low',
            disclaimers: [],
          }),
        }),
    };
    const ai = service();
    const res = await ai.run(
      await ai.prepare('improveSchedule', { range: { start: '2026-09-20', end: '2026-09-27' } }),
    );
    if (!res.ok) throw res.error;
    const [moveId, staleId] = res.value.suggestionIds as [string, string];
    const preview = await ai.previewSuggestion(moveId);
    expect(preview.diff?.after.some((l) => l.includes(tuesday.title))).toBe(true);
    expect(preview.warnings).toContain('The target day is a rest day.');
    const applied = await ai.applySuggestion(moveId);
    if (!applied.ok) throw applied.error;
    await applied.value.undo();
    const back = (await scheduleRepo(db).sessionsForDate('2026-09-29')).find(
      (s) => s.id === tuesday.id,
    );
    expect(back?.startTime).toBe(tuesday.startTime);
    expect((await ai.previewSuggestion(moveId)).canApply).toBe(true);
    expect((await ai.previewSuggestion(staleId)).canApply).toBe(false);
    expect((await ai.suggestions(res.value.insightId)).find((s) => s.id === staleId)?.status).toBe(
      'expired',
    );
    expect((await ai.recentReports()).length).toBeGreaterThan(0);
  });
});

describe('Gemini provider over HTTP', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it('sends the key in a header, maps 401, and retries once on 429', async () => {
    const calls: { url: string; headers: Record<string, string> }[] = [];
    const replies = [
      new Response('busy', { status: 429 }),
      new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'OK' }] } }] }), {
        status: 200,
      }),
      new Response('bad key', { status: 401 }),
    ];
    global.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), headers: init?.headers as Record<string, string> });
      return replies.shift()!;
    }) as typeof fetch;
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    const p = geminiProvider('secret-key', 'gemini-3.8-flash');
    const pending = p.testConnection();
    await jest.advanceTimersByTimeAsync(2000);
    expect((await pending).ok).toBe(true);
    const denied = await p.testConnection();
    expect(!denied.ok && denied.error.kind).toBe('auth');
    jest.useRealTimers();
    expect(calls).toHaveLength(3);
    expect(calls[0]!.url).not.toContain('secret-key');
    expect(calls[0]!.headers['x-goog-api-key']).toBe('secret-key');
  });
});
