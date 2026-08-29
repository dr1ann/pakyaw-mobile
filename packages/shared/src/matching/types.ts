/**
 * Contract-aligned matching and trip domain types.
 *
 * These types deliberately have no Firebase, React, Expo, or platform imports.
 * Application and document states are imported from the canonical onboarding
 * domain and re-exported here for matching consumers' backwards compatibility.
 */

import type { ApplicationStatus, DocumentState } from '../onboarding/types';
import type {
  LatLng as TransportLatLng,
  RideMode,
  TripOffer as TransportTripOffer,
  TripOfferStatus,
  TripStatus as TransportTripStatus,
} from '../transport/contract';

export type { ApplicationStatus, DocumentState } from '../onboarding/types';
export type {
  RideMode,
  TripOfferStatus,
} from '../transport/contract';

/** @deprecated Use TripOfferStatus. Kept as a type-only compatibility alias. */
export type OfferStatus = TripOfferStatus;
export type TripStatus = TransportTripStatus;

export type EligibilityReason =
  | 'not_approved'
  | 'documents_expired'
  | 'account_blocked'
  | 'offline'
  | 'already_on_trip'
  | 'stale_location'
  | 'outside_service_area'
  | 'poor_gps_accuracy';

export type CancelReason =
  | 'passenger_changed_mind'
  | 'driver_unavailable'
  | 'unable_to_locate_passenger'
  | 'vehicle_issue'
  | 'safety_concern'
  | 'other';

export type LatLng = TransportLatLng;
export type TripOffer = TransportTripOffer;

export type MatchingConfig = {
  readonly gpsFreshnessSeconds: number;
  readonly initialRadiusKm: number;
  readonly secondRadiusKm: number;
  readonly finalRadiusKm: number;
  readonly offerTimeoutSeconds: number;
  readonly searchTimeoutSeconds: number;
};

/**
 * A matching snapshot must include every required document. The application
 * and document-review domain is responsible for changing an expired document
 * from `approved` to `expired`; matching only trusts the snapshot state.
 */
export type AccountStatus = 'active' | 'blocked' | 'suspended';

export type DriverAvailability = 'online' | 'offline';

export type DriverSnapshot = {
  readonly applicationStatus: ApplicationStatus;
  readonly accountStatus: AccountStatus;
  readonly availability: DriverAvailability;
  readonly activeTripId: string | null;
  readonly documents: Readonly<Record<string, DocumentState>>;
  readonly location: LatLng | null;
  readonly lastLocationAt: number | null;
  readonly gpsAccuracyMeters: number | null;
};

/**
 * The contract defines matching thresholds but not a service-area geometry or
 * a numerical GPS-accuracy limit. Those policy decisions are injected as pure
 * predicates so this module remains deterministic and does not invent them.
 */
export type DriverEligibilityConfig = {
  readonly matching: MatchingConfig;
  readonly requiredDocumentTypes: readonly string[];
  readonly isInsideServiceArea: (location: LatLng) => boolean;
  readonly isGpsAccuracyAcceptable: (accuracyMeters: number) => boolean;
};

export type EligibilityResult =
  | { readonly eligible: true }
  | { readonly eligible: false; readonly reason: EligibilityReason };

export type TripActor = 'passenger' | 'driver' | 'admin';

export type TripAction =
  | { readonly type: 'transition'; readonly next: TripStatus }
  | { readonly type: 'cancel'; readonly reason?: string };

export type TransitionError =
  | 'invalid_transition'
  | 'unauthorized_actor'
  | 'cannot_cancel'
  | 'invalid_cancel_reason';

export type TripTransitionResult =
  | { readonly allowed: true; readonly next: TripStatus }
  | { readonly allowed: false; readonly error: TransitionError };

export type CancelDecision =
  | { readonly allowed: true; readonly requiredReason: true }
  | { readonly allowed: false; readonly requiredReason: true };
