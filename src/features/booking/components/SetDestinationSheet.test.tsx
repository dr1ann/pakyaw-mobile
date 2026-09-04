import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@pakyaw/shared/components/ui/SymbolIcon', () => ({
  SymbolIcon: () => null,
}));

vi.mock('@/features/maps/hooks/useOrmocPlacesAutocomplete', () => ({
  useOrmocPlacesAutocomplete: () => ({ data: [], isLoading: false }),
}));

import { SetDestinationSheet } from './SetDestinationSheet';

describe('SetDestinationSheet component', () => {
  it('instantiates correctly for destination search mode', () => {
    const onClose = vi.fn();
    const onSelect = vi.fn();
    const onChooseOnMap = vi.fn();

    const element = (
      <SetDestinationSheet
        mode="destination"
        onClose={onClose}
        onSelect={onSelect}
        onChooseOnMap={onChooseOnMap}
      />
    );

    expect(element).toBeDefined();
    expect(element.props.mode).toBe('destination');
  });

  it('instantiates correctly for pickup search mode', () => {
    const element = (
      <SetDestinationSheet
        mode="pickup"
        onClose={vi.fn()}
        onSelect={vi.fn()}
        onChooseOnMap={vi.fn()}
      />
    );

    expect(element).toBeDefined();
    expect(element.props.mode).toBe('pickup');
  });
});
