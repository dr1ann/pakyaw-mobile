import { isValidElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { TripHistoryItem } from '@pakyaw/shared/features/trip-history/types';
import { TripHistoryCard } from './TripHistoryCard';

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

const completedTrip: TripHistoryItem = {
  tripId: 'history-completed',
  status: 'completed',
  mode: 'solo',
  pickup: { label: 'Ormoc City Hall' },
  destination: { label: 'Ormoc Superdome' },
  passengerCount: 1,
  fareTotal: 68.6,
  routeDistanceMeters: 1_450,
  requestedAt: { seconds: 1_700_000_000, nanoseconds: 0 },
  completedAt: { seconds: 1_700_000_600, nanoseconds: 0 },
  cancelledAt: null,
  driver: { displayName: 'Mang Ramon', plate: 'ABC-123' },
  bookingFor: 'self',
  riderFirstName: null,
};

describe('TripHistoryCard', () => {
  it('makes a completed passenger ride scannable and accessible', () => {
    const copy = visibleCopy(TripHistoryCard({ trip: completedTrip, onPress: vi.fn() }));

    expect(copy).toContain('Completed');
    expect(copy).toContain('Pakyaw');
    expect(copy).toContain('Ormoc City Hall');
    expect(copy).toContain('Ormoc Superdome');
    expect(copy).toContain('Driver: Mang Ramon');
    expect(copy).toContain('₱68.60');
    expect(copy).toContain('1.4 km');
  });

  it('keeps cancelled rows neutral and omits completed-only fare and distance', () => {
    const copy = visibleCopy(TripHistoryCard({
      trip: {
        ...completedTrip,
        tripId: 'history-cancelled',
        status: 'cancelled',
        mode: 'hop',
        fareTotal: 99,
        routeDistanceMeters: 2_000,
        completedAt: null,
        cancelledAt: { seconds: 1_700_000_300, nanoseconds: 0 },
      },
      onPress: vi.fn(),
    }));

    expect(copy).toContain('Cancelled');
    expect(copy).toContain('Hop');
    expect(copy).not.toContain('₱99.00');
    expect(copy).not.toContain('2.0 km');
  });
});
