import { weightDelta } from '../summary';

describe('weightDelta', () => {
  it('compares with last session', () => {
    expect(weightDelta(12, 10)).toEqual({ kg: 2, pct: 20 });
    expect(weightDelta(9, 10)).toEqual({ kg: -1, pct: -10 });
    expect(weightDelta(10, 10)).toBeNull();
    expect(weightDelta(10, null)).toBeNull();
  });
});
