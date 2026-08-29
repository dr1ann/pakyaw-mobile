import { useEffect, useState } from 'react';
import { useSessionStore } from '@pakyaw/shared/stores/sessionStore';
import { doc, onSnapshot } from 'firebase/firestore';
import { firestore } from '@/services/firebase/firebase';
import type { SharedRideDoc } from '@pakyaw/shared/features/trip/types';
import { SHARED_RIDES_COLLECTION } from '@pakyaw/shared/transport/contract';

function isTimestamp(value: unknown): boolean {
  return value !== null && typeof value === 'object' && 'toMillis' in value
    && typeof (value as { toMillis?: unknown }).toMillis === 'function'
    && Number.isFinite((value as { toMillis(): unknown }).toMillis());
}

function mapCanonicalSharedRide(id: string, value: Record<string, unknown>): SharedRideDoc | null {
  const members = Array.isArray(value.members) ? value.members : null;
  const tripIds = Array.isArray(value.tripIds) && value.tripIds.every((tripId) => typeof tripId === 'string')
    ? value.tripIds as string[]
    : null;
  const route = value.route && typeof value.route === 'object' ? value.route as Record<string, unknown> : null;
  const firstMember = members?.[0] && typeof members[0] === 'object' ? members[0] as Record<string, unknown> : null;
  const place = (value: unknown) => {
    if (!value || typeof value !== 'object') return null;
    const point = value as Record<string, unknown>;
    return typeof point.latitude === 'number' && typeof point.longitude === 'number'
      ? { lat: point.latitude, lng: point.longitude, label: typeof point.label === 'string' ? point.label : 'Stop' }
      : null;
  };
  if (typeof value.driverId !== 'string'
    || (value.status !== 'forming' && value.status !== 'active' && value.status !== 'completed' && value.status !== 'cancelled')
    || typeof value.maxSeats !== 'number'
    || !Number.isInteger(value.maxSeats)
    || value.maxSeats < 1
    || value.maxSeats > 12
    || typeof value.seatsReserved !== 'number'
    || !Number.isInteger(value.seatsReserved)
    || !Number.isFinite(value.seatsReserved)
    || value.seatsReserved < 0
    || value.seatsReserved > value.maxSeats
    || tripIds === null
    || route === null
    || typeof route.distanceMeters !== 'number'
    || !Number.isFinite(route.distanceMeters)
    || route.distanceMeters < 0
    || typeof route.durationSeconds !== 'number'
    || !Number.isFinite(route.durationSeconds)
    || route.durationSeconds < 0
    || (route.polyline !== undefined && typeof route.polyline !== 'string')
    || members === null
    || !isTimestamp(value.createdAt)
    || !isTimestamp(value.updatedAt)) {
    return null;
  }
  const routeOrigin = place(firstMember?.pickup);
  const routeDestination = place(firstMember?.destination);
  if (routeOrigin === null || routeDestination === null) return null;
  const passengers = members.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const member = item as Record<string, unknown>;
    const pickup = place(member.pickup);
    const destination = place(member.destination);
    if (typeof member.tripId !== 'string' || typeof member.passengerId !== 'string'
      || typeof member.seats !== 'number' || !Number.isInteger(member.seats) || member.seats < 1
      || !['reserved', 'waiting_pickup', 'onboard', 'dropped_off', 'cancelled'].includes(String(member.status))
      || pickup === null || destination === null) return [];
    return [{
      tripId: member.tripId,
      passengerId: member.passengerId,
      seatsCovered: member.seats,
      pickup: { label: pickup.label, coords: { lat: pickup.lat, lng: pickup.lng } },
      destination: { label: destination.label, coords: { lat: destination.lat, lng: destination.lng } },
      status: member.status === 'dropped_off' || member.status === 'cancelled' ? 'dropped_off' as const : 'active' as const,
    }];
  });
  const activeMemberSeats = members.reduce((total, item) => {
    if (!item || typeof item !== 'object') return total;
    const status = (item as Record<string, unknown>).status;
    return status === 'reserved' || status === 'waiting_pickup' || status === 'onboard'
      ? total + Number((item as Record<string, unknown>).seats)
      : total;
  }, 0);
  if (passengers.length !== members.length || activeMemberSeats !== value.seatsReserved
    || ((value.status === 'forming' || value.status === 'active') && activeMemberSeats === 0)
    || new Set(tripIds).size !== tripIds.length
    || tripIds.length !== passengers.length || passengers.some((passenger) => !tripIds.includes(passenger.tripId))) {
    return null;
  }
  return {
    id,
    driverId: value.driverId,
    status: value.status,
    maxSeats: value.maxSeats,
    seatsBooked: value.seatsReserved,
    totalPassengersCount: members.length,
    routePolyline: typeof route.polyline === 'string' ? route.polyline : '',
    routeOrigin,
    routeDestination,
    routeGeohash: '',
    routeHeadingDeg: 0,
    corridorThresholdMeters: 0,
    tripIds,
    passengers,
    createdAt: value.createdAt as SharedRideDoc['createdAt'],
    completedAt: null,
  };
}

export function useSharedRideSession() {
  const uid = useSessionStore((s) => s.uid);
  const [sharedRideId, setSharedRideId] = useState<string | null>(null);
  const [sharedRide, setSharedRide] = useState<SharedRideDoc | null>(null);

  useEffect(() => {
    if (!uid) return;

    // Listen to driver doc to get activeSharedRideId
    const unsubDriver = onSnapshot(doc(firestore, 'drivers', uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setSharedRideId(data.activeSharedRideId || null);
      }
    });

    return () => unsubDriver();
  }, [uid]);

  useEffect(() => {
    if (!sharedRideId) {
      return;
    }

    const unsubSharedRide = onSnapshot(doc(firestore, SHARED_RIDES_COLLECTION, sharedRideId), (snap) => {
      if (snap.exists()) {
        setSharedRide(mapCanonicalSharedRide(snap.id, snap.data()));
      } else {
        setSharedRide(null);
      }
    });

    return () => {
      unsubSharedRide();
      setSharedRide(null);
    };
  }, [sharedRideId]);

  return { sharedRide, sharedRideId };
}
