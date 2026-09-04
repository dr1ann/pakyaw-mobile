import { useEffect, useMemo, useState } from 'react';
import { useSessionStore } from '@pakyaw/shared/stores/sessionStore';
import { doc, firestore, onSnapshot } from '@/services/firebase/firebase';
import type {
  SharedRideDoc,
  SharedRideMember,
  SharedRideMemberStatus,
  SharedRideOperational,
  SharedRideOperationalStop,
  TripDoc,
} from '@pakyaw/shared/features/trip/types';
import { subscribe } from '@pakyaw/shared/features/trip/services/trip.service';
import { SHARED_RIDES_COLLECTION } from '@pakyaw/shared/transport/contract';
import { logger } from '@pakyaw/shared/lib/logger';

function isTimestamp(value: unknown): boolean {
  return value !== null && typeof value === 'object' && 'toMillis' in value
    && typeof (value as { toMillis?: unknown }).toMillis === 'function'
    && Number.isFinite((value as { toMillis(): unknown }).toMillis());
}

function mapOperational(raw: unknown): SharedRideOperational | null {
  if (!raw || typeof raw !== 'object') return null;
  const op = raw as Record<string, unknown>;
  const stopOrder = Array.isArray(op.stopOrder) && op.stopOrder.every((s) => typeof s === 'string')
    ? (op.stopOrder as string[])
    : [];
  const currentStopId = typeof op.currentStopId === 'string' ? op.currentStopId : null;
  const nextStopId = typeof op.nextStopId === 'string' ? op.nextStopId : null;
  const rawStops = Array.isArray(op.stops) ? op.stops : [];
  const stops: SharedRideOperationalStop[] = rawStops.flatMap((s) => {
    if (!s || typeof s !== 'object') return [];
    const stop = s as Record<string, unknown>;
    const place = stop.place as Record<string, unknown> | undefined;
    if (
      typeof stop.id !== 'string' ||
      typeof stop.tripId !== 'string' ||
      (stop.kind !== 'pickup' && stop.kind !== 'dropoff') ||
      !place ||
      typeof place.latitude !== 'number' ||
      typeof place.longitude !== 'number'
    ) {
      return [];
    }
    return [{
      id: stop.id,
      tripId: stop.tripId,
      kind: stop.kind as 'pickup' | 'dropoff',
      place: {
        latitude: place.latitude,
        longitude: place.longitude,
        label: typeof place.label === 'string' ? place.label : undefined,
      },
      status: (stop.status === 'completed' || stop.status === 'cancelled') ? stop.status : 'pending',
    }];
  });

  return {
    stopOrder,
    currentStopId,
    nextStopId,
    stops,
  };
}

function mapMembers(raw: unknown): SharedRideMember[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const m = item as Record<string, unknown>;
    const pickup = m.pickup as Record<string, unknown> | undefined;
    const dest = m.destination as Record<string, unknown> | undefined;
    if (
      typeof m.tripId !== 'string' ||
      typeof m.seats !== 'number' ||
      !pickup ||
      typeof pickup.latitude !== 'number' ||
      typeof pickup.longitude !== 'number' ||
      !dest ||
      typeof dest.latitude !== 'number' ||
      typeof dest.longitude !== 'number'
    ) {
      return [];
    }
    return [{
      tripId: m.tripId,
      passengerId: typeof m.passengerId === 'string' ? m.passengerId : '',
      seats: m.seats,
      pickup: {
        latitude: pickup.latitude,
        longitude: pickup.longitude,
        label: typeof pickup.label === 'string' ? pickup.label : undefined,
      },
      destination: {
        latitude: dest.latitude,
        longitude: dest.longitude,
        label: typeof dest.label === 'string' ? dest.label : undefined,
      },
      mode: m.mode === 'hop' ? 'hop' : 'shared',
      status: (['reserved', 'waiting_pickup', 'onboard', 'dropped_off', 'cancelled'].includes(String(m.status))
        ? m.status
        : 'reserved') as SharedRideMemberStatus,
    }];
  });
}

