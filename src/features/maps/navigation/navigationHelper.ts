import type { TripStatus } from '@/features/trip/types';

/**
 * Predicate to check if a trip status corresponds to an active navigation phase.
 */
export function isNavActiveStatus(status: TripStatus | string | null | undefined): boolean {
  if (!status) return false;
  return ['accepted', 'driver_arriving', 'driver_arrived', 'in_progress'].includes(status);
}
