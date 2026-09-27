import { presetDiff } from '../defaults';

const items = [
  { id: 'd', slug: 'dumbbells', available: true },
  { id: 'c', slug: 'cable_machine', available: true },
  { id: 'b', slug: 'resistance_bands', available: false },
  { id: 'x', slug: null, available: true }, // custom item
];

describe('presetDiff', () => {
  it('lists what a preset switches on and off, keeping custom items as they are', () => {
    expect(presetDiff(items, 'travel')).toEqual({
      ids: ['b', 'x'],
      turnOn: ['b'],
      turnOff: ['d', 'c'],
    });
    expect(presetDiff(items, 'full_gym')).toEqual({
      ids: ['d', 'c', 'b', 'x'],
      turnOn: ['b'],
      turnOff: [],
    });
  });
});
