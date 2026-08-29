import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  getDocs,
  query,
  where,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { firestore } from '@/services/firebase/firebase';
import type { SharedRideDoc, SharedRidePassenger, TripDoc } from '../types';
import { geohashNeighbors } from '../../../lib/geo';
import { logger } from '../../../lib/logger';
import { LEGACY_SHARED_RIDES_COLLECTION } from '../../../transport/contract';

export async function createSharedRide(
  driverId: string,
  firstTrip: TripDoc,
  maxSeats: number,
  corridorThresholdMeters: number
): Promise<string> {
  const sharedRideRef = doc(collection(firestore, LEGACY_SHARED_RIDES_COLLECTION));
  
  if (!firstTrip.route || !firstTrip.pickup.coords || !firstTrip.destination.coords) {
    throw new Error('Trip is missing route or coordinate data');
  }

  // Calculate heading
  const lat1 = (firstTrip.pickup.coords.lat * Math.PI) / 180;
  const lat2 = (firstTrip.destination.coords.lat * Math.PI) / 180;
  const dLng = ((firstTrip.destination.coords.lng - firstTrip.pickup.coords.lng) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const brng = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;

  const firstPassenger: SharedRidePassenger = {
    tripId: firstTrip.id,
    passengerId: firstTrip.passengerId,
    seatsCovered: firstTrip.seatsCovered || 1,
    pickup: firstTrip.pickup,
    destination: firstTrip.destination,
    status: 'active',
  };

  const data: SharedRideDoc = {
    id: sharedRideRef.id,
    driverId,
    status: 'active',
    maxSeats,
    seatsBooked: firstPassenger.seatsCovered,
    routePolyline: firstTrip.route.polyline,
    routeOrigin: firstTrip.pickup.coords,
    routeDestination: firstTrip.destination.coords,
    routeGeohash: firstTrip.geohash,
    routeHeadingDeg: brng,
    corridorThresholdMeters,
    tripIds: [firstTrip.id],
    passengers: [firstPassenger],
    createdAt: serverTimestamp() as any,
    completedAt: null,
  };

  await runTransaction(firestore, async (tx) => {
    tx.set(sharedRideRef, data);
    tx.update(doc(firestore, 'trips', firstTrip.id), {
      sharedRideId: sharedRideRef.id,
      driverId,
      status: 'accepted',
      acceptedAt: serverTimestamp(),
    });
    tx.update(doc(firestore, 'drivers', driverId), {
      activeSharedRideId: sharedRideRef.id,
      availability: 'on_trip',
    });
  });

  return sharedRideRef.id;
}

export function subscribeSharedRide(
  sharedRideId: string,
  onSnap: (doc: SharedRideDoc | null) => void,
  onErr: (err: Error) => void
): Unsubscribe {
  return onSnapshot(
    doc(firestore, LEGACY_SHARED_RIDES_COLLECTION, sharedRideId),
    (snap) => {
      if (snap.exists()) {
        onSnap(snap.data() as SharedRideDoc);
      } else {
        onSnap(null);
      }
    },
    onErr
  );
}

export async function joinSharedRide(
  sharedRideId: string,
  tripId: string
): Promise<void> {
  const sharedRideRef = doc(firestore, LEGACY_SHARED_RIDES_COLLECTION, sharedRideId);
  const tripRef = doc(firestore, 'trips', tripId);

  await runTransaction(firestore, async (tx) => {
    const sharedRideSnap = await tx.get(sharedRideRef);
    const tripSnap = await tx.get(tripRef);

    if (!sharedRideSnap.exists()) throw new Error('Shared ride not found');
    if (!tripSnap.exists()) throw new Error('Trip not found');

    const sharedRide = sharedRideSnap.data() as SharedRideDoc;
    const trip = tripSnap.data() as TripDoc;

    if (sharedRide.status !== 'active') {
      throw new Error('Shared ride is no longer active');
    }

    if (sharedRide.seatsBooked + (trip.seatsCovered || 1) > sharedRide.maxSeats) {
      throw new Error('Not enough seats available');
    }

    const newPassenger: SharedRidePassenger = {
      tripId: trip.id,
      passengerId: trip.passengerId,
      seatsCovered: trip.seatsCovered || 1,
      pickup: trip.pickup,
      destination: trip.destination,
      status: 'active',
    };

    tx.update(sharedRideRef, {
      seatsBooked: sharedRide.seatsBooked + newPassenger.seatsCovered,
      tripIds: [...sharedRide.tripIds, trip.id],
      passengers: [...sharedRide.passengers, newPassenger],
    });

    tx.update(tripRef, {
      sharedRideId: sharedRide.id,
      driverId: sharedRide.driverId,
      status: 'accepted',
      acceptedAt: serverTimestamp(),
    });
  });
}

export async function dropOffPassenger(
  sharedRideId: string,
  tripId: string
): Promise<void> {
  const sharedRideRef = doc(firestore, LEGACY_SHARED_RIDES_COLLECTION, sharedRideId);
  const tripRef = doc(firestore, 'trips', tripId);

  await runTransaction(firestore, async (tx) => {
    const sharedRideSnap = await tx.get(sharedRideRef);
    if (!sharedRideSnap.exists()) throw new Error('Shared ride not found');

    const sharedRide = sharedRideSnap.data() as SharedRideDoc;
    
    const droppedPassenger = sharedRide.passengers.find(p => p.tripId === tripId);
    if (!droppedPassenger) throw new Error('Passenger not found in shared ride');

    const updatedPassengers = sharedRide.passengers.map((p) => 
      p.tripId === tripId ? { ...p, status: 'dropped_off' as const } : p
    );

    const activeCount = updatedPassengers.filter(p => p.status === 'active').length;

    if (activeCount === 0) {
      // Complete the shared ride
      tx.update(sharedRideRef, {
        passengers: updatedPassengers,
        seatsBooked: 0,
        status: 'completed',
        completedAt: serverTimestamp(),
      });
      // Free the driver
      tx.update(doc(firestore, 'drivers', sharedRide.driverId), {
        activeSharedRideId: null,
        availability: 'online',
      });
    } else {
      tx.update(sharedRideRef, {
        passengers: updatedPassengers,
        seatsBooked: Math.max(0, sharedRide.seatsBooked - droppedPassenger.seatsCovered),
      });
    }

    tx.update(tripRef, {
      status: 'completed',
      completedAt: serverTimestamp(),
    });
  });
}
