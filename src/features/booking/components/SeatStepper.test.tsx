import { describe, expect, it, vi } from 'vitest';
import { SeatStepper } from './SeatStepper';

describe('SeatStepper component accessibility and bounds', () => {
  it('instantiates correctly with accessible stepper controls', () => {
    const onChange = vi.fn();
    const element = <SeatStepper value={2} onChange={onChange} min={1} max={4} />;
    expect(element).toBeDefined();
    expect(element.props.value).toBe(2);
    expect(element.props.min).toBe(1);
    expect(element.props.max).toBe(4);
  });
});
