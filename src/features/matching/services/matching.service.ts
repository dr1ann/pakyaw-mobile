/**
 * matching.service — Phase 7 driver matching.
 *
 * - subscribeIncoming: real-time stream of trips in 'request' state with no
 *   driver, filtered by geohash prefix.
 * - acceptTrip: atomic two-write transaction that claims a trip. Rejects
 *   with TripAlreadyTakenError on collision.
 *
 * Both writes (trip + driver doc) MUST live in the same transaction. Never
 * use batch writes — batches do not re-read.
 */

import { FirebaseError } from 'firebase/app';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type DocumentData,
  type FirestoreError,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';

import { AcceptTripError, TripAlreadyTakenError } from '@/features/matching/errors';
import type { IncomingRequest } from '@/features/matching/types';
import { geohashNeighbors } from '@pakyaw/shared/lib/geo';
import { logger } from '@pakyaw/shared/lib/logger';
import { firestore } from '@/services/firebase/firebase';

// '' is a high BMP sentinel. [prefix, prefix+'') matches every
// geohash string that starts with prefix. Standard Firestore prefix-range idiom.
export function geohashRangeEnd(prefix: string): string {
  return prefix + '';
}

function mapDocToIncomingRequest(
  snap: QueryDocumentSnapshot<DocumentData>,
): IncomingRequest | null {
  const data = snap.data();
  const passengerId = data.passengerId;
  const pickup = data.pickup;
  const destination = data.destination;
  const passengerCount = data.passengerCount;
  const billedSeats = data.billedSeats;
  const route = data.route;
  const mode = data.mode;
  const seatsCovered = data.seatsCovered;
  const fare = data.fare;

  if (
    typeof passengerId !== 'string' ||
    typeof passengerCount !== 'number' ||
    typeof billedSeats !== 'number' ||
    pickup == null ||
    destination == null
  ) {
    logger.warn('[matching] dropped malformed trip doc', { tripId: snap.id });
    return null;
  }

  return {
    tripId: snap.id,
    passengerId,
    mode,
    pickup,
    destination,
    passengerCount,
    billedSeats,
    seatsCovered,
    route,
    fare,
  };
}

import { isPassengerInCorridor, DEFAULT_HOP_MATCHING_CONFIG, type HopMatchingConfig } from '@pakyaw/shared/features/matching/hop-matching-config';
import type { SharedRideDoc } from '@pakyaw/shared/features/trip/types';

export type DriverHopMatchingContext = {
  readonly activeSharedRide?: SharedRideDoc | null;
  readonly driverLocation?: { readonly lat: number; readonly lng: number } | null;
  readonly driverHeadingDeg?: number | null;
  readonly hopConfig?: HopMatchingConfig | null;
};

export function subscribeIncoming(
  driverGeohashPrefix: string,
  onSnap: (requests: readonly IncomingRequest[]) => void,
  onErr: (err: FirestoreError) => void,
  driverContext?: DriverHopMatchingContext,
): Unsubscribe {
  const prefixes = geohashNeighbors(driverGeohashPrefix);
  const tripsRaw = collection(firestore, 'trips');

  logger.info('[matching] subscribing to neighbor cells', {
    count: prefixes.length,
    prefixes,
  });

  const snapshotsByPrefix = new Map<string, readonly IncomingRequest[]>();

  function mergeAndEmit(): void {
    const seen = new Set<string>();
    const merged: IncomingRequest[] = [];
    const config = driverContext?.hopConfig || DEFAULT_HOP_MATCHING_CONFIG;

    for (const requests of snapshotsByPrefix.values()) {
      for (const r of requests) {
        if (seen.has(r.tripId)) continue;

        // Shared Ride + Hop Logic Filtering Rules
        if (r.mode === 'hop') {
          // Condition 1: Must have active Shared Ride session
          const activeRide = driverContext?.activeSharedRide;
          if (!activeRide || activeRide.status !== 'active') {
            logger.info('[matching] Filtered Hop request: Driver has no active Shared Ride', { tripId: r.tripId });
            continue;
          }

          // Capacity Rule: Maximum 6 cumulative passengers per Shared Ride session
          const totalPassengers = activeRide.totalPassengersCount ?? activeRide.passengers?.length ?? 0;
          if (totalPassengers >= config.maxSharedPassengers || activeRide.isLockedForHops) {
            logger.info('[matching] Filtered Hop request: Shared Ride is at max capacity', { tripId: r.tripId, totalPassengers });
            continue;
          }

          // Seat Rule: Hop riders may only reserve 1 seat each
          if (r.passengerCount > config.maxHopSeatsPerPassenger) {
            logger.info('[matching] Filtered Hop request: Exceeds 1-seat Hop limit', { tripId: r.tripId, passengerCount: r.passengerCount });
            continue;
          }

          // Conditions 2 & 3: Corridor width & forward-range dot-product validation
          const driverLoc = driverContext?.driverLocation;
          const driverHeading = driverContext?.driverHeadingDeg ?? activeRide.routeHeadingDeg ?? 0;

          if (driverLoc && activeRide.routeOrigin && activeRide.routeDestination && r.pickup?.coords) {
            const inCorridorAndAhead = isPassengerInCorridor(
              driverLoc,
              driverHeading,
              { lat: r.pickup.coords.lat, lng: r.pickup.coords.lng },
              activeRide.routeOrigin,
              activeRide.routeDestination,
              config
            );

            if (!inCorridorAndAhead) {
              logger.info('[matching] Filtered Hop request: Passenger outside corridor or behind driver', { tripId: r.tripId });
              continue;
            }
          }
        }

        seen.add(r.tripId);
        merged.push(r);
      }
    }

    logger.info('[matching] merged snapshot', {
      totalRequests: merged.length,
      activeSubscriptions: prefixes.length,
    });

    onSnap(merged);
  }

  const unsubscribes: Unsubscribe[] = prefixes.map((prefix) => {
    const q = query(
      tripsRaw,
      where('status', '==', 'request'),
      where('driverId', '==', null),
      where('geohash', '>=', prefix),
      where('geohash', '<', geohashRangeEnd(prefix)),
      orderBy('geohash'),
    );

    return onSnapshot(
      q,
      (snap) => {
        const requests: IncomingRequest[] = [];
        snap.forEach((d) => {
          const mapped = mapDocToIncomingRequest(d);
          if (mapped != null) requests.push(mapped);
        });
        snapshotsByPrefix.set(prefix, requests);
        mergeAndEmit();
      },
      (err) => {
        logger.error('[matching] subscribeIncoming failed', { err, prefix });
        onErr(err);
      },
    );
  });

  return () => {
    unsubscribes.forEach((unsub) => unsub());
  };
}

