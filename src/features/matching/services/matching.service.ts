/** Driver offer subscription and callable acceptance for matching. */

import {
  collection,
  onSnapshot,
  query,
  where,
  type DocumentData,
  type FirestoreError,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { AcceptTripError } from '@/features/matching/errors';
import type { IncomingRequest } from '@/features/matching/types';
import { logger } from '@pakyaw/shared/lib/logger';
import { firestore, functions } from '@/services/firebase/firebase';

function offerPlace(value: unknown): IncomingRequest['pickup'] | null {
  if (value === null || typeof value !== 'object') return null;
  const place = value as Record<string, unknown>;
  if (typeof place.latitude !== 'number' || typeof place.longitude !== 'number') return null;
  return {
    label: typeof place.label === 'string' ? place.label : 'Location',
    coords: { lat: place.latitude, lng: place.longitude },
  };
}
function timestampMillis(value: unknown): number | undefined {
  return value !== null && typeof value === 'object' && 'toMillis' in value
    && typeof (value as { toMillis?: unknown }).toMillis === 'function'
    ? (value as { toMillis(): number }).toMillis()
    : undefined;
}

function mapOfferToIncomingRequest(
  snap: QueryDocumentSnapshot<DocumentData>,
): IncomingRequest | null {
  const data = snap.data();
  const tripId = data.tripId;
  const pickup = offerPlace(data.pickup);
  const destination = offerPlace(data.destination);
  if (typeof tripId !== 'string' || pickup === null || destination === null) {
    logger.warn('[matching] dropped malformed offer', { offerId: snap.id });
    return null;
  }
  return {
    offerId: snap.id,
    tripId,
    // Offer documents deliberately do not disclose a passenger identity.
    passengerId: '',
    mode: 'solo',
    pickup,
    destination,
    passengerCount: 1,
    billedSeats: 1,
    fare: typeof data.fare === 'number' ? data.fare : undefined,
    offeredAt: timestampMillis(data.offeredAt),
    expiresAt: timestampMillis(data.expiresAt),
  };
}

/** Subscribes only to pending offers that belong to the authenticated driver. */
export function subscribeDriverOffers(
  driverId: string,
  onSnap: (requests: readonly IncomingRequest[]) => void,
  onErr: (err: FirestoreError) => void,
): Unsubscribe {
  const offers = query(
    collection(firestore, 'tripOffers'),
    where('driverId', '==', driverId),
    where('status', '==', 'pending'),
  );
  return onSnapshot(
    offers,
    (snapshot) => {
      const now = Date.now();
      onSnap(snapshot.docs
        .map(mapOfferToIncomingRequest)
        .filter((offer): offer is IncomingRequest => offer !== null)
        .filter((offer) => offer.expiresAt === undefined || offer.expiresAt > now));
    },
    onErr,
  );
}

export async function acceptTripOffer(
  tripId: string,
  offerId: string,
  driverUid: string,
): Promise<'accepted' | 'already_taken' | 'invalid'> {
  try {
    const result = await httpsCallable<
      { readonly tripId: string; readonly offerId: string; readonly driverId: string },
      { readonly result: 'accepted' | 'already_taken' | 'invalid' }
    >(functions, 'acceptTripOffer')({ tripId, offerId, driverId: driverUid });
    return result.data.result;
  } catch (err) {
    logger.error('[matching] acceptTripOffer failed', { err, tripId, offerId });
    throw new AcceptTripError(err);
  }
}
