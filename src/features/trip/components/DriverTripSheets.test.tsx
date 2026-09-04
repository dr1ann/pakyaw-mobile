import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { PassengerPickupPresenceCard } from './DriverTripSheets';
import { useActiveTripStore } from '@pakyaw/shared/stores/activeTripStore';
import type { TripDoc } from '@pakyaw/shared/features/trip/types';

vi.mock('@/services/firebase/firebase', () => ({
  firestore: {},
  doc: vi.fn(),
  onSnapshot: vi.fn(() => vi.fn()),
}));

vi.mock('@pakyaw/shared/components/ui/Button', () => ({
  Button: (props: any) => React.createElement('Button', props),
}));

vi.mock('@pakyaw/shared/components/ui/StatusPill', () => ({
  StatusPill: (props: any) => React.createElement('StatusPill', props),
}));

vi.mock('@pakyaw/shared/features/trip/hooks/useTripActions', () => ({
  useTripTransition: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

const canonicalThirdPartyTrip: TripDoc = {
  id: 'trip-live-dree',
  mode: 'solo',
  status: 'accepted',
  passengerId: 'booker-uid-001',
  driverId: 'driver-uid-777',
  bookingFor: 'other',
  rider: { firstName: 'Dree' },
  pickupNote: 'Ghh',
  pickup: {
    label: 'Ormoc City Hall',
    coords: { lat: 11.005, lng: 124.6075 },
  },
  destination: {
    label: 'Ormoc Superdome',
    coords: { lat: 11.012, lng: 124.615 },
  },
  passengerCount: 1,
  billedSeats: 1,
  geohash: 'w9x8y7',
  requestedAt: null,
  acceptedAt: null,
  completedAt: null,
  cancelledAt: null,
  cancelledBy: null,
  cancelReason: null,
  fare: 55,
  fareBreakdown: {
    baseFare: 40,
    distanceFare: 10,
    surcharges: 0,
    techFee: 5,
    total: 55,
    driverEarnings: 50,
  },
  route: {
    distanceMeters: 2_100,
    durationSeconds: 300,
    polyline: 'encoded-poly',
    fetchedAt: null,
  },
};

describe('DriverAcceptedSheet and PassengerPickupPresenceCard', () => {
  beforeEach(() => {
    useActiveTripStore.getState().clearTrip();
  });

  it('renders BOOKED FOR SOMEONE ELSE state with rider name and pickup note', () => {
    useActiveTripStore.getState().setTrip(canonicalThirdPartyTrip);

    // Verify presence card directly
    const presenceCard = PassengerPickupPresenceCard({
      trip: canonicalThirdPartyTrip,
      formattedDistanceToPickup: null,
      hasLiveLocation: false,
      isBookingForOther: true,
    });

    expect(presenceCard).toBeDefined();

    // Serialize JSX tree elements to verify exact rendered strings
    const json = JSON.stringify(presenceCard);
    expect(json).toContain('BOOKED FOR SOMEONE ELSE');
    expect(json).toContain('Rider: Dree');
    expect(json).toContain('Note:');
    expect(json).toContain('Ghh');
  });

  it('renders fallback label when rider firstName is missing in third-party booking', () => {
    const tripWithoutRiderName: TripDoc = {
      ...canonicalThirdPartyTrip,
      rider: null,
      pickupNote: null,
    };

    const presenceCard = PassengerPickupPresenceCard({
      trip: tripWithoutRiderName,
      formattedDistanceToPickup: null,
      hasLiveLocation: false,
      isBookingForOther: true,
    });

    const json = JSON.stringify(presenceCard);
    expect(json).toContain('BOOKED FOR SOMEONE ELSE');
    expect(json).toContain('Third-party booking');
    expect(json).toContain('Proceed to requested pickup · no live GPS for this booking');
  });

  it('renders PASSENGER GPS when booking is for self and live location exists', () => {
    const selfTrip: TripDoc = {
      ...canonicalThirdPartyTrip,
      bookingFor: 'self',
      rider: null,
      pickupNote: null,
    };

    const presenceCard = PassengerPickupPresenceCard({
      trip: selfTrip,
      formattedDistanceToPickup: 'Passenger is ~85 m from pickup',
      hasLiveLocation: true,
      isBookingForOther: false,
    });

    const json = JSON.stringify(presenceCard);
    expect(json).toContain('PASSENGER GPS');
    expect(json).toContain('Passenger is ~85 m from pickup');
    expect(json).toContain('Pickup point:');
    expect(json).toContain('Ormoc City Hall');
  });

  it('renders location unavailable placeholder when self-booking has no live GPS', () => {
    const selfTrip: TripDoc = {
      ...canonicalThirdPartyTrip,
      bookingFor: 'self',
      rider: null,
      pickupNote: null,
    };

    const presenceCard = PassengerPickupPresenceCard({
      trip: selfTrip,
      formattedDistanceToPickup: null,
      hasLiveLocation: false,
      isBookingForOther: false,
    });

    const json = JSON.stringify(presenceCard);
    expect(json).toContain('Passenger live location unavailable · Proceed to requested pickup');
  });
});
