export type Timestamp = {
  readonly seconds: number;
  readonly nanoseconds: number;
  toDate?: () => Date;
  toMillis?: () => number;
};

import type { TripDoc } from '@pakyaw/shared/features/trip/types';
import type { RideMode } from '@pakyaw/shared/transport/contract';

export type TripHistoryItem = {
  readonly tripId: string;
  readonly status: 'completed' | 'cancelled';
  readonly mode: RideMode;
  readonly pickup: {
    readonly label: string;
  };
  readonly destination: {
    readonly label: string;
  };
  readonly passengerCount: number;
  /** Server-owned total only; null when a historical document lacks one. */
  readonly fareTotal: number | null;
  /** Stored road-route distance only; never derived from endpoint coordinates. */
  readonly routeDistanceMeters: number | null;
  readonly requestedAt: Timestamp | null;
  readonly completedAt: Timestamp | null;
  readonly cancelledAt: Timestamp | null;
  readonly driver: {
    readonly displayName: string;
    readonly plate: string;
    readonly vehicleType?: string | null;
    readonly profilePhotoUrl?: string | null;
  } | null;
  readonly bookingFor: 'self' | 'other' | null;
  readonly riderFirstName: string | null;
};

export type HistoryCursor = {
  readonly seconds: number;
  readonly nanoseconds: number;
};

export type TripDetail = TripDoc & {
  readonly driver?: {
    readonly displayName: string;
    readonly plate: string;
    readonly vehicleType?: string | null;
    readonly profilePhotoUrl?: string | null;
  } | null;
};
