import { type Insight } from '../schemas';

/**
 * Wording guard (FS §44): guarantee-like phrases become estimate language, and an answer
 * that needed a rewrite gets an explicit disclaimer. Runs on every parsed answer.
 */
const REWRITES: [RegExp, string][] = [
  [/\byou will (lose|gain|reach|hit|get|build|burn)\b/gi, 'you could $1'],
  [/\bvous allez (perdre|prendre|atteindre|gagner)\b/gi, 'vous pourriez $1'],
  [/\bguaranteed\b/gi, 'likely'],
  [/\bguarantee(s)?\b/gi, 'suggest$1'],
  [/\bgaranti(e|es|s)?\b/gi, 'probable'],
  [/\b(certainly|definitely) (lose|reach|gain)\b/gi, 'may $2'],
];

const ESTIMATE_NOTE = {
  en: 'Estimates are based on your recorded trend and are not guarantees.',
  fr: 'Les estimations reposent sur votre tendance enregistrée et ne sont pas des garanties.',
};

export function guardText(text: string): { text: string; changed: boolean } {
  let out = text;
  for (const [re, to] of REWRITES) {
    out = out.replace(re, (match: string, ...groups: unknown[]) => {
      const repl = to.replace(/\$(\d)/g, (_, n: string) => String(groups[Number(n) - 1] ?? ''));
      // Keep a leading capital ("You will lose" → "You could lose").
      return /^[A-ZÀ-Ý]/.test(match) ? repl.charAt(0).toUpperCase() + repl.slice(1) : repl;
    });
  }
  return { text: out, changed: out !== text };
}

export function guardWording(insight: Insight, language: 'en' | 'fr' = 'en'): Insight {
  let changed = false;
  const fix = (s: string) => {
    const r = guardText(s);
    changed ||= r.changed;
    return r.text;
  };
  const out: Insight = {
    ...insight,
    title: fix(insight.title),
    summary: fix(insight.summary),
    bullets: insight.bullets.map(fix),
    suggestions: insight.suggestions.map((s) => ({ ...s, rationale: fix(s.rationale) })),
  };
  const note = ESTIMATE_NOTE[language];
  if (changed && !out.disclaimers.includes(note)) out.disclaimers = [...out.disclaimers, note];
  return out;
}
