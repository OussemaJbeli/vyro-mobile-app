import { forecast, kcal, metFor, projectWeights } from '../forecast';

describe('forecast', () => {
  it('estimates calories with MET × weight × time', () => {
    expect(kcal(metFor('running', 'Real Speed'), 90, 24)).toBe(342);
    expect(kcal(metFor('gym', 'Push'), 90, 70)).toBe(525);
  });

  it('uses training calories × adherence when no weight trend exists', () => {
    const f = forecast({
      weightKg: 90,
      targetKg: 85,
      measuredPerWeek: null,
      done: [
        { type: 'gym', title: 'Push', minutes: 70, daysAgo: 1 },
        { type: 'running', title: 'Real Speed', minutes: 24, daysAgo: 1 },
      ],
      pastPlanned: 4, // 2 of 4 done → 50 %
      upcoming: Array.from({ length: 12 }, () => ({ type: 'gym', title: 'Push', minutes: 70 })),
    });
    expect(f.burned7).toBe(867);
    expect(f.adherence).toBe(0.5);
    expect(f.missed28).toBe(2);
    expect(f.basis).toBe('training');
    // 12 × 525 kcal over 4 weeks = 1575/wk × 50 % ≈ −0.1 kg/wk → 5 kg ≈ 49 weeks.
    expect(f.weeksToGoal).toBe(49);
  });

  it('prefers the measured trend (it includes diet)', () => {
    const f = forecast({
      weightKg: 90,
      targetKg: 85,
      measuredPerWeek: -0.5,
      done: [],
      pastPlanned: 0,
      upcoming: [],
    });
    expect(f.basis).toBe('measured');
    expect(f.weeksToGoal).toBe(10);
    expect(projectWeights(90, -0.5, 85).at(-1)).toBe(85);
  });
});
