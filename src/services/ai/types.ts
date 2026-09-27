/**
 * AI layer types (step 31, AD-18). The UI talks to AIService only; providers are plain
 * HTTPS adapters behind `AIProvider`.
 */
export type ProviderId = 'gemini' | 'openai' | 'anthropic' | 'mock';

export type Msg = { role: 'user' | 'assistant'; content: string };

export type Usage = { inputTokens?: number | undefined; outputTokens?: number | undefined };

export type AIErrorKind =
  | 'disabled'
  | 'no_key'
  | 'offline'
  | 'auth'
  | 'rate_limit'
  | 'server'
  | 'timeout'
  | 'cancelled'
  | 'refusal'
  | 'bad_response';

export class AIError extends Error {
  constructor(
    readonly kind: AIErrorKind,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'AIError';
  }
}

export type Result<T, E = AIError> = { ok: true; value: T } | { ok: false; error: E };
export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const err = (error: AIError): Result<never> => ({ ok: false, error });

export type CompleteRequest = {
  system: string;
  messages: Msg[];
  /** JSON Schema (all objects `additionalProperties: false`) for structured output. */
  jsonSchema?: Record<string, unknown>;
  maxTokens: number;
  signal?: AbortSignal;
};

export type CompleteResponse = { text: string; json?: unknown; usage?: Usage };

export interface AIProvider {
  id: ProviderId;
  model: string;
  testConnection(signal?: AbortSignal): Promise<Result<void>>;
  complete(req: CompleteRequest): Promise<Result<CompleteResponse>>;
}
