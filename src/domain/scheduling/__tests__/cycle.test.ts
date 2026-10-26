import { advanceCycle, cycleOrder, initialCycle, projectCycle, remapState } from '../cycle';

const order = cycleOrder({
  groups: ['push', 'pull', 'legs'].map((id) => ({
    id,
    name: id,
    runTemplateId: null,
    gymTemplateId: null,
  })),
});

describe('completion-based cycle', () => {
  it('repeats a missed day instead of skipping ahead', () => {
    const done = new Set(['2026-10-18:push']);
    const s = advanceCycle({ date: '2026-10-18', index: 0 }, '2026-10-20', order, (d, day) =>
      done.has(`${d}:${day}`),
    );
    expect(s).toEqual({ date: '2026-10-20', index: 1 });
  });

  it('rest comes only after every day group is completed, then the cycle restarts', () => {
    expect(projectCycle({ date: '2026-10-18', index: 0 }, order, 5).map((x) => x.dayId)).toEqual([
      'push',
      'pull',
      'legs',
      'rest',
      'push',
    ]);
  });

  it('starts with Day 1 on the setup day', () => {
    expect(initialCycle('2026-10-15')).toEqual({ date: '2026-10-15', index: 0 });
  });

  it('keeps the current day group when the order changes', () => {
    const reordered = ['legs', 'push', 'pull', 'rest'];
    expect(remapState({ date: 'd', index: 1 }, order, reordered)).toEqual({ date: 'd', index: 2 });
  });
});
