# 31 — AI Foundation (Service, Providers, Privacy)

| | |
|---|---|
| Milestone | M5 AI layer (V1.1) |
| Depends on | 30 (a stable offline V1) |
| Spec refs | FS §39–§44, §66 · UI §27, §30, §34 · AD-18 |
| Output | `AIService` with a provider abstraction, a data summarizer, secure key storage, consent/transparency UI, and an insights store |

## Objective

Add intelligence **without** making it a dependency. The offline app must work identically with AI off (FS §5). The UI calls `AIService`, never a provider (FS §40). The model receives controlled summaries, never the database (FS §41).

## Architecture

```text
UI (coach, contextual buttons)
   │  AIService.summarizeWeek() / analyzeProgress() / adaptWorkout(...) ...
   ▼
AIService ──► DataSummarizer (pure, local)  ──► PayloadPreview (user sees what is sent)
   │          PromptBuilder (versioned templates, safety wording)
   │          ResponseParser (Zod-validated structured output)
   ▼
AIProvider (interface)
   ├── AnthropicProvider   (Claude Messages API; default model: latest Claude, configurable)
   ├── OpenAIProvider      (Chat/Responses API)
   └── MockProvider        (deterministic, for tests and demo)
```

```ts
interface AIProvider {
  id: 'anthropic' | 'openai' | 'mock';
  testConnection(): Promise<Result<void, AIError>>;
  complete(req: { system: string; messages: Msg[]; schema?: ZodSchema; maxTokens: number; signal?: AbortSignal }):
    Promise<Result<{ text: string; json?: unknown; usage?: Usage }, AIError>>;
}
```

## Tasks

### 1. Service and providers (`src/services/ai/`)
- [ ] `AIService` methods, from FS §39 and UI §30: `summarizeWeek(weekStart)`, `analyzeProgress(range)`, `analyzeTraining(range)`, `analyzeRunning(range)`, `estimateTrend(goalId)`, `adaptWorkout(templateId, constraints)`, `suggestAlternative(exerciseId, context)`, `improveSchedule(range)`, `chat(threadId, message)`.
- [ ] Providers call HTTPS endpoints with `fetch` directly (no heavy SDKs needed in React Native). Timeouts at 30 s, cancellation, retry once on 429/5xx with backoff, and human error mapping ("Couldn't reach the AI provider. Your data wasn't changed.").
- [ ] Model and provider are configurable in settings. Defaults are documented in code, and nothing is hardcoded in the UI.
- [ ] **Structured outputs:** every analysis method requests JSON matching a Zod schema (`Insight { title, summary, bullets[], suggestions: Suggestion[], confidence, disclaimers[] }`, `Suggestion { kind: 'move_session'|'replace_exercise'|'adjust_template'|'add_rest'|'info', payload, rationale }`). Invalid JSON gets one repair retry, then a graceful failure.

### 2. Data summarizer (`src/services/ai/summarizer.ts`, pure)
- [ ] Builds minimal payloads per method, like FS §41: goal, current weight, trend, weekly counts per type, completion rate, top substitutions, and a running progression summary.
- [ ] **Excludes** by default: names, notes (opt-in per request: "Include my workout notes"), date of birth (age bracket only, if needed), photos (never, unless a future explicit photo-analysis action), and exact timestamps (aggregated to days).
- [ ] Unit tests assert that each payload contains only whitelisted keys (a snapshot per method) and never contains a file path or photo reference.

### 3. Privacy and consent (FS §41 items 5–6, FS §44)
- [ ] First use: a consent sheet explaining the provider, what is sent, that the user supplies their own key, and that it's optional. Opt-in is per provider.
- [ ] **Payload preview** before every request (collapsible "What will be sent"), with a "Don't show again for this type" option.
- [ ] A clear "Sending to <Provider>…" state. No background or automatic AI calls in V1.1, ever.
- [ ] A system prompt with the safety wording rules: "Based on your recorded trend…", estimates labelled, no medical claims, and "Consider discussing persistent concerns with a qualified professional."
- [ ] An offline check: if there is no connectivity, AI entry points show "AI needs an internet connection" and everything else works.

### 4. Keys and settings (UI §34)
- [ ] `settings/ai`: provider picker, API key field (masked; stored in **SecureStore**; never logged, never exported, never shown after saving except the last 4 characters), model field, "Test connection", "Delete key", and a usage note.
- [ ] AI preferences: tone (concise/detailed), language (follows the app), include notes (off by default).
- [ ] Master switch `featureFlags.ai` becomes a user setting ("Enable AI features", default off).

### 5. Persistence (migration `m00N_ai`)
```sql
CREATE TABLE ai_insights (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL, period_start TEXT, period_end TEXT,
  provider TEXT NOT NULL, model TEXT NOT NULL, prompt_version TEXT NOT NULL,
  payload_hash TEXT NOT NULL, response_json TEXT NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
);
CREATE TABLE ai_suggestions (
  id TEXT PRIMARY KEY, insight_id TEXT REFERENCES ai_insights(id),
  kind TEXT NOT NULL, payload TEXT NOT NULL, rationale TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending','applied','ignored','expired')),
  decided_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
);
CREATE TABLE ai_messages (
  id TEXT PRIMARY KEY, thread_id TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
);
```
- [ ] Insights are cached by `payload_hash`, so the same week is not re-billed unless the user asks to refresh.
- [ ] AI tables are excluded from the backup by default (opt-in).

### 6. Suggestion application (FS §43)
- [ ] `applySuggestion(id)` maps each suggestion kind onto **existing** repository operations (`scheduleRepo.move`, `templateRepo.update`, and so on), validates it again locally (conflicts, equipment), shows a diff preview, and applies it only on the user's tap. The AI can never write directly.

## Acceptance criteria

- [ ] With AI disabled, zero network calls are made (verified with a proxy or logging), and all V1 tests still pass.
- [ ] The MockProvider drives every AI method in tests and the demo mode.
- [ ] Payload snapshot tests prove that no photos, paths, notes (unless opted in) or keys are sent.
- [ ] The API key survives a restart, is absent from logs and backups, and can be deleted.
