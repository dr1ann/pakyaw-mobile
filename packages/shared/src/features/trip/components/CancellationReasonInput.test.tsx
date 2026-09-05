import { describe, expect, it, vi } from 'vitest';
import { CancellationReasonInput } from './CancellationReasonInput';
import { CANCELLATION_REASONS, isCancellationReason } from '../cancellationReasons';

describe('cancellation choices', () => {
  it('offers one Other option and no default selection', () => {
    expect(CANCELLATION_REASONS.filter(({ code }) => code === 'other')).toHaveLength(1);
    const tree = CancellationReasonInput({ value: '', onChangeText: vi.fn() });
    const options = tree.props.children[1];
    expect(options).toHaveLength(6);
    expect(options.every((option: any) => !option.props.accessibilityState.selected)).toBe(true);
  });
  it.each(CANCELLATION_REASONS)('selects supported code $code', ({ code }) => {
    const onChangeText = vi.fn();
    const tree = CancellationReasonInput({ value: code, onChangeText });
    const option = tree.props.children[1].find((item: any) => item.key === code);
    expect(option.props.accessibilityState.selected).toBe(true);
    option.props.onPress();
    expect(onChangeText).toHaveBeenCalledWith(code);
    expect(isCancellationReason(code)).toBe(true);
  });
});
