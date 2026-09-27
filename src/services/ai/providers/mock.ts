import { ok, type AIProvider, type CompleteRequest } from '../types';

/**
 * Deterministic provider for tests and demo mode: echoes a valid Insight (or chat text)
 * built from the request, never touches the network.
 */
export function mockProvider(model = 'mock-1'): AIProvider {
  const complete = async (req: CompleteRequest) => {
    const last = req.messages.at(-1)?.content ?? '';
    if (!req.jsonSchema) return ok({ text: `Mock reply to: ${last.slice(0, 80)}` });
    const insight = {
      title: 'Mock insight',
      summary: 'Based on your recorded data, this is a deterministic mock answer.',
      bullets: [`Payload size: ${last.length} characters`],
      suggestions: [
        { kind: 'info', payload: '{}', rationale: 'Keep going: consistency matters most.' },
      ],
      confidence: 'medium',
      disclaimers: ['Mock data, not advice.'],
    };
    const text = JSON.stringify(insight);
    return ok({
      text,
      json: insight,
      usage: { inputTokens: last.length, outputTokens: text.length },
    });
  };
  return { id: 'mock', model, complete, testConnection: async () => ok(undefined) };
}
