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
import { isPassengerCountAllowed, isRideMode, isTripOfferStatus } from '@pakyaw/shared/transport/contract';
import { firestore, functions } from '@/services/firebase/firebase';

function offerPlace(value: unknown): IncomingRequest['pickup'] | null {
  if (value === null || typeof value !== 'object') return null;
  const place = value as Record<string, unknown>;
  if (typeof place.latitude !== 'number' || !Number.isFinite(place.latitude)
    || place.latitude < -90 || place.latitude > 90
    || typeof place.longitude !== 'number' || !Number.isFinite(place.longitude)
    || place.longitude < -180 || place.longitude > 180) return null;
  return {
    label: typeof place.label === 'string' ? place.label : 'Location',
    coords: { lat: place.latitude, lng: place.longitude },
  };
}
function timestampMillis(value: unknown): number | undefined {
  if (value === null || typeof value !== 'object' || !('toMillis' in value)
    || typeof (value as { toMillis?: unknown }).toMillis !== 'function') return undefined;
  const milliseconds = (value as { toMillis(): unknown }).toMillis();
  return typeof milliseconds === 'number' && Number.isFinite(milliseconds) ? milliseconds : undefined;
}

function mapOfferToIncomingRequest(
  snap: QueryDocumentSnapshot<DocumentData>,
): IncomingRequest | null {
  const data = snap.data();
  const tripId = data.tripId;
  const mode = data.mode;
  const passengerCount = data.passengerCount;
  const billedSeats = data.billedSeats;
  const fare = data.fare;
  const offerFare = fare !== null && typeof fare === 'object' && !Array.isArray(fare)
    ? fare as Record<string, unknown>
    : null;
  const pickup = offerPlace(data.pickup);
  const destination = offerPlace(data.destination);
  const offeredAt = timestampMillis(data.offeredAt);
  const expiresAt = timestampMillis(data.expiresAt);
  if (
    typeof tripId !== 'string' ||
    !isRideMode(mode) ||
    !isTripOfferStatus(data.status) ||
    data.status !== 'pending' ||
    typeof passengerCount !== 'number' ||
    !isPassengerCountAllowed(mode, passengerCount) ||
    typeof billedSeats !== 'number' ||
    !Number.isInteger(billedSeats) ||
    billedSeats < 1 ||
    billedSeats > 12 ||
    offerFare === null ||
    typeof offerFare.total !== 'number' ||
    !Number.isFinite(offerFare.total) ||
    offerFare.total < 0 ||
    typeof offerFare.driverEarnings !== 'number' ||
    !Number.isFinite(offerFare.driverEarnings) ||
    offerFare.driverEarnings < 0 ||
    pickup === null ||
    destination === null ||
    offeredAt === undefined ||
    expiresAt === undefined ||
    expiresAt <= offeredAt
  ) {
    logger.warn('[matching] dropped malformed offer', { offerId: snap.id });
    return null;
  }
  return {
    offerId: snap.id,
    tripId,
    mode,
    pickup,
    destination,
    passengerCount,
    billedSeats,
    status: 'pending',
    fare: {
      total: offerFare.total,
      driverEarnings: offerFare.driverEarnings,
    },
    ...(typeof data.sharedRideId === 'string' ? { sharedRideId: data.sharedRideId } : {}),
    offeredAt,
    expiresAt,
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
        .filter((offer) => offer.expiresAt > now));
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

/** Expires this Driver's addressed offer and prompts backend retry when safe. */
export async function declineTripOffer(
  tripId: string,
  offerId: string,
  driverUid: string,
): Promise<'declined' | 'already_closed' | 'invalid'> {
  try {
    const result = await httpsCallable<
      { readonly tripId: string; readonly offerId: string; readonly driverId: string },
      { readonly result: 'declined' | 'already_closed' | 'invalid' }
    >(functions, 'declineTripOffer')({ tripId, offerId, driverId: driverUid });
    return result.data.result;
  } catch (err) {
    logger.error('[matching] declineTripOffer failed', { err, tripId, offerId });
    throw err;
  }
}
