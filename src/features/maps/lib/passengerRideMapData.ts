import type { BookingDraft } from '@/stores/bookingDraftStore';
import type { InterpolatedCoordinate } from '@pakyaw/shared/features/maps/hooks/useInterpolatedCoordinate';
import type { TripDoc } from '@pakyaw/shared/features/trip/types';

export type RideMapPhase = 'booking' | 'connecting' | 'active' | 'terminal';

export type PassengerRideMapData = {
  readonly pickupLocation: { readonly latitude: number; readonly longitude: number } | null;
  readonly destinationLocation: { readonly latitude: number; readonly longitude: number } | null;
  readonly routePolyline: string | null;
  readonly driverLocation: InterpolatedCoordinate | null;
  readonly showDriverRoute: boolean;
  readonly driverRoutePolyline: string | null;
  readonly driverRouteVariant: 'pickup' | 'trip';
  readonly driverRouteProgressCoordinate: InterpolatedCoordinate | null;
};

type MapDraft = Pick<BookingDraft, 'pickup' | 'destination' | 'route'>;

const EMPTY_MAP_DATA: PassengerRideMapData = {
  pickupLocation: null,
  destinationLocation: null,
  routePolyline: null,
  driverLocation: null,
  showDriverRoute: false,
  driverRoutePolyline: null,
  driverRouteVariant: 'pickup',
  driverRouteProgressCoordinate: null,
};

function coordinateFromPlace(place: MapDraft['pickup']): { latitude: number; longitude: number } | null {
  return place?.coords
    ? { latitude: place.coords.lat, longitude: place.coords.lng }
    : null;
}

/** Pure map projection for the Passenger ride screen. */
export function selectPassengerRideMapData(input: {
  readonly phase: RideMapPhase;
  readonly draft: MapDraft;
  readonly routeIsCurrent: boolean;
  readonly trip: TripDoc | null;
  readonly interpolatedDriverLocation: InterpolatedCoordinate | null;
  readonly driverDistanceFromPickup: number | null;
}): PassengerRideMapData {
  const {
    phase,
    draft,
    routeIsCurrent,
    trip,
    interpolatedDriverLocation,
    driverDistanceFromPickup,
  } = input;

  if (phase === 'booking' || phase === 'connecting') {
    return {
      pickupLocation: coordinateFromPlace(draft.pickup),
      destinationLocation: coordinateFromPlace(draft.destination),
      routePolyline: routeIsCurrent ? (draft.route?.polyline ?? null) : null,
      driverLocation: null,
      showDriverRoute: false,
      driverRoutePolyline: null,
      driverRouteVariant: 'pickup',
      driverRouteProgressCoordinate: null,
    };
  }

  if (phase === 'terminal' || !trip) return EMPTY_MAP_DATA;

  const isPrePickup = trip.status === 'accepted' || trip.status === 'driver_arriving';
  const isArrived = trip.status === 'driver_arrived';
  const isInTrip = trip.status === 'in_progress';
  const pickupLocation = coordinateFromPlace(trip.pickup);
  const destinationLocation = coordinateFromPlace(trip.destination);
  const driverLocation = interpolatedDriverLocation
    ? {
        latitude: interpolatedDriverLocation.latitude,
        longitude: interpolatedDriverLocation.longitude,
      }
    : null;
  const shouldShowPickup = isPrePickup
    || isArrived
    || (isInTrip && (driverDistanceFromPickup == null || driverDistanceFromPickup < 150));
  const liveDriverRoute = trip.driverRoute?.polyline ?? null;

  if (isPrePickup) {
    return {
      pickupLocation: shouldShowPickup ? pickupLocation : null,
      destinationLocation,
      routePolyline: null,
      driverLocation,
      showDriverRoute: liveDriverRoute !== null,
      driverRoutePolyline: liveDriverRoute,
      driverRouteVariant: 'pickup',
      driverRouteProgressCoordinate: driverLocation,
    };
  }

  if (isArrived) {
    return {
      pickupLocation: shouldShowPickup ? pickupLocation : null,
      destinationLocation,
      routePolyline: null,
      driverLocation,
      showDriverRoute: false,
      driverRoutePolyline: null,
      driverRouteVariant: 'pickup',
      driverRouteProgressCoordinate: driverLocation,
    };
  }

  if (isInTrip && liveDriverRoute !== null) {
    return {
      pickupLocation: shouldShowPickup ? pickupLocation : null,
      destinationLocation,
      routePolyline: null,
      driverLocation,
      showDriverRoute: true,
      driverRoutePolyline: liveDriverRoute,
      driverRouteVariant: 'trip',
      driverRouteProgressCoordinate: driverLocation,
    };
  }

  return {
    pickupLocation: shouldShowPickup ? pickupLocation : null,
    destinationLocation,
    routePolyline: isInTrip ? (trip.route?.polyline ?? null) : null,
    driverLocation,
    showDriverRoute: false,
    driverRoutePolyline: null,
    driverRouteVariant: isInTrip ? 'trip' : 'pickup',
    driverRouteProgressCoordinate: driverLocation,
  };
}
