import { setClock } from '../clock';
import {
  addDays,
  addMonthsLocal,
  asLocalDate,
  asLocalTime,
  combine,
  formatClock,
  formatDuration,
  fromDate,
  greetingKey,
  isPast,
  isToday,
  monthGrid,
  nowInstant,
  startOfWeek,
  toDate,
  toLocalDate,
  today,
  weekDays,
} from '../dates';

const d = asLocalDate;

afterEach(() => setClock(null));

describe('local dates', () => {
  it('validates LocalDate and LocalTime', () => {
    expect(() => d('2026-02-30')).toThrow();
    expect(() => d('2026-9-1')).toThrow();
    expect(() => asLocalTime('24:00')).toThrow();
    expect(asLocalTime('18:00')).toBe('18:00');
  });

  it('parses as local midnight, never UTC', () => {
    const date = toDate(d('2026-09-24'));
    expect(date.getDate()).toBe(24);
    expect(date.getHours()).toBe(0);
    expect(fromDate(date)).toBe('2026-09-24');
  });

  it('uses the injected clock for today and instants', () => {
    setClock(() => new Date('2026-09-25T03:30:00Z')); // 23:30 on the 24th in Toronto
    expect(today()).toBe('2026-09-24');
    expect(nowInstant()).toBe('2026-09-25T03:30:00.000Z');
    expect(toLocalDate('2026-09-25T03:30:00Z')).toBe('2026-09-24');
  });

  it('adds calendar days across DST changes', () => {
    expect(addDays(d('2026-03-07'), 1)).toBe('2026-03-08');
    expect(addDays(d('2026-03-08'), 1)).toBe('2026-03-09');
    expect(addDays(d('2026-10-31'), 2)).toBe('2026-11-02');
    expect(addDays(d('2026-01-01'), -1)).toBe('2025-12-31');
  });

  it('keeps wall-clock time when combining on a DST day', () => {
    const start = combine(d('2026-03-08'), asLocalTime('18:00'));
    expect(start.getHours()).toBe(18);
    expect(start.toISOString()).toBe('2026-03-08T22:00:00.000Z'); // EDT, UTC-4
    expect(combine(d('2026-03-07'), asLocalTime('18:00')).toISOString()).toBe(
      '2026-03-07T23:00:00.000Z', // EST, UTC-5
    );
  });

  it('respects the week start', () => {
    // 2026-09-24 is a Thursday.
    expect(startOfWeek(d('2026-09-24'), 1)).toBe('2026-09-21');
    expect(startOfWeek(d('2026-09-24'), 0)).toBe('2026-09-20');
    expect(weekDays(d('2026-09-24'))).toEqual([
      '2026-09-21',
      '2026-09-22',
      '2026-09-23',
      '2026-09-24',
      '2026-09-25',
      '2026-09-26',
      '2026-09-27',
    ]);
  });

  it('builds a month grid of full weeks', () => {
    const grid = monthGrid(d('2026-09-15'), 1);
    expect(grid[0]?.[0]).toBe('2026-08-31');
    expect(grid.every((w) => w.length === 7)).toBe(true);
    expect(grid.flat()).toContain('2026-09-30');
    expect(addMonthsLocal(d('2026-01-31'), 1)).toBe('2026-02-28');
  });

  it('compares dates', () => {
    expect(isPast(d('2026-09-23'), d('2026-09-24'))).toBe(true);
    expect(isPast(d('2026-09-24'), d('2026-09-24'))).toBe(false);
    expect(isToday(d('2026-09-24'), d('2026-09-24'))).toBe(true);
  });
});

describe('greeting and durations', () => {
  it('picks the greeting by hour', () => {
    const at = (h: number) => new Date(2026, 8, 24, h);
    expect(greetingKey(at(7))).toBe('morning');
    expect(greetingKey(at(13))).toBe('afternoon');
    expect(greetingKey(at(19))).toBe('evening');
    expect(greetingKey(at(23))).toBe('night');
    expect(greetingKey(at(3))).toBe('night');
  });

  it('formats durations and clocks', () => {
    expect(formatDuration(45 * 60)).toBe('45 min');
    expect(formatDuration(96 * 60)).toBe('1h 36m');
    expect(formatDuration(7200)).toBe('2h');
    expect(formatDuration(30)).toBe('30 s');
    expect(formatDuration(-5)).toBe('0 s');
    expect(formatClock(161_000)).toBe('02:41');
    expect(formatClock(3_761_000)).toBe('1:02:41');
    expect(formatClock(-100)).toBe('00:00');
    expect(formatClock(1)).toBe('00:01');
  });
});
