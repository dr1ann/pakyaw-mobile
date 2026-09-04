import { describe, expect, it } from 'vitest';
import { mapCanonicalSharedRide } from './useSharedRideSession';

describe('useSharedRideSession / mapCanonicalSharedRide canonical mapping', () => {
  const validCreatedAt = { toMillis: () => 1725500000000 };

  it('maps canonical SharedRide with operational stops and member statuses', () => {
    const rawData = {
      driverId: 'driver-001',
      status: 'active',
      maxSeats: 4,
      seatsReserved: 3,
      createdAt: validCreatedAt,
      tripIds: ['trip-1', 'trip-2', 'trip-3'],
      members: [
        {
          tripId: 'trip-1',
          passengerId: 'p-1',
          seats: 1,
          pickup: { latitude: 11.005, longitude: 124.6075, label: 'Ormoc City Hall' },
          destination: { latitude: 11.002, longitude: 124.605, label: 'Ormoc Port' },
          mode: 'shared',
          status: 'onboard',
        },
        {
          tripId: 'trip-2',
          passengerId: 'p-2',
          seats: 2,
          pickup: { latitude: 11.018, longitude: 124.618, label: 'Robinsons Place Ormoc' },
          destination: { latitude: 11.002, longitude: 124.605, label: 'Ormoc Port' },
          mode: 'shared',
          status: 'waiting_pickup',
        },
        {
          tripId: 'trip-3',
          passengerId: 'p-3',
          seats: 1,
          pickup: { latitude: 11.012, longitude: 124.61, label: 'Ormoc Doctor Hospital' },
          destination: { latitude: 11.009, longitude: 124.608, label: 'SM Center Ormoc' },
          mode: 'shared',
          status: 'reserved',
        },
      ],
      operational: {
        stopOrder: ['trip-2:pickup', 'trip-1:dropoff', 'trip-3:pickup', 'trip-3:dropoff', 'trip-2:dropoff'],
        currentStopId: 'trip-2:pickup',
        nextStopId: 'trip-1:dropoff',
        stops: [
          {
            id: 'trip-2:pickup',
            tripId: 'trip-2',
            kind: 'pickup',
            place: { latitude: 11.018, longitude: 124.618, label: 'Robinsons Place Ormoc' },
            status: 'pending',
          },
          {
            id: 'trip-1:dropoff',
            tripId: 'trip-1',
            kind: 'dropoff',
            place: { latitude: 11.002, longitude: 124.605, label: 'Ormoc Port' },
            status: 'pending',
          },
        ],
      },
    };

    const result = mapCanonicalSharedRide('shared-001', rawData);
    expect(result).not.toBeNull();
    expect(result?.id).toBe('shared-001');
    expect(result?.driverId).toBe('driver-001');
    expect(result?.maxSeats).toBe(4);
    expect(result?.seatsBooked).toBe(3);
    expect(result?.members).toHaveLength(3);
    expect(result?.operational?.currentStopId).toBe('trip-2:pickup');
    expect(result?.operational?.nextStopId).toBe('trip-1:dropoff');
    expect(result?.operational?.stopOrder).toHaveLength(5);
    expect(result?.passengers).toHaveLength(3);
    expect(result?.passengers[2].seatsCovered).toBe(1);
  });

  it('rejects malformed shared ride documents safely without throwing', () => {
    // Missing driverId
    expect(mapCanonicalSharedRide('s-1', { status: 'active', maxSeats: 4, seatsReserved: 2, createdAt: validCreatedAt })).toBeNull();
    // Invalid status
    expect(mapCanonicalSharedRide('s-2', { driverId: 'd-1', status: 'invalid_status', maxSeats: 4, seatsReserved: 2, createdAt: validCreatedAt })).toBeNull();
    // Invalid maxSeats
    expect(mapCanonicalSharedRide('s-3', { driverId: 'd-1', status: 'active', maxSeats: -1, seatsReserved: 2, createdAt: validCreatedAt })).toBeNull();
    // seatsReserved > maxSeats
    expect(mapCanonicalSharedRide('s-4', { driverId: 'd-1', status: 'active', maxSeats: 4, seatsReserved: 5, createdAt: validCreatedAt })).toBeNull();
    // Missing createdAt
    expect(mapCanonicalSharedRide('s-5', { driverId: 'd-1', status: 'active', maxSeats: 4, seatsReserved: 2 })).toBeNull();
  });

  it('handles malformed operational gracefully and provides safe fallback', () => {
    const rawData = {
      driverId: 'driver-001',
      status: 'active',
      maxSeats: 4,
      seatsReserved: 1,
      createdAt: validCreatedAt,
      tripIds: ['trip-1'],
      members: [],
      operational: {
        stopOrder: 'invalid_not_array',
        currentStopId: 12345, // invalid type
        stops: 'invalid_stops',
      },
    };

    const result = mapCanonicalSharedRide('shared-001', rawData);
    expect(result).not.toBeNull();
    expect(result?.operational?.stopOrder).toEqual([]);
    expect(result?.operational?.currentStopId).toBeNull();
    expect(result?.operational?.stops).toEqual([]);
  });

  it('does not determine stop order locally or override backend stopOrder', () => {
    // Coordinates that in geographic order might be different from operational order
    const rawData = {
      driverId: 'driver-001',
      status: 'active',
      maxSeats: 4,
      seatsReserved: 2,
      createdAt: validCreatedAt,
      tripIds: ['trip-far', 'trip-near'],
      members: [
        {
          tripId: 'trip-far',
          passengerId: 'p-far',
          seats: 1,
          pickup: { latitude: 12.0, longitude: 125.0, label: 'Far Place' },
          destination: { latitude: 12.5, longitude: 125.5, label: 'Far Dest' },
          mode: 'shared',
          status: 'reserved',
        },
        {
          tripId: 'trip-near',
          passengerId: 'p-near',
          seats: 1,
          pickup: { latitude: 11.005, longitude: 124.6075, label: 'Near Place' },
          destination: { latitude: 11.002, longitude: 124.605, label: 'Near Dest' },
          mode: 'shared',
          status: 'reserved',
        },
      ],
      operational: {
        stopOrder: ['trip-far:pickup', 'trip-near:pickup'],
        currentStopId: 'trip-far:pickup',
        nextStopId: 'trip-near:pickup',
        stops: [
          {
            id: 'trip-far:pickup',
            tripId: 'trip-far',
            kind: 'pickup',
            place: { latitude: 12.0, longitude: 125.0, label: 'Far Place' },
            status: 'pending',
          },
          {
            id: 'trip-near:pickup',
            tripId: 'trip-near',
            kind: 'pickup',
            place: { latitude: 11.005, longitude: 124.6075, label: 'Near Place' },
            status: 'pending',
          },
        ],
      },
    };

    const result = mapCanonicalSharedRide('shared-001', rawData);
    expect(result?.operational?.currentStopId).toBe('trip-far:pickup');
    expect(result?.operational?.nextStopId).toBe('trip-near:pickup');
    // Verifies no local sorting occurred
    expect(result?.operational?.stopOrder[0]).toBe('trip-far:pickup');
  });

  it('updates occupancy and new Hop member without resetting active currentStop', () => {
    // Initial state with 1 Shared passenger
    const initialRaw = {
      driverId: 'driver-001',
      status: 'active',
      maxSeats: 4,
      seatsReserved: 1,
      createdAt: validCreatedAt,
      tripIds: ['trip-1'],
      members: [
        {
          tripId: 'trip-1',
          passengerId: 'p-1',
          seats: 1,
          pickup: { latitude: 11.005, longitude: 124.6075, label: 'Ormoc City Hall' },
          destination: { latitude: 11.002, longitude: 124.605, label: 'Ormoc Port' },
          mode: 'shared',
          status: 'waiting_pickup',
        },
      ],
      operational: {
        stopOrder: ['trip-1:pickup', 'trip-1:dropoff'],
        currentStopId: 'trip-1:pickup',
        nextStopId: 'trip-1:dropoff',
        stops: [
          {
            id: 'trip-1:pickup',
            tripId: 'trip-1',
            kind: 'pickup',
            place: { latitude: 11.005, longitude: 124.6075, label: 'Ormoc City Hall' },
            status: 'pending',
          },
        ],
      },
    };

    const initial = mapCanonicalSharedRide('shared-001', initialRaw);
    expect(initial?.seatsBooked).toBe(1);
    expect(initial?.operational?.currentStopId).toBe('trip-1:pickup');

    // Shared passenger added while driving
    const updatedRaw = {
      ...initialRaw,
      seatsReserved: 2,
      tripIds: ['trip-1', 'trip-join'],
      members: [
        ...initialRaw.members,
        {
          tripId: 'trip-join',
          passengerId: 'p-join',
          seats: 1,
          pickup: { latitude: 11.01, longitude: 124.61, label: 'Doctor Hospital' },
          destination: { latitude: 11.002, longitude: 124.605, label: 'Ormoc Port' },
          mode: 'shared',
          status: 'reserved',
        },
      ],
      operational: {
        stopOrder: ['trip-1:pickup', 'trip-join:pickup', 'trip-1:dropoff', 'trip-join:dropoff'],
        currentStopId: 'trip-1:pickup', // Current stop remains stable!
        nextStopId: 'trip-join:pickup',
        stops: [
          {
            id: 'trip-1:pickup',
            tripId: 'trip-1',
            kind: 'pickup',
            place: { latitude: 11.005, longitude: 124.6075, label: 'Ormoc City Hall' },
            status: 'pending',
          },
          {
            id: 'trip-join:pickup',
            tripId: 'trip-join',
            kind: 'pickup',
            place: { latitude: 11.01, longitude: 124.61, label: 'Doctor Hospital' },
            status: 'pending',
          },
        ],
      },
    };

    const updated = mapCanonicalSharedRide('shared-001', updatedRaw);
    expect(updated?.seatsBooked).toBe(2);
    expect(updated?.members).toHaveLength(2);
    expect(updated?.operational?.currentStopId).toBe('trip-1:pickup');
    expect(updated?.operational?.nextStopId).toBe('trip-join:pickup');
  });
});
