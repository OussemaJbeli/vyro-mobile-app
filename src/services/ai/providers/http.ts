import { AIError, err, ok, type Result } from '../types';

export const TIMEOUT_MS = 30_000;
const RETRY_DELAY_MS = 1_500;

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const id = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(id);
      reject(new AIError('cancelled', 'Cancelled'));
    });
  });

/** HTTP status → error kind. The key is never part of any message. */
function fromStatus(status: number, body: string): AIError {
  if (status === 401 || status === 403)
    return new AIError('auth', 'The API key was rejected', status);
  if (status === 429)
    return new AIError('rate_limit', 'The provider is rate limiting requests', status);
  if (status >= 500) return new AIError('server', 'The provider had a server error', status);
  return new AIError('bad_response', `Request rejected (${status}): ${body.slice(0, 200)}`, status);
}

/**
 * POST JSON with a 30 s timeout, caller cancellation, and one retry (after a short
 * backoff) on 429 / 5xx / network failures.
 */
export async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  signal?: AbortSignal,
  timeoutMs: number = TIMEOUT_MS,
): Promise<Result<unknown>> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort);
    let retryable: AIError;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await res.text();
      if (res.ok) {
        try {
          return ok(JSON.parse(text) as unknown);
        } catch {
          return err(new AIError('bad_response', 'The provider returned invalid JSON'));
        }
      }
      const e = fromStatus(res.status, text);
      if (e.kind !== 'rate_limit' && e.kind !== 'server') return err(e);
      retryable = e;
    } catch {
      if (signal?.aborted) return err(new AIError('cancelled', 'Cancelled'));
      retryable = controller.signal.aborted
        ? new AIError('timeout', 'The provider took too long to answer')
        : new AIError('offline', "Couldn't reach the AI provider");
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
    if (attempt === 1 || retryable.kind === 'timeout') return err(retryable);
    try {
      await sleep(RETRY_DELAY_MS, signal);
    } catch (e) {
      return err(e as AIError);
    }
  }
  return err(new AIError('server', 'The provider had a server error'));
}

/** Human message for the UI. Always reassures that local data wasn't touched. */
export function humanError(e: AIError): string {
  switch (e.kind) {
    case 'disabled':
      return 'AI features are turned off in Settings → AI.';
    case 'no_key':
      return 'Add your API key in Settings → AI first.';
    case 'offline':
      return "AI needs an internet connection. Your data wasn't changed.";
    case 'auth':
      return 'The API key was rejected. Check it in Settings → AI.';
    case 'rate_limit':
      return 'The AI provider is busy (rate limit). Try again in a minute.';
    case 'timeout':
      return "The AI provider took too long to answer. Your data wasn't changed.";
    case 'cancelled':
      return 'Cancelled.';
    case 'refusal':
      return "The AI provider declined this request. Your data wasn't changed.";
    default:
      return "Couldn't get a usable answer from the AI provider. Your data wasn't changed.";
  }
}
