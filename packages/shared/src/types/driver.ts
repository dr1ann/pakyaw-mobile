import type { Timestamp } from 'firebase/firestore';

/**
 * Driver online/offline states.
 * 'on_trip' is set by Phase 7 (accept transaction).
 */
export type Availability = 'offline' | 'online' | 'on_trip';

/**
 * GeoPoint-style location stored in Firestore.
 */
export interface DriverLocation {
  readonly latitude: number;
  readonly longitude: number;
}

/**
 * Full driver document shape — matches drivers/{uid}.
 * Keyed by Firebase Auth uid.
 */
export interface DriverDoc {
  uid: string;
  availability: Availability;
  /** Server timestamp of the last successful pre-flight pass. Null when never gone online. */
  preflightPassedAt: Timestamp | null;
  lastSeenAt: Timestamp | null;
  location: DriverLocation | null;
  geohash: string | null;
  heading: number | null;
  locationUpdatedAt: Timestamp | null;
  /** Set by Phase 7 on trip acceptance. */
  activeTripId: string | null;
  /** Lifetime completed trip count. */
  tripCount: number;
}
