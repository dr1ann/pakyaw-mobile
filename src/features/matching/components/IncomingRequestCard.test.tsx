import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  acceptMutate: vi.fn(),
  declineTripOffer: vi.fn(),
  vibrate: vi.fn(),
}));

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useState: (initial: any) => [typeof initial === 'function' ? initial() : initial, vi.fn()],
    useCallback: (fn: any) => fn,
    useEffect: vi.fn(),
  };
});

vi.mock('react-native/Libraries/Vibration/Vibration', () => ({
  default: {
    vibrate: mocks.vibrate,
  },
  vibrate: mocks.vibrate,
}));

vi.mock('@/features/matching/services/matching.service', () => ({
  declineTripOffer: mocks.declineTripOffer,
}));

vi.mock('@/features/matching/hooks/useAcceptTrip', () => ({
  useAcceptTrip: () => ({
    mutate: mocks.acceptMutate,
    isPending: false,
  }),
}));

vi.mock('@pakyaw/shared/stores/sessionStore', () => ({
  useSessionStore: (selector: (s: any) => any) => selector({ uid: 'driver-test-1' }),
}));

vi.mock('@/stores/availabilityStore', () => ({
  useAvailabilityStore: Object.assign(
    (selector: (s: any) => any) =>
      selector({
        lastLatitude: 11.002,
        lastLongitude: 124.603,
      }),
    {
      getState: () => ({
        removeIncomingRequest: vi.fn(),
      }),
    }
  ),
}));

vi.mock('@pakyaw/shared/components/ui/SymbolIcon', () => ({
  SymbolIcon: () => null,
}));

import { IncomingRequestCard } from '@/features/matching/components/IncomingRequestCard';
import type { IncomingRequest } from '@/features/matching/types';

describe('IncomingRequestCard — Phase 11 Driver Incoming Request UI', () => {
  const baseRequest: IncomingRequest = {
    tripId: 'trip-101',
    offerId: 'offer-101',
    mode: 'solo',
    pickup: {
      label: 'Robinsons Place Ormoc',
      address: 'Palo-Carigara-Ormoc Road',
      coords: { lat: 11.005, lng: 124.605 },
    },
    destination: {
      label: 'Ormoc Airport',
      address: 'Airport Road, Ormoc City',
      coords: { lat: 11.055, lng: 124.655 },
    },
    passengerCount: 2,
    billedSeats: 4,
    status: 'pending',
    route: {
      distanceMeters: 4800,
      durationSeconds: 720,
    },
    fare: {
      total: 180,
      driverEarnings: 150,
    },
    offeredAt: 1_700_000_000_000,
    expiresAt: Date.now() + 15_000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Pakyaw request with authoritative fare, locations, and mode badge', () => {
    const tree = IncomingRequestCard({ request: baseRequest });
    const json = JSON.stringify(tree);

    expect(json).toContain('PAKYAW');
    expect(json).toContain('2 passengers');
    expect(json).toContain('Robinsons Place Ormoc');
    expect(json).toContain('Ormoc Airport');
    expect(json).toContain('₱180.00');
  });

  it('displays authoritative road-trip distance (4.8 km) and does NOT display ambiguous Haversine distance', () => {
    const tree = IncomingRequestCard({ request: baseRequest });
    const json = JSON.stringify(tree);

    expect(json).toContain('4.8 km trip');
    // Regression check: straight-line pickup->destination Haversine (~7.6 km) must NOT be shown as the trip distance
    expect(json).not.toContain('7.6 km trip');
  });

  it('displays driver-to-pickup proximity explicitly labeled separately from trip distance', () => {
    const tree = IncomingRequestCard({ request: baseRequest });
    const json = JSON.stringify(tree);

    // Driver at (11.002, 124.603) to pickup at (11.005, 124.605) is ~0.4 km
    expect(json).toContain('Distance to pickup');
    expect(json).toContain('km to pickup');
  });

  it('regression: shows dash for trip distance when authoritative route is missing, NEVER Haversine fallback', () => {
    const requestWithoutRoute: IncomingRequest = {
      ...baseRequest,
      route: null,
    };

    const tree = IncomingRequestCard({ request: requestWithoutRoute });
    const json = JSON.stringify(tree);

    expect(json).toContain('Trip distance');
    expect(json).toContain('—');
    // Must never calculate Haversine distance and display it as trip distance
    expect(json).not.toMatch(/\d+\.\d+ km trip/);
  });

  it('renders Shared ride request with passenger count and shared notice', () => {
    const sharedRequest: IncomingRequest = {
      ...baseRequest,
      mode: 'shared',
      passengerCount: 1,
      billedSeats: 1,
    };

    const tree = IncomingRequestCard({ request: sharedRequest });
    const json = JSON.stringify(tree);

    expect(json).toContain('SHARED');
    expect(json).toContain('1 passenger');
    expect(json).toContain('Shared ride: other passengers with matching routes may join.');
  });

  it('renders Hop request with hop badge and hop notice', () => {
    const hopRequest: IncomingRequest = {
      ...baseRequest,
      mode: 'hop',
      passengerCount: 1,
      billedSeats: 1,
      sharedRideId: 'shared-session-99',
    };

    const tree = IncomingRequestCard({ request: hopRequest });
    const json = JSON.stringify(tree);

    expect(json).toContain('HOP');
    expect(json).toContain('Hop request: joins your active Shared Ride upon acceptance.');
  });

  it('renders third-party booking notice with rider first name and note without exposing personal info', () => {
    const otherRequest: IncomingRequest = {
      ...baseRequest,
      bookingFor: 'other',
      rider: { firstName: 'Maria' },
      pickupNote: 'Behind the church near mango tree',
    };

    const tree = IncomingRequestCard({ request: otherRequest });
    const json = JSON.stringify(tree);

    expect(json).toContain('Booked for someone else');
    expect(json).toContain('Rider: ');
    expect(json).toContain('Maria');
    expect(json).toContain('Behind the church near mango tree');

    // Privacy invariant: no sensitive booker fields
    expect(json).not.toMatch(/09\d{9}/);
    expect(json).not.toContain('@');
  });

  it('provides accessible TalkBack labels for Accept and Decline actions', () => {
    const tree = IncomingRequestCard({ request: baseRequest });
    const json = JSON.stringify(tree);

    expect(json).toContain('Accept ride request for ₱180.00');
    expect(json).toContain('Decline ride request');
  });
});
