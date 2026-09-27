import {
  addDaysIso,
  daysBetween,
  endDateAfterCount,
  isoWeekday,
  occurrences,
  planMaterialization,
  weekStart,
  type RuleLike,
} from '../recurrence';

const rule = (over: Partial<RuleLike>): RuleLike => ({
  id: 'r',
  freq: 'weekly',
  interval: 1,
  byWeekday: [1, 3, 5],
  byMonthDay: null,
  startDate: '2026-09-21', // Monday
  endDate: null,
  active: true,
  ...over,
});

describe('date helpers', () => {
  it('does calendar arithmetic across DST and weeks', () => {
    expect(addDaysIso('2026-03-07', 2)).toBe('2026-03-09');
    expect(addDaysIso('2026-10-31', 2)).toBe('2026-11-02');
    expect(daysBetween('2026-09-21', '2026-10-05')).toBe(14);
    expect(isoWeekday('2026-09-21')).toBe(1);
    expect(isoWeekday('2026-09-27')).toBe(7);
    expect(weekStart('2026-09-24', 1)).toBe('2026-09-21');
    expect(weekStart('2026-09-24', 0)).toBe('2026-09-20');
    expect(weekStart('2026-09-20', 1)).toBe('2026-09-14');
  });
});

describe('occurrences', () => {
  it('weekly on selected weekdays', () => {
    expect(occurrences(rule({}), '2026-09-21', '2026-09-30')).toEqual([
      '2026-09-21',
      '2026-09-23',
      '2026-09-25',
      '2026-09-28',
      '2026-09-30',
    ]);
  });

  it('every 2 weeks stays anchored on the start week, whatever the window', () => {
    const r = rule({ freq: 'custom', interval: 2, byWeekday: [2] });
    expect(occurrences(r, '2026-09-21', '2026-10-20')).toEqual([
      '2026-09-22',
      '2026-10-06',
      '2026-10-20',
    ]);
    expect(occurrences(r, '2026-09-29', '2026-10-10')).toEqual(['2026-10-06']);
    // Sunday week start moves the anchor week but keeps a 14-day rhythm.
    const sun = occurrences(r, '2026-09-21', '2026-10-20', 0);
    expect(daysBetween(sun[0]!, sun[1]!)).toBe(14);
  });

  it('weekly without weekdays uses the start date weekday', () => {
    expect(
      occurrences(rule({ byWeekday: null, startDate: '2026-09-24' }), '2026-09-21', '2026-10-08'),
    ).toEqual(['2026-09-24', '2026-10-01', '2026-10-08']);
  });

  it('daily every N days from the rule start', () => {
    const r = rule({ freq: 'daily', interval: 3, startDate: '2026-09-20' });
    expect(occurrences(r, '2026-09-24', '2026-10-01')).toEqual(['2026-09-26', '2026-09-29']);
    expect(occurrences(rule({ freq: 'daily' }), '2026-09-21', '2026-09-23')).toHaveLength(3);
  });

  it('monthly clamps to the end of short months', () => {
    const r = rule({ freq: 'monthly', byMonthDay: 31, startDate: '2026-01-31' });
    expect(occurrences(r, '2026-01-01', '2026-05-31')).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
      '2026-05-31',
    ]);
    const every2 = rule({
      freq: 'monthly',
      interval: 2,
      byMonthDay: null,
      startDate: '2026-09-15',
    });
    expect(occurrences(every2, '2026-09-01', '2027-01-31')).toEqual([
      '2026-09-15',
      '2026-11-15',
      '2027-01-15',
    ]);
  });

  it('respects start, end and inactive rules', () => {
    expect(occurrences(rule({ endDate: '2026-09-23' }), '2026-09-01', '2026-12-31')).toEqual([
      '2026-09-21',
      '2026-09-23',
    ]);
    expect(occurrences(rule({}), '2026-09-01', '2026-09-20')).toEqual([]);
    expect(occurrences(rule({ active: false }), '2026-09-21', '2026-12-31')).toEqual([]);
  });
});

describe('materialization', () => {
  it('plans only missing occurrences from today', () => {
    const r = { ...rule({}), materializedUntil: null };
    const plan = planMaterialization([r], new Set(['r|2026-09-23']), '2026-09-22', '2026-09-28');
    expect(plan).toEqual([
      { ruleId: 'r', date: '2026-09-25' },
      { ruleId: 'r', date: '2026-09-28' },
    ]);
  });

  it('computes the end date for "after N times"', () => {
    expect(endDateAfterCount(rule({}), 4)).toBe('2026-09-28');
    expect(endDateAfterCount(rule({}), 0)).toBeNull();
  });
});
