import type { CancelReason } from './types';

export const CANCELLATION_REASONS: { code: CancelReason; label: string }[] = [
  { code: 'passenger_changed_mind', label: 'Plans changed / ride no longer needed' },
  { code: 'driver_unavailable', label: 'Driver unavailable / taking too long' },
  { code: 'unable_to_locate_passenger', label: 'Cannot meet at the pickup point' },
  { code: 'vehicle_issue', label: 'Vehicle problem' },
  { code: 'safety_concern', label: 'Safety concern' },
  { code: 'other', label: 'Other' },
];

export function isCancellationReason(value: string): value is CancelReason {
  return CANCELLATION_REASONS.some(({ code }) => code === value);
}
