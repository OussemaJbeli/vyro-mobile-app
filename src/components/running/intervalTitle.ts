import { type TFunction } from 'i18next';

import enRunning from '@/i18n/locales/en/running.json';
import { type RunInterval } from '@/domain/running/intervals';

const KIND_NAMES = new Set(Object.values(enRunning.kinds).map((n) => n.toLowerCase()));

/**
 * "3. Sprint · 2/6". A label that only repeats an interval type ("Warmup") is hidden,
 * so rows never read "Warmup · Warmup" (older seeds stored such labels).
 */
export function intervalTitle(
  iv: Pick<RunInterval, 'kind' | 'label'>,
  index: number,
  t: TFunction<'running'>,
): string {
  const kind = t(`kinds.${iv.kind}`);
  const label = iv.label?.trim();
  const redundant =
    !label || KIND_NAMES.has(label.toLowerCase()) || label.toLowerCase() === kind.toLowerCase();
  return `${index + 1}. ${kind}${redundant ? '' : ` · ${label}`}`;
}
