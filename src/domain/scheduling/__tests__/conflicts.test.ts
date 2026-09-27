import { detectConflicts, displayStatus, nextFreeDay, type SessionLike } from '../conflicts';

const s = (over: Partial<SessionLike>): SessionLike => ({
  id: over.title ?? 'x',
  type: 'gym',
  title: 'Gym',
  scheduledDate: '2026-09-22',
  startTime: null,
  durationMinutes: 45,
  status: 'planned',
  ...over,
});

describe('conflicts', () => {
  const tuesday = [
    s({ title: 'Back', type: 'gym', startTime: '18:00', durationMinutes: 55 }),
    s({ title: 'Run', type: 'running', startTime: '07:00', durationMinutes: 30 }),
  ];

  it('FS §37: adding Chest to a Tuesday with Back + Running', () => {
    const kinds = detectConflicts(
      s({ id: 'chest', title: 'Chest', startTime: '18:30' }),
      tuesday,
    ).map((c) => c.kind);
    expect(kinds).toEqual(['time_overlap', 'same_type_same_day', 'heavy_day']);
  });

  it('flags training on a planned rest day', () => {
    expect(
      detectConflicts(s({ id: 'n' }), [s({ title: 'Rest', type: 'rest' })]).map((c) => c.kind),
    ).toEqual(['rest_day']);
    expect(detectConflicts(s({ id: 'n', type: 'rest' }), tuesday)).toEqual([]);
  });

  it('ignores the session itself, cancelled/skipped sessions and non-overlapping times', () => {
    const self = s({ id: 'same', title: 'Back', startTime: '18:00' });
    expect(detectConflicts(self, [self])).toEqual([]);
    expect(
      detectConflicts(s({ id: 'n', startTime: '20:00' }), [
        s({ title: 'x', startTime: '18:00', status: 'cancelled' }),
      ]),
    ).toEqual([]);
    expect(
      detectConflicts(s({ id: 'n', type: 'abs', startTime: '20:00', durationMinutes: 12 }), [
        tuesday[0]!,
      ]),
    ).toEqual([]);
  });

  it('flags long days by minutes too', () => {
    const c = detectConflicts(s({ id: 'n', type: 'running', durationMinutes: 100 }), [
      s({ title: 'g', durationMinutes: 60 }),
    ]);
    expect(c).toEqual([{ kind: 'heavy_day', sessions: 2, minutes: 160 }]);
  });
});

describe('display status', () => {
  it('derives missed, keeps rest as rest', () => {
    expect(displayStatus(s({ scheduledDate: '2026-09-20' }), '2026-09-22')).toBe('missed');
    expect(displayStatus(s({ scheduledDate: '2026-09-22' }), '2026-09-22')).toBe('planned');
    expect(displayStatus(s({ type: 'rest', scheduledDate: '2026-09-20' }), '2026-09-22')).toBe(
      'rest',
    );
    expect(displayStatus(s({ type: 'rest', status: 'cancelled' }), '2026-09-22')).toBe('cancelled');
    expect(
      displayStatus(s({ status: 'completed', scheduledDate: '2026-09-01' }), '2026-09-22'),
    ).toBe('completed');
  });

  it('finds the next day without training', () => {
    const week = [
      s({ scheduledDate: '2026-09-23' }),
      s({ scheduledDate: '2026-09-24' }),
      s({ type: 'rest', scheduledDate: '2026-09-25' }),
    ];
    expect(nextFreeDay('2026-09-22', week)).toBe('2026-09-25');
    expect(nextFreeDay('2026-09-22', [], 0)).toBeNull();
  });
});
