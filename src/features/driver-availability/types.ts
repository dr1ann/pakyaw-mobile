/**
 * Phase 5 — Driver availability types.
 * Matches database_schema.md §3 (drivers collection).
 */

import type { Timestamp } from '@/services/firebase/firebase';
export type { Timestamp };

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
  /** Native horizontal accuracy in metres; null deliberately fails eligibility. */
  readonly accuracyMeters: number | null;
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

/**
 * Pre-flight checklist item.
 * All six must be checked before Go Online is enabled.
 */
export type PreflightItem = {
  readonly id: PreflightItemId;
  readonly label: string;
  readonly description: string;
};

export type PreflightItemId =
  | 'license_verified'
  | 'or_cr_active'
  | 'tpl_insurance_current'
  | 'identity_selfie_matched'
  | 'active_vehicle_selected'
  | 'operator_affiliation';

export const PREFLIGHT_ITEMS: readonly PreflightItem[] = [
  {
    id: 'license_verified',
    label: "Driver's License Verified",
    description: "Your driver's license has been verified and is valid.",
  },
  {
    id: 'or_cr_active',
    label: 'OR/CR Active',
    description: 'Official receipt and certificate of registration are current.',
  },
  {
    id: 'tpl_insurance_current',
    label: 'TPL Insurance Current',
    description: 'Third-party liability insurance is up to date.',
  },
  {
    id: 'identity_selfie_matched',
    label: 'Identity Selfie Matched',
    description: 'Your selfie has been matched to your ID.',
  },
  {
    id: 'active_vehicle_selected',
    label: 'Active Vehicle Selected',
    description: 'You have selected your active vehicle for this trip.',
  },
  {
    id: 'operator_affiliation',
    label: 'Operator Affiliation Confirmed',
    description: 'Your operator affiliation is confirmed and active.',
  },
] as const;
