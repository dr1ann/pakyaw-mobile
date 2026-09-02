export type Timestamp = {
  readonly seconds: number;
  readonly nanoseconds: number;
  toDate?: () => Date;
  toMillis?: () => number;
};

import type { TripDoc } from '@pakyaw/shared/features/trip/types';

export type TripHistoryItem = {
  readonly tripId: string;
  readonly status: string;
  readonly pickup: {
    readonly label: string;
  };
  readonly destination: {
    readonly label: string;
  };
  readonly passengerCount: number;
  readonly requestedAt: Timestamp | null;
  readonly completedAt: Timestamp | null;
  readonly cancelledAt: Timestamp | null;
  readonly driver: {
    readonly displayName: string;
    readonly plate: string;
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
