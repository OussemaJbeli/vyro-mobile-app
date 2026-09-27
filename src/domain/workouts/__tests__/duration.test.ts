import { estimateMinutes, estimateSeconds } from '../duration';

describe('duration estimate', () => {
  it('adds work, rest between sets and transitions', () => {
    // 4 × 10 reps: 4×30 s work + 3×90 s rest + 60 s transition = 450 s.
    expect(
      estimateSeconds([{ sets: 4, targetReps: 10, targetDurationSeconds: null, restSeconds: 90 }]),
    ).toBe(450);
    // Plank 3 × 45 s with 45 s rest: 135 + 90 + 60 = 285 s.
    expect(
      estimateSeconds([{ sets: 3, targetReps: null, targetDurationSeconds: 45, restSeconds: 45 }]),
    ).toBe(285);
  });

  it('rounds to minutes and handles empty and missing values', () => {
    expect(estimateMinutes([])).toBe(0);
    expect(
      estimateMinutes([
        { sets: 1, targetReps: null, targetDurationSeconds: null, restSeconds: null },
      ]),
    ).toBe(2);
    const abs = [
      { sets: 3, targetReps: 20, targetDurationSeconds: null, restSeconds: 45 },
      { sets: 3, targetReps: 15, targetDurationSeconds: null, restSeconds: 45 },
      { sets: 3, targetReps: null, targetDurationSeconds: 45, restSeconds: 45 },
      { sets: 3, targetReps: 20, targetDurationSeconds: null, restSeconds: 45 },
    ];
    // 330 + 285 + 285 + 330 = 1230 s = 20.5 min → 21.
    expect(estimateMinutes(abs)).toBe(21);
  });
});
