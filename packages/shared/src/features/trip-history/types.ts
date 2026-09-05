export type Timestamp = {
  readonly seconds: number;
  readonly nanoseconds: number;
  toDate?(): Date;
  toMillis?(): number;
};

import type { TripDoc } from '@pakyaw/shared/features/trip/types';
import type { RideMode } from '@pakyaw/shared/transport/contract';

export type TripHistoryItem = {
  readonly tripId: string;
  readonly status: string;
  readonly mode?: RideMode | 'solo' | 'shared' | 'pakyaw' | string;
  readonly pickup: {
    readonly label: string;
  };
  readonly destination: {
    readonly label: string;
  };
  readonly passengerCount: number;
  readonly billedSeats?: number;
  readonly requestedAt?: Timestamp | null;
  readonly completedAt?: Timestamp | null;
  readonly cancelledAt?: Timestamp | null;
  readonly driverEarnings?: number | null;
  readonly fareTotal?: number | null;
  readonly driver?: {
    readonly displayName: string;
    readonly plate: string;
  } | null;
  readonly rider?: {
    readonly firstName: string;
  } | null;
};

export type HistoryCursor = {
  readonly seconds: number;
  readonly nanoseconds: number;
};

export type TripDetail = TripDoc & {
  readonly driver?: {
    readonly displayName: string;
    readonly plate: string;
  } | null;
  readonly passenger?: {
    readonly displayName: string;
    readonly phone: string;
  } | null;
};
