import { isValidElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { TripDoc } from '@pakyaw/shared/features/trip/types';
import { TripCompletionSheet } from './TripCompletionSheet';

vi.mock('@pakyaw/shared/components/ui/SymbolIcon', () => ({
  SymbolIcon: () => null,
}));

function visibleCopy(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(visibleCopy).join(' ');
  if (!isValidElement(node)) return '';

  const props = node.props as {
    readonly accessibilityLabel?: unknown;
    readonly children?: ReactNode;
    readonly label?: unknown;
  };
  return [
    typeof props.accessibilityLabel === 'string' ? props.accessibilityLabel : '',
    typeof props.label === 'string' ? props.label : '',
    visibleCopy(props.children),
  ].join(' ');
}

const completedTrip: TripDoc = {
  id: 'trip-completed',
  mode: 'solo',
  status: 'completed',
  passengerId: 'passenger-1',
  driverId: 'driver-1',
  driverPublic: {
    driverId: 'driver-1',
    displayName: 'Mang Ramon',
    profilePhotoUrl: null,
    vehicle: {
      type: 'Tricycle',
      description: 'Blue tricycle',
      plateNumber: 'ABC-123',
      unitBodyNumber: '021',
    },
    verification: { verified: true },
  },
  pickup: { label: 'Ormoc City Hall', coords: { lat: 11.005, lng: 124.607 } },
  destination: { label: 'Ormoc Superdome', coords: { lat: 11.007, lng: 124.609 } },
  passengerCount: 1,
  billedSeats: 1,
  geohash: 'w9x8y7',
  requestedAt: { seconds: 1_700_000_000, nanoseconds: 0 },
  acceptedAt: null,
  completedAt: { seconds: 1_700_000_600, nanoseconds: 0 },
  cancelledAt: null,
  cancelledBy: null,
  cancelReason: null,
  fare: 999,
  fareBreakdown: {
    baseFare: 50,
    distanceFare: 10,
    surcharges: 0,
    techFee: 8.6,
    total: 68.6,
    driverEarnings: 60,
  },
};

describe('TripCompletionSheet', () => {
  it('shows the completed snapshot with the canonical fare and safe ride facts', () => {
    const copy = visibleCopy(
      TripCompletionSheet({ trip: completedTrip, onDone: vi.fn(), onViewActivity: vi.fn() }),
    );

    expect(copy).toContain('Trip completed');
    expect(copy).toContain('Pakyaw');
    expect(copy).toContain('Ormoc City Hall');
    expect(copy).toContain('Ormoc Superdome');
    expect(copy).toContain('Mang Ramon');
    expect(copy).toContain('ABC-123');
    expect(copy).toContain('₱68.60');
    expect(copy).not.toContain('₱999.00');
    expect(copy).toContain('View Activity');
    expect(copy).toContain('Done');
  });

  it.each([
    ['solo', 'Pakyaw'],
    ['shared', 'Shared'],
    ['hop', 'Hop'],
  ] as const)('uses the Passenger name for %s completed rides', (mode, label) => {
    const copy = visibleCopy(
      TripCompletionSheet({
        trip: { ...completedTrip, mode },
        onDone: vi.fn(),
        onViewActivity: vi.fn(),
      }),
    );

    expect(copy).toContain(label);
  });

  it('does not make payment, rating, or accounting claims', () => {
    const copy = visibleCopy(
      TripCompletionSheet({ trip: completedTrip, onDone: vi.fn(), onViewActivity: vi.fn() }),
    ).toLowerCase();

    expect(copy).not.toContain('payment successful');
    expect(copy).not.toContain('amount paid');
    expect(copy).not.toContain('rating');
    expect(copy).not.toContain('earnings');
    expect(copy).not.toContain('official receipt');
  });
});
