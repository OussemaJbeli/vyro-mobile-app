import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState, type ReactElement } from 'react';

import { ThemeProvider, type SessionStatus } from '@/theme';

import { Button } from '../Button';
import { ChipGroup } from '../Chip';
import { NumberStepper } from '../NumberStepper';
import { parseTyped, repeatDelay, stepValue } from '../numberStep';
import { StatusTag } from '../StatusTag';

const renderThemed = (ui: ReactElement) => render(<ThemeProvider>{ui}</ThemeProvider>);

describe('Button', () => {
  it('calls onPress', async () => {
    const onPress = jest.fn();
    await renderThemed(<Button label="Start" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Start' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire when disabled or loading, and exposes the state', async () => {
    const onPress = jest.fn();
    await renderThemed(
      <>
        <Button label="Disabled" disabled onPress={onPress} />
        <Button label="Saving" loading onPress={onPress} />
      </>,
    );
    const disabled = screen.getByRole('button', { name: 'Disabled' });
    const loading = screen.getByRole('button', { name: 'Saving' });
    await fireEvent.press(disabled);
    await fireEvent.press(loading);
    expect(onPress).not.toHaveBeenCalled();
    expect(disabled).toBeDisabled();
    expect(loading).toBeBusy();
  });
});

describe('StatusTag', () => {
  const labels: Record<SessionStatus, string> = {
    planned: 'Pending',
    in_progress: 'Next',
    completed: 'Completed',
    modified: 'Modified',
    skipped: 'Skipped',
    cancelled: 'Cancelled',
    missed: 'Missed',
  };

  it.each(Object.entries(labels))('shows a text label for %s', async (status, label) => {
    await renderThemed(<StatusTag status={status as SessionStatus} />);
    expect(screen.getByText(label)).toBeTruthy();
    expect(screen.getByLabelText(label)).toBeTruthy();
  });

  it('accepts a custom label', async () => {
    await renderThemed(<StatusTag status="in_progress" label="Set 2 / 4" />);
    expect(screen.getByText('Set 2 / 4')).toBeTruthy();
  });
});

describe('number stepping', () => {
  it('snaps to the step grid without float drift', () => {
    expect(stepValue(0.1, 1, { step: 0.1 })).toBe(0.2);
    expect(stepValue(0.2, 1, { step: 0.1 })).toBe(0.3);
    expect(stepValue(60, 1, { step: 2.5 })).toBe(62.5);
  });

  it('clamps to bounds', () => {
    expect(stepValue(0, -1, { step: 1, min: 0 })).toBe(0);
    expect(stepValue(100, 1, { step: 1, max: 100 })).toBe(100);
  });

  it('parses typed values with comma or dot and rejects junk', () => {
    expect(parseTyped('62,5', { step: 0.5 })).toBe(62.5);
    expect(parseTyped('abc', { step: 1 })).toBeNull();
    expect(parseTyped('', { step: 1 })).toBeNull();
    expect(parseTyped('500', { step: 1, max: 300 })).toBe(300);
  });

  it('accelerates on long press', () => {
    expect(repeatDelay(0)).toBeGreaterThan(repeatDelay(10));
    expect(repeatDelay(10)).toBeGreaterThan(repeatDelay(20));
  });
});

describe('NumberStepper', () => {
  function Harness({ initial, max }: { initial: number; max?: number }) {
    const [v, setV] = useState(initial);
    return (
      <NumberStepper
        label="Weight"
        value={v}
        onChange={setV}
        step={2.5}
        min={0}
        {...(max !== undefined ? { max } : {})}
        unit="kg"
        testID="w"
      />
    );
  }

  it('steps up and down', async () => {
    await renderThemed(<Harness initial={60} />);
    await fireEvent.press(screen.getByTestId('w-inc'));
    expect(screen.getByText('62.5')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('w-dec'));
    await fireEvent.press(screen.getByTestId('w-dec'));
    expect(screen.getByText('57.5')).toBeTruthy();
  });

  it('disables the button at a bound', async () => {
    await renderThemed(<Harness initial={0} />);
    expect(screen.getByTestId('w-dec')).toBeDisabled();
  });
});

describe('ChipGroup', () => {
  const options = [
    { value: 'all', label: 'All' },
    { value: 'gym', label: 'Gym' },
    { value: 'running', label: 'Running' },
  ];

  it('single select replaces the value', async () => {
    const onChange = jest.fn();
    await renderThemed(<ChipGroup options={options} value="all" onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'All' })).toBeSelected();
    await fireEvent.press(screen.getByRole('button', { name: 'Gym' }));
    expect(onChange).toHaveBeenCalledWith('gym');
  });

  it('multi select toggles values in and out', async () => {
    function Multi() {
      const [v, setV] = useState<string[]>(['gym']);
      return <ChipGroup multiple options={options} value={v} onChange={setV} />;
    }
    await renderThemed(<Multi />);
    await fireEvent.press(screen.getByRole('button', { name: 'Running' }));
    expect(screen.getByRole('button', { name: 'Running' })).toBeSelected();
    await fireEvent.press(screen.getByRole('button', { name: 'Gym' }));
    expect(screen.getByRole('button', { name: 'Gym' })).not.toBeSelected();
  });
});
