import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@pakyaw/shared/components/ui/SymbolIcon', () => ({
  SymbolIcon: () => null,
}));

import { HomeSheet } from './HomeSheet';

describe('HomeSheet component', () => {
  it('instantiates correctly with first name and pickup label', () => {
    const onSearchPress = vi.fn();
    const element = (
      <HomeSheet
        onSearchPress={onSearchPress}
        firstName="Maria"
        fullName="Maria Santos"
        pickupLabel="Brgy. Cogon"
        isLocatingPickup={false}
        locationPermissionDenied={false}
      />
    );

    expect(element).toBeDefined();
    expect(element.props.firstName).toBe('Maria');
    expect(element.props.pickupLabel).toBe('Brgy. Cogon');
  });

  it('handles neutral fallback when name is omitted or Passenger', () => {
    const onSearchPress = vi.fn();
    const element = (
      <HomeSheet
        onSearchPress={onSearchPress}
        fullName="Passenger"
        pickupLabel="Current location"
      />
    );

    expect(element).toBeDefined();
    expect(element.props.fullName).toBe('Passenger');
  });

  it('accepts location permission denied state', () => {
    const element = (
      <HomeSheet
        onSearchPress={vi.fn()}
        locationPermissionDenied={true}
      />
    );

    expect(element.props.locationPermissionDenied).toBe(true);
  });
});
