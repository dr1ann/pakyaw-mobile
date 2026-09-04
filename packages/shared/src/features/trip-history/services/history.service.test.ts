import { describe, expect, it, vi, beforeEach } from 'vitest';
import { listForPassenger, getTrip } from './history.service';
import * as firebaseModule from '@/services/firebase/firebase';

vi.mock('@/services/firebase/firebase', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  firestore: {},
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  limit: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  startAfter: vi.fn(),
  Timestamp: class MockTimestamp {
    seconds: number;
    nanoseconds: number;
    constructor(s: number, ns: number) {
      this.seconds = s;
      this.nanoseconds = ns;
    }
  },
  where: vi.fn(),
  FirebaseError: class MockFirebaseError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

describe('history.service — listForPassenger and getTrip mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('listForPassenger maps completed and cancelled trip documents with authoritative fields', async () => {
    const mockSnap = {
      docs: [
        {
          id: 'trip-1',
          data: () => ({
            status: 'completed',
            mode: 'solo',
            fare: 68.5,
            passengerId: 'user-1',
            pickup: { label: 'Ormoc City Hall' },
            destination: { label: 'Robinsons Place' },
            passengerCount: 1,
            requestedAt: { seconds: 1788520000, nanoseconds: 0 },
            completedAt: { seconds: 1788521000, nanoseconds: 0 },
            driverPublic: {
              driverId: 'd-1',
              displayName: 'Mang Juan',
              profilePhotoUrl: null,
              vehicle: {
                plateNumber: '8899 HA',
              },
              verification: { verified: true },
            },
            route: {
              distanceMeters: 3200,
            },
            bookingFor: 'self',
          }),
        },
      ],
    };

    vi.spyOn(firebaseModule, 'getDocs').mockResolvedValue(mockSnap as any);

    const result = await listForPassenger('user-1', { limit: 10, cursor: null });
    expect(result.trips).toHaveLength(1);
    expect(result.trips[0].tripId).toBe('trip-1');
    expect(result.trips[0].mode).toBe('solo');
    expect(result.trips[0].fare).toBe(68.5);
    expect(result.trips[0].distanceMeters).toBe(3200);
    expect(result.trips[0].driver?.displayName).toBe('Mang Juan');
    expect(result.trips[0].driver?.plate).toBe('8899 HA');
  });

  it('getTrip maps trip detail snapshot correctly', async () => {
    const mockDocSnap = {
      exists: () => true,
      id: 'trip-1',
      data: () => ({
        status: 'completed',
        mode: 'shared',
        passengerId: 'user-1',
        driverId: 'd-1',
        pickup: { label: 'Ormoc City Hall' },
        destination: { label: 'Robinsons Place' },
        passengerCount: 2,
        billedSeats: 2,
        geohash: 'w9x8y7',
        requestedAt: { seconds: 1788520000, nanoseconds: 0 },
        completedAt: { seconds: 1788521000, nanoseconds: 0 },
        fareBreakdown: {
          baseFare: 20,
          distanceFare: 7.5,
          surcharges: 0,
          techFee: 7.5,
          total: 35,
        },
        driverPublic: {
          driverId: 'd-1',
          displayName: 'Mang Juan',
          profilePhotoUrl: null,
          vehicle: {
            plateNumber: '8899 HA',
            description: 'Blue Bajaj',
          },
          verification: { verified: true },
        },
        route: {
          distanceMeters: 2500,
        },
        bookingFor: 'other',
        rider: { firstName: 'Maria' },
      }),
    };

    vi.spyOn(firebaseModule, 'getDoc').mockResolvedValue(mockDocSnap as any);

    const trip = await getTrip('trip-1');
    expect(trip.id).toBe('trip-1');
    expect(trip.mode).toBe('shared');
    expect(trip.fare).toBe(35);
    expect(trip.fareBreakdown?.total).toBe(35);
    expect(trip.bookingFor).toBe('other');
    expect(trip.rider?.firstName).toBe('Maria');
    expect(trip.driverPublic?.displayName).toBe('Mang Juan');
  });
});
