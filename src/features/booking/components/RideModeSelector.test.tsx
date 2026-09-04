import { describe, expect, it, vi } from 'vitest';
import { RideModeSelector } from './RideModeSelector';

vi.mock('@pakyaw/shared/components/ui/SymbolIcon', () => ({
  SymbolIcon: () => null,
}));

describe('RideModeSelector component', () => {
  it('instantiates correctly for Pakyaw (private) mode', () => {
    const onSelectMode = vi.fn();
    const element = (
      <RideModeSelector selectedMode="private" onSelectMode={onSelectMode} />
    );

    expect(element).toBeDefined();
    expect(element.props.selectedMode).toBe('private');
  });

  it('instantiates correctly for Shared mode', () => {
    const onSelectMode = vi.fn();
    const element = (
      <RideModeSelector selectedMode="shared" onSelectMode={onSelectMode} />
    );

    expect(element).toBeDefined();
    expect(element.props.selectedMode).toBe('shared');
  });

  it('instantiates correctly for Hop mode', () => {
    const onSelectMode = vi.fn();
    const element = (
      <RideModeSelector selectedMode="hopon" onSelectMode={onSelectMode} />
    );

    expect(element).toBeDefined();
    expect(element.props.selectedMode).toBe('hopon');
  });
});
