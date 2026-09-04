import { describe, expect, it } from 'vitest';

import {
  formatPeso,
  formatRoadDistance,
  formatTripDateTime,
  passengerCancellationCopy,
  passengerRideModeLabel,
  tripHistoryViewState,
} from './presentation';

describe('trip-history passenger presentation', () => {
  it('uses passenger-facing names for all canonical ride modes', () => {
    expect(passengerRideModeLabel('solo')).toBe('Pakyaw');
    expect(passengerRideModeLabel('shared')).toBe('Shared');
    expect(passengerRideModeLabel('hop')).toBe('Hop');
  });

  it('formats only authoritative non-negative fare values', () => {
    expect(formatPeso(68.6)).toBe('₱68.60');
    expect(formatPeso(null)).toBeNull();
    expect(formatPeso(-1)).toBeNull();
  });

  it('formats road-route distance without deriving a straight-line distance', () => {
    expect(formatRoadDistance(850)).toBe('850 m');
    expect(formatRoadDistance(2_450)).toBe('2.5 km');
    expect(formatRoadDistance(null)).toBeNull();
  });

  it('formats available completion timestamps and leaves missing timestamps blank', () => {
    const formatted = formatTripDateTime({
      toDate: () => new Date('2026-09-04T12:34:00.000Z'),
    });

    expect(formatted).toContain('2026');
    expect(formatted).toContain('•');
    expect(formatTripDateTime(null)).toBeNull();
  });

  it('never exposes raw cancellation codes that do not have passenger copy', () => {
    expect(passengerCancellationCopy('driver_unavailable')).toBe('Driver unavailable');
    expect(passengerCancellationCopy('internal_timeout')).toBeNull();
  });

  it('selects loading, empty-list, error, and cached-history states truthfully', () => {
    expect(tripHistoryViewState({ isLoading: true, isRefetching: false, isError: false, itemCount: 0 })).toBe('loading');
    expect(tripHistoryViewState({ isLoading: false, isRefetching: false, isError: false, itemCount: 0 })).toBe('list');
    expect(tripHistoryViewState({ isLoading: false, isRefetching: false, isError: true, itemCount: 0 })).toBe('error');
    expect(tripHistoryViewState({ isLoading: false, isRefetching: false, isError: true, itemCount: 2 })).toBe('list');
  });
});
