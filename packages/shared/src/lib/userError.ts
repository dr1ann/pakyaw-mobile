/**
 * formatUserFriendlyError
 * Converts raw network, Firebase callable, or server error messages into clear, actionable UX text.
 */
export function formatUserFriendlyError(
  error: unknown,
  defaultMessage = 'An unexpected issue occurred. Please try again.'
): string {
  if (!error) return defaultMessage;

  const raw = typeof error === 'string'
    ? error
    : error instanceof Error
      ? error.message
      : String(error);

  const lower = raw.toLowerCase();

  if (
    lower.includes('network') ||
    lower.includes('offline') ||
    lower.includes('failed to fetch') ||
    lower.includes('unavailable') ||
    lower.includes('timeout')
  ) {
    return 'Connection issue detected. Please check your internet connection and try again.';
  }

  if (
    lower.includes('permission') ||
    lower.includes('unauthorized') ||
    lower.includes('unauthenticated')
  ) {
    return 'Your session has expired. Please sign in again to continue.';
  }

  if (
    lower.includes('already_taken') ||
    lower.includes('already accepted') ||
    lower.includes('already assigned') ||
    lower.includes('already_closed')
  ) {
    return 'This ride offer was already accepted by another driver.';
  }

  if (
    lower.includes('expired') ||
    lower.includes('timed out') ||
    lower.includes('deadline')
  ) {
    return 'This request has expired and is no longer available.';
  }

  if (lower.includes('capacity') || lower.includes('seats')) {
    return 'Vehicle seat limit reached. Please adjust your seat selection.';
  }

  if (lower.includes('service area') || lower.includes('outside')) {
    return 'This location is outside the active Pakyaw service area.';
  }

  // If the message is already short human-readable English without codes/symbols, preserve it
  if (
    raw.length < 100 &&
    !raw.includes('/') &&
    !raw.includes('Error:') &&
    !raw.includes('Exception') &&
    !raw.includes('{') &&
    !raw.includes('function')
  ) {
    return raw;
  }

  return defaultMessage;
}
