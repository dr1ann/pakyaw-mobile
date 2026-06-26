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
import { geohashNeighbors } from '@/lib/geo';
import { logger } from '@/lib/logger';
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
    pickup,
    destination,
    passengerCount,
    billedSeats,
    route,
  };
}

export function subscribeIncoming(
  driverGeohashPrefix: string,
  onSnap: (requests: readonly IncomingRequest[]) => void,
  onErr: (err: FirestoreError) => void,
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

    for (const requests of snapshotsByPrefix.values()) {
      for (const r of requests) {
        if (!seen.has(r.tripId)) {
          seen.add(r.tripId);
          merged.push(r);
        }
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
): Promise<void> {
  const tripRef = doc(firestore, 'trips', tripId);
  const driverRef = doc(firestore, 'drivers', driverUid);

  try {
    await runTransaction(firestore, async (tx) => {
      const [tripSnap, driverSnap] = await Promise.all([
        tx.get(tripRef),
        tx.get(driverRef),
      ]);

      if (!tripSnap.exists()) throw new TripAlreadyTakenError();
      if (!driverSnap.exists()) throw new TripAlreadyTakenError();

      const trip = tripSnap.data();
      if (trip.status !== 'request' || trip.driverId != null) {
        throw new TripAlreadyTakenError();
      }

      const driver = driverSnap.data();
      if (driver.availability !== 'online' || driver.activeTripId != null) {
        throw new TripAlreadyTakenError();
      }

      tx.update(tripRef, {
        driverId: driverUid,
        status: 'accepted',
        acceptedAt: serverTimestamp(),
      });
      tx.update(driverRef, {
        activeTripId: tripId,
        availability: 'on_trip',
      });
    });
    logger.info('[matching] trip accepted', { tripId, driverUid });
  } catch (err) {
    if (err instanceof TripAlreadyTakenError) throw err;
    logger.error('[matching] acceptTrip failed', { err, tripId, driverUid });
    if (err instanceof FirebaseError) throw new AcceptTripError(err);
    throw new AcceptTripError(err);
  }
}