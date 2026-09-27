/**
 * Display names for seeded rows (step 09/13). A seeded row shows its translated name
 * until the user renames it; a user-created row always shows what the user typed.
 */
import enSeed from '@/i18n/locales/en/seed.json';

type Kind = 'exercise' | 'equipment' | 'measurement' | 'template';
type Row = { name: string; slug?: string | null; id?: string };
type Translate = (key: string, opts?: { defaultValue?: string }) => string;

const SEED_TEMPLATE_ID = /^seed-tpl-(.+)$/;

export function seedSlug(kind: Kind, row: Row): string | null {
  if (kind === 'template') return (row.id && SEED_TEMPLATE_ID.exec(row.id)?.[1]) ?? null;
  return row.slug ?? null;
}

export function displayName(kind: Kind, row: Row, t: Translate): string {
  const slug = seedSlug(kind, row);
  const english = slug ? (enSeed[kind] as Record<string, string>)[slug] : undefined;
  if (!slug || english === undefined || row.name !== english) return row.name;
  return t(`seed:${kind}.${slug}`, { defaultValue: row.name });
}
