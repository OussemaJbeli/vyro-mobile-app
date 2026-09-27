import { type Migration } from './types';

/** FNV-1a 32-bit over the migration's SQL. Stable across platforms, no crypto dependency. */
export function migrationChecksum(m: Migration): string {
  const text = `${m.id}|${m.name}|${m.statements.map((s) => s.trim()).join('\n;\n')}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
