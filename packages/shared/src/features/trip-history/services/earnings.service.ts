import type { TripHistoryItem } from '../types';

export type DriverEarningsSummary = {
  readonly today: number;
  readonly last7Days: number;
  readonly last30Days: number;
  readonly completedCount: number;
  readonly recentTrips: readonly TripHistoryItem[];
};

export function formatPhp(amount: number | null | undefined): string {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    return '—';
  }
  return `₱${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function computeDriverEarningsSummary(
  trips: readonly TripHistoryItem[],
  nowMs: number | Date = Date.now()
): DriverEarningsSummary {
  const completedTrips = trips.filter((t) => t.status === 'completed');

  const currentMs = typeof nowMs === 'number' ? nowMs : nowMs.getTime();
  const now = new Date(currentMs);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const sevenDaysAgo = currentMs - 7 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = currentMs - 30 * 24 * 60 * 60 * 1000;

  let today = 0;
  let last7Days = 0;
  let last30Days = 0;

  for (const trip of completedTrips) {
    const earnings = typeof trip.driverEarnings === 'number' && trip.driverEarnings > 0
      ? trip.driverEarnings
      : 0;

    const tripTimeMs = trip.completedAt?.toMillis?.()
      ?? (trip.completedAt?.seconds ? trip.completedAt.seconds * 1000 : null)
      ?? trip.requestedAt?.toMillis?.()
      ?? (trip.requestedAt?.seconds ? trip.requestedAt.seconds * 1000 : null);

    if (tripTimeMs !== null) {
      if (tripTimeMs >= todayStart) {
        today += earnings;
      }
      if (tripTimeMs >= sevenDaysAgo) {
        last7Days += earnings;
      }
      if (tripTimeMs >= thirtyDaysAgo) {
        last30Days += earnings;
      }
    }
  }

  return {
    today: Math.round((today + Number.EPSILON) * 100) / 100,
    last7Days: Math.round((last7Days + Number.EPSILON) * 100) / 100,
    last30Days: Math.round((last30Days + Number.EPSILON) * 100) / 100,
    completedCount: completedTrips.length,
    recentTrips: completedTrips.slice(0, 10),
  };
}
