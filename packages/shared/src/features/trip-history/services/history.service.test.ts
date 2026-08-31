import { FirebaseError } from 'firebase/app';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PermissionError, NotFoundError, NetworkError } from '../errors';
import { listForPassenger, getTrip } from './history.service';

// Mock firestore operations
const mockGetDocs = vi.fn();
const mockGetDoc = vi.fn();
const mockQuery = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();
const mockStartAfter = vi.fn();

vi.mock('firebase/firestore', () => {
  class MockTimestamp {
    seconds: number;
    nanoseconds: number;
    constructor(seconds: number, nanoseconds: number) {
      this.seconds = seconds;
      this.nanoseconds = nanoseconds;
    }
  }

  return {
    collection: vi.fn(() => 'trips-col'),
    doc: vi.fn((_fs, coll, id) => ({ collection: coll, id })),
    getDocs: () => mockGetDocs(),
    getDoc: () => mockGetDoc(),
    query: vi.fn((...args: any[]) => {
      mockQuery(...args);
      return { type: 'query', args };
    }),
    where: vi.fn((field, op, val) => {
      mockWhere(field, op, val);
      return { type: 'where', field, op, val };
    }),
    orderBy: vi.fn((field, dir) => {
      mockOrderBy(field, dir);
      return { type: 'orderBy', field, dir };
    }),
    limit: vi.fn((n) => {
      mockLimit(n);
      return { type: 'limit', value: n };
    }),
    startAfter: vi.fn((val) => {
      mockStartAfter(val);
      return { type: 'startAfter', value: val };
    }),
    Timestamp: MockTimestamp,
  };
});

vi.mock('@/services/firebase/firebase', () => ({
  firestore: {},
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Tests for history.service

describe('history.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listForPassenger', () => {
    it('issues the correct query for passenger history', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: 'trip-1',
            data: () => ({
              status: 'completed',
              passengerId: 'p-1',
              pickup: { label: 'Origin' },
              destination: { label: 'Destination' },
              passengerCount: 2,
              requestedAt: { seconds: 1000, nanoseconds: 0 },
            }),
          },
        ],
      });

      const result = await listForPassenger('p-1', { limit: 5, cursor: null });

      expect(mockWhere).toHaveBeenCalledWith('passengerId', '==', 'p-1');
      expect(mockWhere).toHaveBeenCalledWith('status', 'in', ['completed', 'cancelled']);
      expect(mockOrderBy).toHaveBeenCalledWith('requestedAt', 'desc');
      expect(mockLimit).toHaveBeenCalledWith(5);
      expect(result.trips).toHaveLength(1);
      expect(result.trips[0].tripId).toBe('trip-1');
      expect(result.trips[0].status).toBe('completed');
      expect(result.nextCursor).toBeNull();
    });

    it('paginates using cursor when provided', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: 'trip-2',
            data: () => ({
              status: 'cancelled',
              passengerId: 'p-1',
              pickup: { label: 'Origin' },
              destination: { label: 'Destination' },
              passengerCount: 1,
              requestedAt: { seconds: 500, nanoseconds: 0 },
            }),
          },
        ],
      });

      const cursor = { seconds: 1000, nanoseconds: 0 };
      await listForPassenger('p-1', { limit: 5, cursor });

      expect(mockStartAfter).toHaveBeenCalled();
      // Should pass reconstructed Timestamp to startAfter
      const startAfterCall = vi.mocked(mockStartAfter).mock.calls[0][0];
      expect(startAfterCall.seconds).toBe(1000);
      expect(startAfterCall.nanoseconds).toBe(0);
    });

    it('returns nextCursor when list length equals limit', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: 'trip-1',
            data: () => ({
              status: 'completed',
              requestedAt: { seconds: 2000, nanoseconds: 10 },
            }),
          },
          {
            id: 'trip-2',
            data: () => ({
              status: 'cancelled',
              requestedAt: { seconds: 1000, nanoseconds: 20 },
            }),
          },
        ],
      });

      const result = await listForPassenger('p-1', { limit: 2, cursor: null });

      expect(result.trips).toHaveLength(2);
      expect(result.nextCursor).toEqual({ seconds: 1000, nanoseconds: 20 });
    });
  });

  describe('getTrip', () => {
    it('fetches single trip details', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        id: 'trip-abc',
        data: () => ({
          mode: 'solo',
          status: 'completed',
          passengerId: 'p-1',
          driverId: 'd-1',
          pickup: { label: 'Origin' },
          destination: { label: 'Destination' },
          passengerCount: 2,
          billedSeats: 4,
          geohash: '9q5',
          requestedAt: null,
          driverPublic: {
            driverId: 'd-1',
            displayName: 'John Driver',
            profilePhotoUrl: null,
            vehicle: {
              type: 'tricycle',
              description: 'Blue tricycle',
              plateNumber: 'ABC-123',
              unitBodyNumber: 'UNIT-001',
            },
            verification: { verified: true },
          },
          driver: {
            displayName: 'John Driver',
            phone: '123',
            rating: 4.8,
            tripCount: 100,
            plate: 'ABC-123',
          },
        }),
      });

      const trip = await getTrip('trip-abc');

      expect(trip.id).toBe('trip-abc');
      expect(trip.driver?.displayName).toBe('John Driver');
      expect(trip.driver?.plate).toBe('ABC-123');
      expect(trip.driverPublic?.vehicle.plateNumber).toBe('ABC-123');
      expect(trip.driver).not.toHaveProperty('rating');
      expect(trip.driver).not.toHaveProperty('phone');
    });

    it('throws NotFoundError when trip does not exist', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });

      await expect(getTrip('missing')).rejects.toThrow(NotFoundError);
    });

    it('translates permission-denied FirebaseError', async () => {
      mockGetDoc.mockRejectedValueOnce(
        new FirebaseError('permission-denied', 'Missing permissions.'),
      );

      await expect(getTrip('secret-trip')).rejects.toThrow(PermissionError);
    });

    it('translates unavailable FirebaseError', async () => {
      mockGetDoc.mockRejectedValueOnce(
        new FirebaseError('unavailable', 'Firestore is offline.'),
      );

      await expect(getTrip('any-trip')).rejects.toThrow(NetworkError);
    });
  });
});
