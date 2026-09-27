import { AIError, err, ok, type AIProvider, type CompleteRequest } from '../types';

import { postJson } from './http';

type AnthropicResponse = {
  content?: { type: string; text?: string }[];
  stop_reason?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
};

/** Models that accept server-side refusal fallbacks in their `"default"` form. */
const FALLBACK_MODELS = new Set(['claude-opus-5', 'claude-fable-5-1']);

/**
 * Claude Messages API over HTTPS (the roadmap asks for plain fetch instead of SDKs in
 * React Native). Structured output via `output_config.format` (JSON Schema). Adaptive
 * thinking is the model default, so the timeout is longer than the other providers'.
 */
export function anthropicProvider(apiKey: string, model: string): AIProvider {
  const complete = async (req: CompleteRequest) => {
    const fallbacks = FALLBACK_MODELS.has(model);
    const res = await postJson(
      'https://api.anthropic.com/v1/messages',
      {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        // Required for direct calls from the web preview (browser CORS); ignored natively.
        'anthropic-dangerous-direct-browser-access': 'true',
        ...(fallbacks ? { 'anthropic-beta': 'server-side-fallback-2026-07-01' } : {}),
      },
      {
        model,
        max_tokens: req.maxTokens,
        system: req.system,
        messages: req.messages,
        ...(fallbacks ? { fallbacks: 'default' } : {}),
        ...(req.jsonSchema
          ? { output_config: { format: { type: 'json_schema', schema: req.jsonSchema } } }
          : {}),
      },
      req.signal,
      90_000,
    );
    if (!res.ok) return res;
    const data = res.value as AnthropicResponse;
    // Check the stop reason before reading content (a refusal may not match the schema).
    if (data.stop_reason === 'refusal') {
      return err(new AIError('refusal', 'Declined by the provider'));
    }
    if (data.stop_reason === 'max_tokens') {
      return err(new AIError('bad_response', 'The answer was cut off (max tokens)'));
    }
    const text = (data.content ?? [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('');
    if (!text) return err(new AIError('bad_response', 'Empty answer'));
    return ok({
      text,
      usage: { inputTokens: data.usage?.input_tokens, outputTokens: data.usage?.output_tokens },
    });
  };
  return {
    id: 'anthropic',
    model,
    complete,
    testConnection: async (signal) => {
      const r = await complete({
        system: 'Reply with the single word OK.',
        messages: [{ role: 'user', content: 'Connection test' }],
        maxTokens: 1024,
        ...(signal ? { signal } : {}),
      });
      return r.ok ? ok(undefined) : r;
    },
  };
}
