import { insightSchema, type Insight } from './schemas';

/** Parses a provider answer into an Insight: strips code fences, JSON.parse, Zod. */
export function parseInsight(
  text: string,
): { ok: true; value: Insight } | { ok: false; reason: string } {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/, '')
    .trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end <= start) return { ok: false, reason: 'no JSON object' };
  let json: unknown;
  try {
    json = JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    return { ok: false, reason: 'invalid JSON' };
  }
  const parsed = insightSchema.safeParse(json);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : {
        ok: false,
        reason: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      };
}
