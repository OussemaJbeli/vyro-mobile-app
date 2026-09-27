import { AIError, err, ok, type AIProvider, type CompleteRequest } from '../types';

import { postJson } from './http';

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
};

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Google AI Studio (Gemini API) `generateContent`, key in the `x-goog-api-key` header. */
export function geminiProvider(apiKey: string, model: string): AIProvider {
  const complete = async (req: CompleteRequest) => {
    const res = await postJson(
      `${BASE}/${encodeURIComponent(model)}:generateContent`,
      { 'x-goog-api-key': apiKey },
      {
        systemInstruction: { parts: [{ text: req.system }] },
        contents: req.messages.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
        generationConfig: {
          maxOutputTokens: req.maxTokens,
          ...(req.jsonSchema
            ? { responseMimeType: 'application/json', responseJsonSchema: req.jsonSchema }
            : {}),
        },
      },
      req.signal,
    );
    if (!res.ok) return res;
    const data = res.value as GeminiResponse;
    const cand = data.candidates?.[0];
    if (data.promptFeedback?.blockReason || cand?.finishReason === 'SAFETY') {
      return err(new AIError('refusal', 'Blocked by the provider'));
    }
    const text = (cand?.content?.parts ?? []).map((p) => p.text ?? '').join('');
    if (!text) return err(new AIError('bad_response', 'Empty answer'));
    return ok({
      text,
      usage: {
        inputTokens: data.usageMetadata?.promptTokenCount,
        outputTokens: data.usageMetadata?.candidatesTokenCount,
      },
    });
  };
  return {
    id: 'gemini',
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
