import { dayProgress, periodSummary, rating, sessionProgress } from '../progress';

const s = (id: string, status: string, date = '2026-09-21', type = 'gym') => ({
  id,
  type,
  status,
  scheduledDate: date,
});

describe('plan progress', () => {
  it('scores sessions from status and logged work', () => {
    expect(sessionProgress(s('a', 'completed'), undefined)).toBe(1);
    expect(sessionProgress(s('b', 'modified'), { done: 6, total: 12 })).toBe(0.5);
    expect(sessionProgress(s('c', 'planned'), undefined)).toBe(0);
    expect(sessionProgress(s('d', 'planned', '2026-09-21', 'rest'), undefined)).toBeNull();
    expect(sessionProgress(s('e', 'cancelled'), undefined)).toBeNull();
  });

  it('rates a day by its average: excellent / good / bad', () => {
    const work = new Map([['b', { done: 1, total: 2 }]]);
    const day = [s('a', 'completed'), s('b', 'modified'), s('c', 'skipped')];
    expect(dayProgress(day, work)).toBeCloseTo(0.5);
    expect(rating(0.9)).toBe('excellent');
    expect(rating(0.5)).toBe('good');
    expect(rating(0.2)).toBe('bad');
  });

  it('summarises a period up to today, skipping rest days and the future', () => {
    const list = [
      s('a', 'completed', '2026-09-21'),
      s('b', 'completed', '2026-09-22'),
      s('c', 'skipped', '2026-09-23'),
      s('r', 'planned', '2026-09-24', 'rest'),
      s('f', 'planned', '2026-09-28'),
    ];
    const sum = periodSummary(list, new Map(), {
      from: '2026-09-01',
      to: '2026-09-30',
      today: '2026-09-27',
    });
    expect(sum.days).toEqual({ excellent: 2, good: 0, bad: 1 });
    expect(sum.restDays).toBe(1);
    expect(sum.sessionsDone).toBe(2);
    expect(sum.sessionsTotal).toBe(3);
    expect(sum.rating).toBe('good');
  });
});
