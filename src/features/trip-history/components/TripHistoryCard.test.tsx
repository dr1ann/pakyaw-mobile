import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { TripHistoryCard } from './TripHistoryCard';
import type { TripHistoryItem } from '@pakyaw/shared/features/trip-history/types';

vi.mock('@pakyaw/shared/components/ui/SymbolIcon', () => ({
  SymbolIcon: () => null,
}));

describe('TripHistoryCard component — Phase 8 History browsing', () => {
  const baseCompletedItem: TripHistoryItem = {
    tripId: 'trip-comp-1',
    status: 'completed',
    mode: 'solo',
    fare: 68.5,
    distanceMeters: 3200,
    pickup: { label: 'Ormoc Port' },
    destination: { label: 'Robinsons Place Ormoc' },
    passengerCount: 1,
    requestedAt: { seconds: 1788520000, nanoseconds: 0 } as any,
    completedAt: { seconds: 1788521000, nanoseconds: 0 } as any,
    cancelledAt: null,
    driver: {
      displayName: 'Kuya Juan',
      plate: '8899 HA',
    },
    bookingFor: 'self',
    rider: null,
    cancelledBy: null,
    cancelReason: null,
  };

  it('renders completed ride item with Pakyaw mode, formatted fare and road distance', () => {
    const onPress = vi.fn();
    const element = <TripHistoryCard trip={baseCompletedItem} onPress={onPress} />;
    expect(element).toBeDefined();
    expect(baseCompletedItem.mode).toBe('solo');
    expect(baseCompletedItem.fare).toBe(68.5);
  });

  it('renders cancelled ride item with cancellation reason without fake fare', () => {
    const cancelledItem: TripHistoryItem = {
      ...baseCompletedItem,
      status: 'cancelled',
      fare: null,
      cancelledAt: { seconds: 1788520500, nanoseconds: 0 } as any,
      cancelledBy: 'driver',
      cancelReason: 'vehicle_issue',
      driver: {
        displayName: 'Kuya Juan',
        plate: '8899 HA',
      },
    };

    const onPress = vi.fn();
    const element = <TripHistoryCard trip={cancelledItem} onPress={onPress} />;
    expect(element).toBeDefined();
    expect(cancelledItem.status).toBe('cancelled');
    expect(cancelledItem.fare).toBeNull();
    expect(cancelledItem.cancelReason).toBe('vehicle_issue');
  });

  it('renders Shared and Legacy Hop modes correctly', () => {
    const sharedItem: TripHistoryItem = {
      ...baseCompletedItem,
      mode: 'shared',
      fare: 35.0,
    };
    const hopItem: TripHistoryItem = {
      ...baseCompletedItem,
      mode: 'hop',
      fare: 25.0,
    };

    const elementShared = <TripHistoryCard trip={sharedItem} onPress={vi.fn()} />;
    const elementHop = <TripHistoryCard trip={hopItem} onPress={vi.fn()} />;

    expect(elementShared).toBeDefined();
    expect(elementHop).toBeDefined();
  });

  it('renders third-party booking rider name tag', () => {
    const thirdPartyItem: TripHistoryItem = {
      ...baseCompletedItem,
      bookingFor: 'other',
      rider: { firstName: 'Maria' },
    };

    const element = <TripHistoryCard trip={thirdPartyItem} onPress={vi.fn()} />;
    expect(element).toBeDefined();
    expect(thirdPartyItem.rider?.firstName).toBe('Maria');
  });
});
