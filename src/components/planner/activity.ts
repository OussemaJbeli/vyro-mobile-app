import { type StatusKind } from '@/components/ui';
import { i18n } from '@/i18n';

type SessionLike = { type: string; title: string; durationMinutes: number | null; status: string };
type TemplateLike = { name: string; durationMinutes: number | null } | undefined;

/**
 * Template row subtitles: "Upper Body · 55 min", "Abs · 12 min", "30 min · Intervals".
 * The template name is shown only when it adds information beyond the session title.
 */
export function sessionSubtitle(s: SessionLike, tpl: TemplateLike): string {
  const minutes = s.durationMinutes ?? tpl?.durationMinutes ?? null;
  const min = minutes ? i18n.t('home:minutes', { count: minutes }) : null;
  if (s.type === 'running')
    return [min, tpl ? i18n.t('home:intervals') : null].filter(Boolean).join(' · ');
  const name = tpl && tpl.name !== s.title ? tpl.name.replace(/\s*\(.*\)\s*$/, '') : null;
  return [name, min].filter(Boolean).join(' · ');
}

/** Session status → template status label; the next planned one is "Next". */
export function statusKind(status: string, isNext: boolean): StatusKind {
  if (status === 'completed' || status === 'modified') return 'completed';
  if (status === 'in_progress') return 'in_progress';
  if (status === 'skipped') return 'skipped';
  if (status === 'cancelled') return 'cancelled';
  return isNext ? 'next' : 'pending';
}

export type ActivityType = 'gym' | 'running' | 'home' | 'abs' | 'recovery' | 'rest' | 'other';
export const activityType = (type: string): ActivityType =>
  (['gym', 'running', 'home', 'abs', 'recovery', 'rest'] as const).includes(type as never)
    ? (type as ActivityType)
    : 'other';
