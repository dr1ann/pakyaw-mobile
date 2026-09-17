import { describe, expect, it } from 'vitest';

import { selectPassengerRideMapData } from './passengerRideMapData';

const draft = {
  pickup: { coords: { lat: 11, lng: 124 }, label: 'Pickup' },
  destination: { coords: { lat: 11.01, lng: 124.01 }, label: 'Destination' },
  route: { distanceMeters: 1_000, durationSeconds: 180, polyline: 'draft-route' },
} as const;

const trip = {
  id: 'trip-1',
  mode: 'solo',
  status: 'in_progress',
  passengerId: 'passenger-1',
  driverId: 'driver-1',
  pickup: draft.pickup,
  destination: draft.destination,
  passengerCount: 1,
  billedSeats: 1,
  geohash: 'abc',
  requestedAt: null,
  acceptedAt: null,
  completedAt: null,
  cancelledAt: null,
  cancelledBy: null,
  cancelReason: null,
  route: { ...draft.route, fetchedAt: null },
} as const;

describe('selectPassengerRideMapData', () => {
  it('does not draw a stale booking route', () => {
    const result = selectPassengerRideMapData({
      phase: 'booking',
      draft,
      routeIsCurrent: false,
      trip: null,
      interpolatedDriverLocation: null,
      driverDistanceFromPickup: null,
    });

    expect(result).toMatchObject({
      pickupLocation: { latitude: 11, longitude: 124 },
      destinationLocation: { latitude: 11.01, longitude: 124.01 },
      routePolyline: null,
    });
  });

  it('uses the live Driver route before pickup and the trip route during the ride', () => {
    const prePickup = selectPassengerRideMapData({
      phase: 'active',
      draft,
      routeIsCurrent: true,
      trip: { ...trip, status: 'driver_arriving', driverRoute: { polyline: 'pickup-route', distanceMeters: 500, durationSeconds: 90, updatedAt: null } },
      interpolatedDriverLocation: { latitude: 11.002, longitude: 124.002 },
      driverDistanceFromPickup: 200,
    });
    expect(prePickup).toMatchObject({ showDriverRoute: true, driverRouteVariant: 'pickup', driverRoutePolyline: 'pickup-route' });

    const inTrip = selectPassengerRideMapData({
      phase: 'active',
      draft,
      routeIsCurrent: true,
      trip,
      interpolatedDriverLocation: { latitude: 11.002, longitude: 124.002 },
      driverDistanceFromPickup: 200,
    });
    expect(inTrip).toMatchObject({ showDriverRoute: false, driverRouteVariant: 'trip', routePolyline: 'draft-route' });
  });
});