export function mapCanonicalSharedRide(id: string, value: Record<string, unknown>): SharedRideDoc | null {
  const members = Array.isArray(value.members) ? mapMembers(value.members) : [];
  const tripIds = Array.isArray(value.tripIds) && value.tripIds.every((tripId) => typeof tripId === 'string')
    ? (value.tripIds as string[])
    : [];
  const route = value.route && typeof value.route === 'object' ? (value.route as Record<string, unknown>) : null;
  const operational = mapOperational(value.operational);

  if (
    typeof value.driverId !== 'string' ||
    (value.status !== 'forming' && value.status !== 'active' && value.status !== 'completed' && value.status !== 'cancelled') ||
    typeof value.maxSeats !== 'number' ||
    !Number.isInteger(value.maxSeats) ||
    value.maxSeats < 1 ||
    value.maxSeats > 12 ||
    typeof value.seatsReserved !== 'number' ||
    !Number.isInteger(value.seatsReserved) ||
    !Number.isFinite(value.seatsReserved) ||
    value.seatsReserved < 0 ||
    value.seatsReserved > value.maxSeats ||
    !isTimestamp(value.createdAt)
  ) {
    return null;
  }

  const passengers = members.map((m) => ({
    tripId: m.tripId,
    passengerId: m.passengerId || '',
    seatsCovered: m.seats,
    pickup: { label: m.pickup.label || 'Pickup', coords: { lat: m.pickup.latitude, lng: m.pickup.longitude } },
    destination: { label: m.destination.label || 'Destination', coords: { lat: m.destination.latitude, lng: m.destination.longitude } },
    status: m.status === 'dropped_off' || m.status === 'cancelled' ? ('dropped_off' as const) : ('active' as const),
    isHop: m.mode === 'hop',
  }));

  const firstMember = members[0];
  const routeOrigin = firstMember
    ? { lat: firstMember.pickup.latitude, lng: firstMember.pickup.longitude }
    : { lat: 0, lng: 0 };
  const routeDestination = firstMember
    ? { lat: firstMember.destination.latitude, lng: firstMember.destination.longitude }
    : { lat: 0, lng: 0 };

  return {
    id,
    driverId: value.driverId,
    status: value.status,
    maxSeats: value.maxSeats,
    seatsBooked: value.seatsReserved,
    totalPassengersCount: members.length,
    routePolyline: route && typeof route.polyline === 'string' ? route.polyline : '',
    routeOrigin,
    routeDestination,
    routeGeohash: '',
    routeHeadingDeg: 0,
    corridorThresholdMeters: 0,
    tripIds,
    members,
    operational,
    passengers,
    createdAt: value.createdAt as SharedRideDoc['createdAt'],
    completedAt: null,
  };
}

