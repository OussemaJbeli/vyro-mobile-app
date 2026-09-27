import { matchesQuery } from '@/hooks/useExerciseCatalog';

import { displayName, seedSlug } from '../seedNames';

const t = (key: string) => `T(${key})`;

describe('seed display names', () => {
  it('translates unrenamed seeded rows and keeps user text otherwise', () => {
    expect(displayName('exercise', { name: 'Bench Press', slug: 'bench_press' }, t)).toBe(
      'T(seed:exercise.bench_press)',
    );
    expect(displayName('exercise', { name: 'My Bench', slug: 'bench_press' }, t)).toBe('My Bench');
    expect(displayName('exercise', { name: 'Band Pull-Apart', slug: null }, t)).toBe(
      'Band Pull-Apart',
    );
    expect(displayName('template', { name: 'Upper Body', id: 'seed-tpl-upper_body' }, t)).toBe(
      'T(seed:template.upper_body)',
    );
    expect(seedSlug('template', { name: 'x', id: 'uuid-123' })).toBeNull();
  });
});

describe('library search', () => {
  it('matches translated and stored names, ignoring case and accents', () => {
    const item = { label: 'Développé couché', name: 'Bench Press' };
    expect(matchesQuery(item, 'developpe')).toBe(true);
    expect(matchesQuery(item, 'BENCH')).toBe(true);
    expect(matchesQuery(item, '  ')).toBe(true);
    expect(matchesQuery(item, 'squat')).toBe(false);
  });
});
