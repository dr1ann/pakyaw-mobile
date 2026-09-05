import { describe, expect, it } from 'vitest';
import { computeDriverEarningsSummary, formatPhp } from './earnings.service';
import type { TripHistoryItem } from '../types';

describe('earnings.service', () => {
  const now = new Date('2026-09-05T12:00:00.000Z');

  it('formats PHP currency correctly', () => {
    expect(formatPhp(0)).toBe('₱0.00');
    expect(formatPhp(43)).toBe('₱43.00');
    expect(formatPhp(1250.5)).toBe('₱1,250.50');
  });

  it('computes summary for empty trips list', () => {
    const summary = computeDriverEarningsSummary([], now);

    expect(summary.today).toBe(0);
    expect(summary.last7Days).toBe(0);
    expect(summary.last30Days).toBe(0);
    expect(summary.completedCount).toBe(0);
    expect(summary.recentTrips).toHaveLength(0);
  });

  it('accurately computes Today, 7 Days, and 30 Days earnings from completed trips only', () => {
    const trips: TripHistoryItem[] = [
      // Today (2 hours ago)
      {
        tripId: 't-today-1',
        mode: 'pakyaw',
        status: 'completed',
        pickup: { label: 'Robinsons' },
        destination: { label: 'Ormoc City Hall' },
        passengerCount: 2,
        billedSeats: 4,
        driverEarnings: 45.0,
        fareTotal: 50.0,
        requestedAt: { seconds: Math.floor(new Date('2026-09-05T10:00:00.000Z').getTime() / 1000), nanoseconds: 0 },
      },
      // Today (4 hours ago)
      {
        tripId: 't-today-2',
        mode: 'shared',
        status: 'completed',
        pickup: { label: 'Market' },
        destination: { label: 'Bus Terminal' },
        passengerCount: 1,
        billedSeats: 1,
        driverEarnings: 25.0,
        fareTotal: 30.0,
        requestedAt: { seconds: Math.floor(new Date('2026-09-05T08:00:00.000Z').getTime() / 1000), nanoseconds: 0 },
      },
      // Today - CANCELLED (should NOT contribute to earnings)
      {
        tripId: 't-today-cancelled',
        mode: 'pakyaw',
        status: 'cancelled',
        pickup: { label: 'Airport' },
        destination: { label: 'Hotel' },
        passengerCount: 1,
        billedSeats: 4,
        driverEarnings: 40.0, // even if present in raw item, should be ignored because status is cancelled
        fareTotal: 45.0,
        requestedAt: { seconds: Math.floor(new Date('2026-09-05T07:00:00.000Z').getTime() / 1000), nanoseconds: 0 },
      },
      // 3 days ago (within 7 days and 30 days, NOT today)
      {
        tripId: 't-3days-ago',
        mode: 'shared',
        status: 'completed',
        pickup: { label: 'SM Center' },
        destination: { label: 'Port' },
        passengerCount: 2,
        billedSeats: 2,
        driverEarnings: 50.0,
        fareTotal: 60.0,
        requestedAt: { seconds: Math.floor(new Date('2026-09-02T10:00:00.000Z').getTime() / 1000), nanoseconds: 0 },
      },
      // 15 days ago (within 30 days, NOT 7 days, NOT today)
      {
        tripId: 't-15days-ago',
        mode: 'pakyaw',
        status: 'completed',
        pickup: { label: 'Hospital' },
        destination: { label: 'Plaza' },
        passengerCount: 1,
        billedSeats: 4,
        driverEarnings: 80.0,
        fareTotal: 90.0,
        requestedAt: { seconds: Math.floor(new Date('2026-08-21T10:00:00.000Z').getTime() / 1000), nanoseconds: 0 },
      },
      // 45 days ago (beyond 30 days - excluded from all 3 buckets, but completedCount tracks completed)
      {
        tripId: 't-45days-ago',
        mode: 'pakyaw',
        status: 'completed',
        pickup: { label: 'Old Town' },
        destination: { label: 'Pier' },
        passengerCount: 1,
        billedSeats: 4,
        driverEarnings: 100.0,
        fareTotal: 110.0,
        requestedAt: { seconds: Math.floor(new Date('2026-07-20T10:00:00.000Z').getTime() / 1000), nanoseconds: 0 },
      },
    ];

    const summary = computeDriverEarningsSummary(trips, now);

    // Today: 45 + 25 = 70
    expect(summary.today).toBe(70.0);

    // 7 Days: Today (70) + 3days (50) = 120
    expect(summary.last7Days).toBe(120.0);

    // 30 Days: 7 Days (120) + 15days (80) = 200
    expect(summary.last30Days).toBe(200.0);

    // Completed count = 5 (all except cancelled)
    expect(summary.completedCount).toBe(5);

    // Recent trips should only contain completed trips, up to limit (5 here)
    expect(summary.recentTrips).toHaveLength(5);
    expect(summary.recentTrips.every((t) => t.status === 'completed')).toBe(true);
  });

  it('handles null driverEarnings safely without crashing or corrupting sum', () => {
    const trips: TripHistoryItem[] = [
      {
        tripId: 't-no-earnings',
        mode: 'pakyaw',
        status: 'completed',
        pickup: { label: 'Origin' },
        destination: { label: 'Destination' },
        passengerCount: 1,
        driverEarnings: null,
        requestedAt: { seconds: Math.floor(now.getTime() / 1000), nanoseconds: 0 },
      },
      {
        tripId: 't-with-earnings',
        mode: 'pakyaw',
        status: 'completed',
        pickup: { label: 'Origin' },
        destination: { label: 'Destination' },
        passengerCount: 1,
        driverEarnings: 30,
        requestedAt: { seconds: Math.floor(now.getTime() / 1000), nanoseconds: 0 },
      },
    ];

    const summary = computeDriverEarningsSummary(trips, now);
    expect(summary.today).toBe(30);
    expect(summary.completedCount).toBe(2);
  });
});
