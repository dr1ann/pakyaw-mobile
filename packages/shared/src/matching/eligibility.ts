import type {
  DocumentState,
  DriverEligibilityConfig,
  DriverSnapshot,
  EligibilityReason,
  EligibilityResult,
  LatLng,
  MatchingConfig,
} from './types';

/**
 * A driver receives the first failure in this order. The sequence follows the
 * contract’s eligibility rule order and is deliberately stable: later UI can
 * translate the resulting reason without exposing a changing list of errors.
 */
export const ELIGIBILITY_PRECEDENCE: readonly EligibilityReason[] = [
  'not_approved',
  'documents_expired',
  'account_blocked',
  'offline',
  'already_on_trip',
  'stale_location',
  'outside_service_area',
  'poor_gps_accuracy',
] as const;

export function isLocationFresh(
  lastLocationAt: number | null,
  config: MatchingConfig,
  now: number,
): boolean {
  const freshnessWindowMs = config.gpsFreshnessSeconds * 1_000;

  if (
    lastLocationAt === null ||
    !Number.isFinite(lastLocationAt) ||
    !Number.isFinite(now) ||
    !Number.isFinite(freshnessWindowMs) ||
    freshnessWindowMs < 0
  ) {
    return false;
  }

  const ageMs = now - lastLocationAt;
  return ageMs >= 0 && ageMs <= freshnessWindowMs;
}

export function hasCompliantRequiredDocuments(
  documents: Readonly<Record<string, DocumentState>>,
  requiredDocumentTypes: readonly string[],
): boolean {
  return (
    requiredDocumentTypes.length > 0 &&
    requiredDocumentTypes.every(
      (documentType) => documents[documentType] === 'approved',
    )
  );
}

function hasValidLocation(location: LatLng | null): location is LatLng {
  return (
    location !== null &&
    Number.isFinite(location.latitude) &&
    Number.isFinite(location.longitude) &&
    location.latitude >= -90 &&
    location.latitude <= 90 &&
    location.longitude >= -180 &&
    location.longitude <= 180
  );
}

function isInsideServiceArea(
  location: LatLng,
  config: DriverEligibilityConfig,
): boolean {
  try {
    return config.isInsideServiceArea(location);
  } catch {
    return false;
  }
}

function isGpsAccuracyAcceptable(
  accuracyMeters: number | null,
  config: DriverEligibilityConfig,
): boolean {
  if (
    accuracyMeters === null ||
    !Number.isFinite(accuracyMeters) ||
    accuracyMeters < 0
  ) {
    return false;
  }

  try {
    return config.isGpsAccuracyAcceptable(accuracyMeters);
  } catch {
    return false;
  }
}

/**
 * Returns exactly one reason for ineligibility, using
 * `ELIGIBILITY_PRECEDENCE`. A partial, malformed, or unknown location fails
 * closed instead of allowing a driver into matching.
 */
export function checkDriverEligibility(
  driver: DriverSnapshot,
  config: DriverEligibilityConfig,
  now: number,
): EligibilityResult {
  if (driver.applicationStatus !== 'approved') {
    return { eligible: false, reason: 'not_approved' };
  }

  if (
    !hasCompliantRequiredDocuments(
      driver.documents,
      config.requiredDocumentTypes,
    )
  ) {
    return { eligible: false, reason: 'documents_expired' };
  }

  if (driver.accountStatus !== 'active') {
    return { eligible: false, reason: 'account_blocked' };
  }

  if (driver.availability !== 'online') {
    return { eligible: false, reason: 'offline' };
  }

  if (driver.activeTripId !== null) {
    return { eligible: false, reason: 'already_on_trip' };
  }

  if (
    !hasValidLocation(driver.location) ||
    !isLocationFresh(driver.lastLocationAt, config.matching, now)
  ) {
    return { eligible: false, reason: 'stale_location' };
  }

  if (!isInsideServiceArea(driver.location, config)) {
    return { eligible: false, reason: 'outside_service_area' };
  }

  if (!isGpsAccuracyAcceptable(driver.gpsAccuracyMeters, config)) {
    return { eligible: false, reason: 'poor_gps_accuracy' };
  }

  return { eligible: true };
}
