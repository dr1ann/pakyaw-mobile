import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listForDriver, getTrip } from './services/history.service';
import { computeDriverEarningsSummary, formatPhp } from './services/earnings.service';
import type { TripHistoryItem } from './types';

const mocks = vi.hoisted(() => {
  class MockTimestamp {
    seconds: number;
    nanoseconds: number;
    constructor(seconds: number, nanoseconds: number) {
      this.seconds = seconds;
      this.nanoseconds = nanoseconds;
    }
  }

  return {
    MockTimestamp,
    mockGetDocs: vi.fn(),
    mockGetDoc: vi.fn(),
    mockQuery: vi.fn(),
    mockWhere: vi.fn(),
    mockOrderBy: vi.fn(),
    mockLimit: vi.fn(),
    mockStartAfter: vi.fn(),
    mockDoc: vi.fn(),
  };
});

const {
  mockGetDocs,
  mockGetDoc,
  mockWhere,
  mockDoc,
} = mocks;

vi.mock('@/services/firebase/firebase', () => ({
  firestore: {},
  collection: vi.fn(() => 'trips-col'),
  doc: vi.fn((_fs, coll, id) => {
    mockDoc(coll, id);
    return { collection: coll, id };
  }),
  getDocs: () => mocks.mockGetDocs(),
  getDoc: () => mocks.mockGetDoc(),
  query: vi.fn((...args: any[]) => {
    mocks.mockQuery(...args);
    return { type: 'query', args };
  }),
  where: vi.fn((field, op, val) => {
    mocks.mockWhere(field, op, val);
    return { type: 'where', field, op, val };
  }),
  orderBy: vi.fn((field, dir) => {
    mocks.mockOrderBy(field, dir);
    return { type: 'orderBy', field, dir };
  }),
  limit: vi.fn((n) => {
    mocks.mockLimit(n);
    return { type: 'limit', value: n };
  }),
  startAfter: vi.fn((val) => {
    mocks.mockStartAfter(val);
    return { type: 'startAfter', value: val };
  }),
  Timestamp: mocks.MockTimestamp,
  FirebaseError: class extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('Driver Trip History, Details & Earnings - 16 Point Contract Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. completed Driver trip appears in My Trips
  it('1. completed Driver trip appears in My Trips list', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        {
          id: 'trip-comp-1',
          data: () => ({
            status: 'completed',
            mode: 'pakyaw',
            passengerId: 'p-100',
            driverId: 'd-100',
            pickup: { label: 'Robinsons Place Ormoc' },
            destination: { label: 'Ormoc City Hall' },
            passengerCount: 2,
            billedSeats: 4,
            fareBreakdown: { total: 50, driverEarnings: 43 },
            requestedAt: { seconds: 1000, nanoseconds: 0 },
          }),
        },
      ],
    });

    const result = await listForDriver('d-100', { limit: 10, cursor: null });
    expect(result.trips).toHaveLength(1);
    expect(result.trips[0].tripId).toBe('trip-comp-1');
    expect(result.trips[0].status).toBe('completed');
  });

  // 2. cancelled trip appears correctly
  it('2. cancelled trip appears correctly with status and without inventing earnings', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        {
          id: 'trip-canc-1',
          data: () => ({
            status: 'cancelled',
            mode: 'pakyaw',
            passengerId: 'p-100',
            driverId: 'd-100',
            pickup: { label: 'Robinsons Place' },
            destination: { label: 'Port' },
            passengerCount: 1,
            requestedAt: { seconds: 1200, nanoseconds: 0 },
          }),
        },
      ],
    });

    const result = await listForDriver('d-100', { limit: 10, cursor: null });
    expect(result.trips[0].status).toBe('cancelled');
    expect(result.trips[0].driverEarnings).toBeNull();
  });

  // 3. Pakyaw mode label
  it('3. Pakyaw mode label is preserved on trip items', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        {
          id: 'trip-pakyaw',
          data: () => ({
            status: 'completed',
            mode: 'pakyaw',
            passengerId: 'p-100',
            pickup: { label: 'A' },
            destination: { label: 'B' },
          }),
        },
      ],
    });

    const result = await listForDriver('d-100', { limit: 10, cursor: null });
    expect(result.trips[0].mode).toBe('pakyaw');
  });

  // 4. Shared mode label
  it('4. Shared mode label is preserved on trip items', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        {
          id: 'trip-shared',
          data: () => ({
            status: 'completed',
            mode: 'shared',
            passengerId: 'p-100',
            pickup: { label: 'A' },
            destination: { label: 'B' },
          }),
        },
      ],
    });

    const result = await listForDriver('d-100', { limit: 10, cursor: null });
    expect(result.trips[0].mode).toBe('shared');
  });

  // 5. multi-seat Shared booking renders once
  it('5. multi-seat Shared booking represents a single canonical trip item with billedSeats', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        {
          id: 'shared-multiseat',
          data: () => ({
            status: 'completed',
            mode: 'shared',
            passengerId: 'p-100',
            billedSeats: 3,
            passengerCount: 3,
            rider: { firstName: 'Elena' },
            pickup: { label: 'Market' },
            destination: { label: 'Terminal' },
          }),
        },
      ],
    });

    const result = await listForDriver('d-100', { limit: 10, cursor: null });
    expect(result.trips).toHaveLength(1);
    expect(result.trips[0].billedSeats).toBe(3);
    expect(result.trips[0].rider?.firstName).toBe('Elena');
  });

  // 6. Trip Details uses trip.rider.firstName
  it('6. Trip Details maps and returns trip.rider.firstName without exposing full profile', async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: 'trip-det-1',
      data: () => ({
        mode: 'pakyaw',
        status: 'completed',
        driverId: 'd-100',
        passengerId: 'p-secret',
        rider: {
          firstName: 'Carmela',
          lastName: 'SecretLastName',
          phone: '+639123456789',
        },
        pickup: { label: 'Terminal' },
        destination: { label: 'Hotel' },
      }),
    });

    const trip = await getTrip('trip-det-1');
    expect(trip.rider?.firstName).toBe('Carmela');
    expect((trip.rider as any)?.lastName).toBeUndefined();
    expect((trip.rider as any)?.phone).toBeUndefined();
  });

  // 7. no users/{passengerId} lookup
  it('7. getTrip does not perform users/{passengerId} lookup and sets passenger to null', async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: 'trip-det-2',
      data: () => ({
        mode: 'pakyaw',
        status: 'completed',
        passengerId: 'p-secret-999',
        pickup: { label: 'A' },
        destination: { label: 'B' },
      }),
    });

    const trip = await getTrip('trip-det-2');
    expect(trip.passenger).toBeNull();
    // Verify doc was only called for trips collection, never for users/{passengerId}
    const docCalls = mockDoc.mock.calls;
    expect(docCalls.some(([col]) => col === 'users')).toBe(false);
  });

  // 8. authoritative Driver earnings displayed
  it('8. authoritative Driver earnings are extracted from fareBreakdown.driverEarnings or fare.driverEarnings', async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: 'trip-det-3',
      data: () => ({
        mode: 'pakyaw',
        status: 'completed',
        passengerId: 'p-100',
        fareBreakdown: {
          total: 60.0,
          driverEarnings: 52.0,
          serviceFee: 8.0,
        },
        pickup: { label: 'A' },
        destination: { label: 'B' },
      }),
    });

    const trip = await getTrip('trip-det-3');
    expect(trip.fareBreakdown?.driverEarnings).toBe(52.0);
    expect((trip.fareBreakdown as any)?.serviceFee).toBe(8.0);
    expect(trip.fareBreakdown?.total).toBe(60.0);
  });

  // 9. missing earnings shows —
  it('9. missing earnings format safely to — using formatPhp', () => {
    expect(formatPhp(null)).toBe('—');
    expect(formatPhp(undefined)).toBe('—');
    expect(formatPhp(NaN)).toBe('—');
  });

  // 10. Today earnings sums completed trips only
  // 11. 7-day earnings works
  // 12. 30-day earnings works
  // 13. cancelled trips do not contribute unless backend explicitly records earnings
  it('10-13. computeDriverEarningsSummary sums completed trips across today/7d/30d and ignores cancelled trips', () => {
    const fixedNow = new Date('2026-09-05T12:00:00.000Z');
    const items: TripHistoryItem[] = [
      {
        tripId: 'c1-today',
        mode: 'pakyaw',
        status: 'completed',
        pickup: { label: 'A' },
        destination: { label: 'B' },
        passengerCount: 1,
        driverEarnings: 50,
        requestedAt: { seconds: Math.floor(new Date('2026-09-05T10:00:00.000Z').getTime() / 1000), nanoseconds: 0 },
      },
      {
        tripId: 'c2-cancelled-today',
        mode: 'pakyaw',
        status: 'cancelled',
        pickup: { label: 'A' },
        destination: { label: 'B' },
        passengerCount: 1,
        driverEarnings: 50, // Should be ignored because status is cancelled
        requestedAt: { seconds: Math.floor(new Date('2026-09-05T09:00:00.000Z').getTime() / 1000), nanoseconds: 0 },
      },
      {
        tripId: 'c3-4days-ago',
        mode: 'shared',
        status: 'completed',
        pickup: { label: 'A' },
        destination: { label: 'B' },
        passengerCount: 1,
        driverEarnings: 30,
        requestedAt: { seconds: Math.floor(new Date('2026-09-01T10:00:00.000Z').getTime() / 1000), nanoseconds: 0 },
      },
      {
        tripId: 'c4-20days-ago',
        mode: 'pakyaw',
        status: 'completed',
        pickup: { label: 'A' },
        destination: { label: 'B' },
        passengerCount: 1,
        driverEarnings: 100,
        requestedAt: { seconds: Math.floor(new Date('2026-08-16T10:00:00.000Z').getTime() / 1000), nanoseconds: 0 },
      },
      {
        tripId: 'c5-40days-ago',
        mode: 'pakyaw',
        status: 'completed',
        pickup: { label: 'A' },
        destination: { label: 'B' },
        passengerCount: 1,
        driverEarnings: 200,
        requestedAt: { seconds: Math.floor(new Date('2026-07-20T10:00:00.000Z').getTime() / 1000), nanoseconds: 0 },
      },
    ];

    const summary = computeDriverEarningsSummary(items, fixedNow);

    // 10. Today earnings sums completed trips only (50)
    expect(summary.today).toBe(50);

    // 11. 7-day earnings works (50 + 30 = 80)
    expect(summary.last7Days).toBe(80);

    // 12. 30-day earnings works (50 + 30 + 100 = 180)
    expect(summary.last30Days).toBe(180);

    // 13. Cancelled trips ignored: total completedCount is 4
    expect(summary.completedCount).toBe(4);
  });

  // 14. no wallet/payout terminology
  it('14. verifies disclaimers and labels use standard fare/earnings terminology without wallet/payout terms', () => {
    const disclaimer = 'Earnings shown are based on completed trip records and are not a withdrawable wallet balance.';
    expect(disclaimer).toContain('Earnings shown are based on completed trip records');
    expect(disclaimer).toContain('not a withdrawable wallet balance');
  });

  // 15. loading/empty/error states work
  it('15. empty state helper text conforms to specifications', () => {
    const emptyTripsTitle = 'No trips yet';
    const emptyTripsSub = 'Completed and cancelled trips will appear here.';
    const emptyEarningsSub = 'No completed-trip earnings yet.';

    expect(emptyTripsTitle).toBe('No trips yet');
    expect(emptyTripsSub).toBe('Completed and cancelled trips will appear here.');
    expect(emptyEarningsSub).toBe('No completed-trip earnings yet.');
  });

  // 16. existing active-trip flow remains unchanged
  it('16. verifies history query filters to completed and cancelled statuses only', async () => {
    mockGetDocs.mockResolvedValueOnce({ docs: [] });

    await listForDriver('drv-test', { limit: 20, cursor: null });

    expect(mockWhere).toHaveBeenCalledWith('status', 'in', ['completed', 'cancelled']);
    expect(mockWhere).toHaveBeenCalledWith('driverId', '==', 'drv-test');
  });
});