export function useSharedRideSession() {
  const uid = useSessionStore((s) => s.uid);
  const [sharedRideId, setSharedRideId] = useState<string | null>(null);
  const [sharedRide, setSharedRide] = useState<SharedRideDoc | null>(null);
  const [memberTrips, setMemberTrips] = useState<Record<string, TripDoc>>({});

  // 1. Listen to drivers/{uid}.activeSharedRideId
  useEffect(() => {
    if (!uid) return;

    const unsubDriver = onSnapshot(doc(firestore, 'drivers', uid), (snap) => {
      if (snap && snap.exists) {
        const data = snap.data();
        const activeSharedRideId = data?.activeSharedRideId;
        if (typeof activeSharedRideId === 'string' && activeSharedRideId.trim().length > 0) {
          setSharedRideId(activeSharedRideId.trim());
        } else {
          setSharedRideId(null);
          setSharedRide(null);
          setMemberTrips({});
        }
      }
    });

    return () => {
      unsubDriver();
      setSharedRideId(null);
      setSharedRide(null);
      setMemberTrips({});
    };
  }, [uid]);

  // 2. Subscribe to sharedRides/{sharedRideId}
  useEffect(() => {
    if (!sharedRideId) return;

    const unsubSharedRide = onSnapshot(doc(firestore, SHARED_RIDES_COLLECTION, sharedRideId), (snap) => {
      if (snap && snap.exists) {
        const parsed = mapCanonicalSharedRide(snap.id, snap.data());
        if (parsed) {
          if (uid && parsed.driverId !== uid) {
            logger.warn('[shared-ride] driver mismatch; clearing session', {
              sharedRideId,
              rideDriverId: parsed.driverId,
              uid,
            });
            setSharedRide(null);
            return;
          }
          setSharedRide(parsed);
        } else {
          logger.warn('[shared-ride] malformed SharedRide snapshot', { sharedRideId });
          setSharedRide(null);
        }
      } else {
        logger.info('[shared-ride] sharedRide document no longer exists', { sharedRideId });
        setSharedRide(null);
      }
    });

    return () => {
      unsubSharedRide();
      setSharedRide(null);
    };
  }, [sharedRideId, uid]);

  // 3. Subscribe to member Trips (canonical trip documents)
  const currentTripIds = useMemo(() => {
    return sharedRide?.tripIds ?? [];
  }, [sharedRide?.tripIds]);

  useEffect(() => {
    if (currentTripIds.length === 0) return;

    const unsubs: Record<string, () => void> = {};

    currentTripIds.forEach((tripId) => {
      try {
        const unsub = subscribe(
          tripId,
          (tripDoc) => {
            if (tripDoc) {
              setMemberTrips((prev) => ({
                ...prev,
                [tripId]: tripDoc,
              }));
            } else {
              setMemberTrips((prev) => {
                const next = { ...prev };
                delete next[tripId];
                return next;
              });
            }
          },
          (err) => {
            logger.error('[shared-ride] member trip subscription error', { err, tripId });
          }
        );
        unsubs[tripId] = unsub;
      } catch (err) {
        logger.error('[shared-ride] failed to subscribe to member trip', { err, tripId });
      }
    });

    return () => {
      Object.values(unsubs).forEach((unsub) => unsub());
      setMemberTrips({});
    };
  }, [currentTripIds]);

  // Derived Stop Authority & Occupancy from canonical backend projection
  const { currentStop, nextStop, currentTrip, nextTrip, occupancy } = useMemo(() => {
    const operational = sharedRide?.operational;
    const stops = operational?.stops ?? [];
    const currentStopId = operational?.currentStopId;
    const nextStopId = operational?.nextStopId;

    const currStop = currentStopId ? stops.find((s) => s.id === currentStopId) ?? null : null;
    const nxtStop = nextStopId ? stops.find((s) => s.id === nextStopId) ?? null : null;

    const currTrip = currStop ? memberTrips[currStop.tripId] ?? null : null;
    const nxtTrip = nxtStop ? memberTrips[nxtStop.tripId] ?? null : null;

    const members = sharedRide?.members ?? [];
    const onboardCount = members
      .filter((m) => m.status === 'onboard')
      .reduce((sum, m) => sum + (m.seats || 1), 0);
    const waitingCount = members
      .filter((m) => m.status === 'waiting_pickup' || m.status === 'reserved')
      .reduce((sum, m) => sum + (m.seats || 1), 0);

    return {
      currentStop: currStop,
      nextStop: nxtStop,
      currentTrip: currTrip,
      nextTrip: nxtTrip,
      occupancy: {
        seatsReserved: sharedRide?.seatsReserved ?? 0,
        maxSeats: sharedRide?.maxSeats ?? 4,
        onboardCount,
        waitingCount,
      },
    };
  }, [sharedRide, memberTrips]);

  return {
    sharedRide,
    sharedRideId,
    memberTrips,
    currentStop,
    nextStop,
    currentTrip,
    nextTrip,
    occupancy,
  };
}
