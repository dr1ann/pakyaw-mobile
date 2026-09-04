import type { RideMode } from '@pakyaw/shared/transport/contract';

type TimestampLike = {
  readonly seconds?: number;
  readonly nanoseconds?: number;
  toDate?: () => Date;
  toMillis?: () => number;
} | Date | string | number | null | undefined;

export function passengerRideModeLabel(mode: RideMode | string | null | undefined): string {
  switch (mode) {
    case 'shared':
      return 'Shared';
    case 'hop':
      return 'Hop';
    case 'solo':
    default:
      return 'Pakyaw';
  }
}

export function formatPeso(value: number | null | undefined): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return `₱${value.toFixed(2)}`;
}

export function formatRoadDistance(distanceMeters: number | null | undefined): string | null {
  if (typeof distanceMeters !== 'number' || !Number.isFinite(distanceMeters) || distanceMeters < 0) {
    return null;
  }
  if (distanceMeters < 1_000) return `${Math.round(distanceMeters)} m`;
  return `${(distanceMeters / 1_000).toFixed(1)} km`;
}

export function toDate(timestamp: TimestampLike): Date | null {
  if (!timestamp) return null;
  if (timestamp instanceof Date) return Number.isNaN(timestamp.getTime()) ? null : timestamp;
  if (typeof timestamp === 'string' || typeof timestamp === 'number') {
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof timestamp === 'object') {
    if (typeof timestamp.toDate === 'function') {
      const date = timestamp.toDate();
      return Number.isNaN(date.getTime()) ? null : date;
    }
    if (typeof timestamp.toMillis === 'function') {
      const date = new Date(timestamp.toMillis());
      return Number.isNaN(date.getTime()) ? null : date;
    }
    if (typeof timestamp.seconds === 'number') {
      const date = new Date(timestamp.seconds * 1_000);
      return Number.isNaN(date.getTime()) ? null : date;
    }
  }
  return null;
}

export function formatTripDateTime(timestamp: TimestampLike, long = false): string | null {
  const date = toDate(timestamp);
  if (!date) return null;
  const dateFormat: Intl.DateTimeFormatOptions = long
    ? { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric' };
  return `${date.toLocaleDateString('en-US', dateFormat)} • ${date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })}`;
}

export function passengerCancellationCopy(reason: string | null | undefined): string | null {
  switch (reason) {
    case 'passenger_changed_mind':
      return 'Cancelled by passenger';
    case 'driver_unavailable':
      return 'Driver unavailable';
    case 'unable_to_locate_passenger':
      return 'Driver could not locate the passenger';
    case 'vehicle_issue':
      return 'Vehicle issue';
    case 'safety_concern':
      return 'Cancelled for safety';
    default:
      return null;
  }
}

export function tripHistoryViewState({
  isLoading,
  isRefetching,
  isError,
  itemCount,
}: {
  readonly isLoading: boolean;
  readonly isRefetching: boolean;
  readonly isError: boolean;
  readonly itemCount: number;
}): 'loading' | 'error' | 'list' {
  if (isLoading && !isRefetching) return 'loading';
  if (isError && itemCount === 0) return 'error';
  return 'list';
}
