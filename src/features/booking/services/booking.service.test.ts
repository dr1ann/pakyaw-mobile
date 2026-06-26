import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTrip } from './booking.service';
import { ServiceAreaError, TripDistanceTooShortError } from '@/lib/serviceArea';

// ─── Mock Firestore ──────────────────────────────────────────────────────────
const mockAddDoc = vi.fn();
vi.mock('firebase/firestore', () => {
  return {
    collection: vi.fn((_fs, name) => name),
    addDoc: vi.fn((col, data) => mockAddDoc(col, data)),
    serverTimestamp: vi.fn(() => ({ __serverTimestamp: true })),
  };
});

vi.mock('@/services/firebase/firebase', () => ({
  firestore: {},
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('booking.service — createTrip()', () => {
  const validRoute = {
    distanceMeters: 3400,
    durationSeconds: 480,
    polyline: 'abcdef_encoded_polyline',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAddDoc.mockResolvedValue({ id: 'mock-trip-id-123' });
  });

  it('successfully creates a trip when pickup and destination are in Ormoc service area', async () => {
    const input = {
      pickup: {
        label: 'Ormoc Superdome',
        address: 'Ormoc, Leyte',
        coords: { lat: 11.0050, lng: 124.6075 },
      },
      destination: {
        label: 'Brgy Cogon',
        address: 'Cogon, Ormoc',
        coords: { lat: 11.0100, lng: 124.6150 },
      },
      passengerCount: 3,
      route: validRoute,
    };

    const tripId = await createTrip(input, 'passenger-uid-123');
    expect(tripId).toBe('mock-trip-id-123');

    expect(mockAddDoc).toHaveBeenCalledTimes(1);
    const [col, data] = mockAddDoc.mock.calls[0];
    expect(col).toBe('trips');
    expect(data.serviceAreaId).toBe('ormoc');
    expect(data.route).toEqual(validRoute);
    expect(data.billedSeats).toBe(4); // clamped minimum
  });

  it('throws ServiceAreaError if pickup is outside Ormoc service area', async () => {
    const input = {
      pickup: {
        label: 'Tacloban City Hall',
        address: 'Tacloban City',
        coords: { lat: 11.2444, lng: 125.0039 }, // Tacloban (outside)
      },
      destination: {
        label: 'Ormoc Superdome',
        address: 'Ormoc, Leyte',
        coords: { lat: 11.0050, lng: 124.6075 },
      },
      passengerCount: 3,
      route: validRoute,
    };

    await expect(createTrip(input, 'passenger-uid-123')).rejects.toThrow(ServiceAreaError);
    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it('throws ServiceAreaError if destination is outside Ormoc service area', async () => {
    const input = {
      pickup: {
        label: 'Ormoc Superdome',
        address: 'Ormoc, Leyte',
        coords: { lat: 11.0050, lng: 124.6075 },
      },
      destination: {
        label: 'Kananga Town Hall',
        address: 'Kananga, Leyte',
        coords: { lat: 11.1873, lng: 124.5602 }, // Kananga (outside)
      },
      passengerCount: 3,
      route: validRoute,
    };

    await expect(createTrip(input, 'passenger-uid-123')).rejects.toThrow(ServiceAreaError);
    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it('throws BookingWriteError if pickup coords are missing', async () => {
    const input = {
      pickup: {
        label: 'Ormoc Superdome',
        address: 'Ormoc, Leyte',
        coords: null, // missing coords
      },
      destination: {
        label: 'Brgy Cogon',
        address: 'Cogon, Ormoc',
        coords: { lat: 11.0100, lng: 124.6150 },
      },
      passengerCount: 3,
      route: validRoute,
    };

    // Note: Null coords in pickup will be caught by assertInServiceArea first, throwing ServiceAreaError
    await expect(createTrip(input, 'passenger-uid-123')).rejects.toThrow(ServiceAreaError);
    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  describe('minimum trip distance validation', () => {
    const baseInput = {
      pickup: {
        label: 'Ormoc Superdome',
        address: 'Ormoc, Leyte',
        coords: { lat: 11.0050, lng: 124.6075 },
      },
      destination: {
        label: 'Brgy Cogon',
        address: 'Cogon, Ormoc',
        coords: { lat: 11.0100, lng: 124.6150 },
      },
      passengerCount: 3,
    };

    const testDistance = async (distanceMeters: number, shouldThrow: boolean) => {
      const input = {
        ...baseInput,
        route: {
          distanceMeters,
          durationSeconds: 480,
          polyline: 'abcdef_encoded_polyline',
        },
      };

      if (shouldThrow) {
        await expect(createTrip(input, 'passenger-uid-123')).rejects.toThrow(TripDistanceTooShortError);
        expect(mockAddDoc).not.toHaveBeenCalled();
      } else {
        const tripId = await createTrip(input, 'passenger-uid-123');
        expect(tripId).toBe('mock-trip-id-123');
        expect(mockAddDoc).toHaveBeenCalled();
      }
    };

    it('throws TripDistanceTooShortError if route distance is 0 m', async () => {
      await testDistance(0, true);
    });

    it('throws TripDistanceTooShortError if route distance is 25 m', async () => {
      await testDistance(25, true);
    });

    it('throws TripDistanceTooShortError if route distance is 49 m', async () => {
      await testDistance(49, true);
    });

    it('succeeds if route distance is 50 m', async () => {
      await testDistance(50, false);
    });

    it('succeeds if route distance is 51 m', async () => {
      await testDistance(51, false);
    });

    it('succeeds with a valid longer route (> 50 m)', async () => {
      await testDistance(150, false);
    });
  });
});
