import { useActiveTripStore } from '@pakyaw/shared/stores/activeTripStore';
import type { TripStatus } from '@pakyaw/shared/features/trip/types';
import type { NavPhase } from '../navigation/types';

/**
 * Derives the current NavPhase from a TripStatus.
 */
export function getNavPhase(status: TripStatus | null): NavPhase {
  if (!status) return 'idle';
  switch (status) {
    case 'request':
      return 'idle';
    case 'accepted':
    case 'driver_arriving':
      return 'to_pickup';
    case 'driver_arrived':
      return 'at_pickup';
    case 'in_progress':
      return 'to_destination';
    case 'completed':
    case 'cancelled':
      return 'ended';
    default:
      return 'idle';
  }
}

/**
 * Custom hook to derive the navigation phase from the active trip status.
 */
export function useNavigationPhase(): NavPhase {
  const status = useActiveTripStore((s) => s.trip?.status ?? null);
  return getNavPhase(status);
}
