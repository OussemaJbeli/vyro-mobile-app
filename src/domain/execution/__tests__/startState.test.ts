import { resolveStartState, type StartSession } from '../startState';

const s = (id: string, over: Partial<StartSession> = {}): StartSession => ({
  id,
  type: 'gym',
  status: 'planned',
  startTime: null,
  orderInDay: 0,
  title: id,
  templateId: null,
  ...over,
});

describe('resolveStartState', () => {
  const day = [
    s('Running', { type: 'running', status: 'completed', orderInDay: 0 }),
    s('Gym', { orderInDay: 1 }),
    s('Six Pack', { type: 'abs', orderInDay: 2 }),
  ];

  it('continue wins while a workout is active', () => {
    const r = resolveStartState(day, { executionId: 'x', title: 'Upper Body' });
    expect(r).toMatchObject({
      fab: 'continue',
      primary: { kind: 'resume', executionId: 'x', label: 'Upper Body' },
    });
  });

  it('start: the next pending activity in order; progress counts done', () => {
    const r = resolveStartState(day, null);
    expect(r).toMatchObject({
      fab: 'start',
      primary: { kind: 'begin', sessionId: 'Gym' },
      done: 1,
    });
    expect(r.activities.map((a) => a.id)).toEqual(['Running', 'Gym', 'Six Pack']);
    const timed = resolveStartState(
      [s('late', { startTime: '19:00' }), s('early', { startTime: '07:00' })],
      null,
    );
    expect(timed.primary).toMatchObject({ sessionId: 'early' });
  });

  it('done when everything is handled and at least one was done', () => {
    const r = resolveStartState(
      [
        s('a', { status: 'completed' }),
        s('b', { status: 'skipped' }),
        s('c', { status: 'cancelled' }),
      ],
      null,
    );
    expect(r).toMatchObject({ fab: 'done', done: 1 });
    expect(r.activities).toHaveLength(2);
  });

  it('rest when only rest is planned (or nothing was done); empty otherwise', () => {
    expect(resolveStartState([s('r', { type: 'rest' })], null).fab).toBe('rest');
    expect(
      resolveStartState([s('a', { status: 'skipped' }), s('r', { type: 'rest' })], null).fab,
    ).toBe('rest');
    expect(resolveStartState([], null).fab).toBe('empty');
    expect(resolveStartState([s('a', { status: 'skipped' })], null).fab).toBe('empty');
  });
});
