import { useEffect, useRef } from 'react';

import { publishTripProgress } from '@pakyaw/shared/features/trip/services/trip.service';
import type { TripStatus } from '@pakyaw/shared/features/trip/types';
import { logger } from '@pakyaw/shared/lib/logger';

const PROGRESS_PUBLISH_INTERVAL_MS = 10_000;
const PROGRESS_ACTIVE_STATUSES: readonly TripStatus[] = [
  'driver_arriving',
  'in_progress',
];

export function shouldPublishTripProgress({
  now,
  lastPublishedAt,
  status,
  remainingMeters,
  etaSeconds,
}: {
  readonly now: number;
  readonly lastPublishedAt: number | null;
  readonly status: TripStatus | null;
  readonly remainingMeters: number | null;
  readonly etaSeconds: number | null;
}): boolean {
  if (status === null || !PROGRESS_ACTIVE_STATUSES.includes(status)) {
    return false;
  }

  if (
    remainingMeters === null ||
    etaSeconds === null ||
    !Number.isFinite(remainingMeters) ||
    !Number.isFinite(etaSeconds) ||
    remainingMeters < 0 ||
    etaSeconds < 0
  ) {
    return false;
  }

  return (
    lastPublishedAt === null ||
    now - lastPublishedAt >= PROGRESS_PUBLISH_INTERVAL_MS
  );
}

export function useTripProgressPublisher({
  tripId,
  status,
  remainingMeters,
  etaSeconds,
}: {
  readonly tripId: string | null;
  readonly status: TripStatus | null;
  readonly remainingMeters: number | null;
  readonly etaSeconds: number | null;
}): void {
  const lastPublishedAtRef = useRef<number | null>(null);
  const lastTripIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (tripId !== lastTripIdRef.current) {
      lastTripIdRef.current = tripId;
      lastPublishedAtRef.current = null;
    }

    const now = Date.now();
    if (
      !tripId ||
      !shouldPublishTripProgress({
        now,
        lastPublishedAt: lastPublishedAtRef.current,
        status,
        remainingMeters,
        etaSeconds,
      })
    ) {
      return;
    }

    lastPublishedAtRef.current = now;
    void publishTripProgress(tripId, {
      remainingMeters: Math.round(remainingMeters ?? 0),
      etaSeconds: Math.round(etaSeconds ?? 0),
    }).catch((err) => {
      logger.error('[trip] progress publish hook failed', { err, tripId });
    });
  }, [tripId, status, remainingMeters, etaSeconds]);
}
