import { dayState, streaks } from '../streak';

const S = (date: string, status: string, type = 'gym') => ({ date, type, status });

describe('streak definition', () => {
  it('day states', () => {
    expect(dayState([S('d', 'completed'), S('d', 'modified')], false, false)).toBe('satisfied');
    expect(dayState([S('d', 'planned', 'rest')], false, false)).toBe('satisfied');
    expect(dayState([], true, false)).toBe('satisfied');
    expect(dayState([], false, false)).toBe('neutral');
    expect(dayState([S('d', 'planned')], false, false)).toBe('broken'); // missed
    expect(dayState([S('d', 'skipped')], false, false)).toBe('broken');
    expect(dayState([S('d', 'planned')], false, true)).toBe('pending');
    expect(dayState([S('d', 'cancelled')], false, false)).toBe('neutral');
  });

  it('rest days and empty days never break it; a missed workout does; today pending starts yesterday', () => {
    const sessions = [
      S('2026-09-20', 'completed'),
      S('2026-09-21', 'planned'), // missed → breaks
      S('2026-09-22', 'completed'),
      S('2026-09-23', 'planned', 'rest'),
      // 24: nothing (neutral)
      S('2026-09-25', 'modified'),
      S('2026-09-26', 'planned'), // today, still pending
    ];
    const r = streaks({ sessions, adhocDates: [], today: '2026-09-26', since: '2026-09-15' });
    expect(r).toEqual({ current: 3, longest: 3 });
    const done = streaks({
      sessions: [...sessions.slice(0, -1), S('2026-09-26', 'completed')],
      adhocDates: ['2026-09-24'],
      today: '2026-09-26',
      since: '2026-09-15',
    });
    expect(done.current).toBe(5);
  });
});