export async function acceptTrip(
  tripId: string,
  driverUid: string,
  sharedRideId?: string | null,
): Promise<void> {
  const tripRef = doc(firestore, 'trips', tripId);
  const driverRef = doc(firestore, 'drivers', driverUid);
  const sharedRideRef = sharedRideId ? doc(firestore, 'sharedRides', sharedRideId) : null;

  try {
    await runTransaction(firestore, async (tx) => {
      const [tripSnap, driverSnap, sharedRideSnap] = await Promise.all([
        tx.get(tripRef),
        tx.get(driverRef),
        sharedRideRef ? tx.get(sharedRideRef) : Promise.resolve(null),
      ]);

      if (!tripSnap.exists()) throw new TripAlreadyTakenError();
      if (!driverSnap.exists()) throw new TripAlreadyTakenError();

      const trip = tripSnap.data();
      if (trip.status !== 'request' || (trip.driverId != null && trip.driverId !== driverUid)) {
        throw new TripAlreadyTakenError();
      }

      const driver = driverSnap.data();
      
      // If driver is accepting a Hop while already on a Shared Ride, driver availability may be on_trip
      if (trip.mode !== 'hop' && (driver.availability !== 'online' || driver.activeTripId != null)) {
        throw new TripAlreadyTakenError();
      }

      tx.update(tripRef, {
        driverId: driverUid,
        status: 'accepted',
        acceptedAt: serverTimestamp(),
        sharedRideId: sharedRideId ?? trip.sharedRideId ?? null,
      });

      tx.update(driverRef, {
        activeTripId: tripId,
        availability: 'on_trip',
      });

      // Update Shared Ride Document if Hop / Shared Ride
      if (sharedRideSnap && sharedRideSnap.exists()) {
        const sharedRideData = sharedRideSnap.data();
        const currentPassengers = sharedRideData.passengers || [];
        const currentTotal = sharedRideData.totalPassengersCount ?? currentPassengers.length ?? 0;
        const newTotal = currentTotal + (trip.passengerCount || 1);

        const newPassenger = {
          tripId,
          passengerId: trip.passengerId,
          seatsCovered: trip.passengerCount || 1,
          pickup: trip.pickup,
          destination: trip.destination,
          status: 'active',
          isHop: trip.mode === 'hop',
          fare: trip.fare || 15,
        };

        tx.update(sharedRideRef!, {
          passengers: [...currentPassengers, newPassenger],
          tripIds: [...(sharedRideData.tripIds || []), tripId],
          totalPassengersCount: newTotal,
          isLockedForHops: newTotal >= (sharedRideData.maxSeats || 6),
        });
      }
    });
    logger.info('[matching] trip accepted', { tripId, driverUid, sharedRideId });
  } catch (err) {
    if (err instanceof TripAlreadyTakenError) throw err;
    logger.error('[matching] acceptTrip failed', { err, tripId, driverUid });
    if (err instanceof FirebaseError) throw new AcceptTripError(err);
    throw new AcceptTripError(err);
  }
}