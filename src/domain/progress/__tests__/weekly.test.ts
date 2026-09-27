import { weekSummary } from '../weekly';

describe('weekly summary', () => {
  it('counts by type, total time, planned completion and active days', () => {
    const r = weekSummary(
      [
        { date: '2026-09-21', type: 'gym', activeSeconds: 3000 },
        { date: '2026-09-21', type: 'running', activeSeconds: 1800 },
        { date: '2026-09-23', type: 'abs', activeSeconds: 600 },
        { date: '2026-09-24', type: 'home', activeSeconds: null },
      ],
      [
        { date: '2026-09-21', type: 'gym', status: 'completed' },
        { date: '2026-09-22', type: 'rest', status: 'planned' },
        { date: '2026-09-23', type: 'abs', status: 'modified' },
        { date: '2026-09-25', type: 'gym', status: 'planned' },
        { date: '2026-09-26', type: 'gym', status: 'cancelled' },
      ],
    );
    expect(r).toEqual({
      gym: 1,
      runs: 1,
      abs: 2,
      other: 0,
      totalSeconds: 5400,
      plannedCount: 3,
      plannedDone: 2,
      activeDays: 3,
    });
  });
});
