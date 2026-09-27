import { AIError, err, ok, type AIProvider, type CompleteRequest } from '../types';

import { postJson } from './http';

type OpenAIResponse = {
  output?: { type?: string; content?: { type?: string; text?: string; refusal?: string }[] }[];
  usage?: { input_tokens?: number; output_tokens?: number };
  incomplete_details?: { reason?: string } | null;
};

/** OpenAI Responses API with `text.format` JSON Schema (strict) for structured output. */
export function openaiProvider(apiKey: string, model: string): AIProvider {
  const complete = async (req: CompleteRequest) => {
    const res = await postJson(
      'https://api.openai.com/v1/responses',
      { authorization: `Bearer ${apiKey}` },
      {
        model,
        instructions: req.system,
        input: req.messages.map((m) => ({ role: m.role, content: m.content })),
        max_output_tokens: req.maxTokens,
        ...(req.jsonSchema
          ? {
              text: {
                format: {
                  type: 'json_schema',
                  name: 'vyro_output',
                  schema: req.jsonSchema,
                  strict: true,
                },
              },
            }
          : {}),
      },
      req.signal,
    );
    if (!res.ok) return res;
    const data = res.value as OpenAIResponse;
    const parts = (data.output ?? []).flatMap((o) => o.content ?? []);
    if (parts.some((p) => p.type === 'refusal')) {
      return err(new AIError('refusal', 'Declined by the provider'));
    }
    const text = parts
      .filter((p) => p.type === 'output_text')
      .map((p) => p.text ?? '')
      .join('');
    if (!text) return err(new AIError('bad_response', 'Empty answer'));
    return ok({
      text,
      usage: { inputTokens: data.usage?.input_tokens, outputTokens: data.usage?.output_tokens },
    });
  };
  return {
    id: 'openai',
    model,
    complete,
    testConnection: async (signal) => {
      const r = await complete({
        system: 'Reply with the single word OK.',
        messages: [{ role: 'user', content: 'Connection test' }],
        maxTokens: 256,
        ...(signal ? { signal } : {}),
      });
      return r.ok ? ok(undefined) : r;
    },
  };
}
