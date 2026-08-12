import { describe, expect, it } from 'vitest';

import {
  checkDriverEligibility,
  isLocationFresh,
} from '@pakyaw/shared/matching/eligibility';
import type {
  DriverEligibilityConfig,
  DriverSnapshot,
  MatchingConfig,
} from '@pakyaw/shared/matching/types';

const NOW = 1_700_000_000_000;

const MATCHING_CONFIG: MatchingConfig = {
  gpsFreshnessSeconds: 60,
  initialRadiusKm: 1,
  secondRadiusKm: 2,
  finalRadiusKm: 4,
  offerTimeoutSeconds: 15,
  searchTimeoutSeconds: 90,
};

const ELIGIBILITY_CONFIG: DriverEligibilityConfig = {
  matching: MATCHING_CONFIG,
  requiredDocumentTypes: ['drivers_license', 'orcr', 'franchise'],
  isInsideServiceArea: () => true,
  isGpsAccuracyAcceptable: (accuracyMeters) => accuracyMeters <= 20,
};

function createEligibleDriver(
  overrides: Partial<DriverSnapshot> = {},
): DriverSnapshot {
  return {
    applicationStatus: 'approved',
    accountStatus: 'active',
    availability: 'online',
    activeTripId: null,
    documents: {
      drivers_license: 'approved',
      orcr: 'approved',
      franchise: 'approved',
    },
    location: { latitude: 11.005, longitude: 124.6075 },
    lastLocationAt: NOW - 30_000,
    gpsAccuracyMeters: 10,
    ...overrides,
  };
}

describe('checkDriverEligibility', () => {
  it('accepts a driver who satisfies every contract rule', () => {
    expect(checkDriverEligibility(createEligibleDriver(), ELIGIBILITY_CONFIG, NOW)).toEqual({
      eligible: true,
    });
  });

  it.each([
    ['not approved', { applicationStatus: 'submitted' }, 'not_approved'],
    [
      'has expired or invalid required documents',
      { documents: { drivers_license: 'expired', orcr: 'approved' } },
      'documents_expired',
    ],
    ['has a blocked account', { accountStatus: 'blocked' }, 'account_blocked'],
    ['is offline', { availability: 'offline' }, 'offline'],
    ['is already on a trip', { activeTripId: 'trip-1' }, 'already_on_trip'],
    [
      'has a stale location',
      { lastLocationAt: NOW - 60_001 },
      'stale_location',
    ],
    ['has poor GPS accuracy', { gpsAccuracyMeters: 21 }, 'poor_gps_accuracy'],
  ] as const)(
    'rejects a driver who %s',
    (_label, overrides, reason) => {
      expect(
        checkDriverEligibility(createEligibleDriver(overrides), ELIGIBILITY_CONFIG, NOW),
      ).toEqual({ eligible: false, reason });
    },
  );

  it('rejects a driver outside the service area', () => {
    expect(
      checkDriverEligibility(
        createEligibleDriver(),
        { ...ELIGIBILITY_CONFIG, isInsideServiceArea: () => false },
        NOW,
      ),
    ).toEqual({ eligible: false, reason: 'outside_service_area' });
  });

  it.each([
    'missing',
    'uploaded',
    'under_review',
    'rejected',
    'expired',
  ] as const)('fails closed for a %s required document', (documentState) => {
    expect(
      checkDriverEligibility(
        createEligibleDriver({ documents: { drivers_license: documentState } }),
        ELIGIBILITY_CONFIG,
        NOW,
      ),
    ).toEqual({ eligible: false, reason: 'documents_expired' });
  });

  it('fails closed when a required document is absent', () => {
    expect(
      checkDriverEligibility(
        createEligibleDriver({ documents: { drivers_license: 'approved' } }),
        ELIGIBILITY_CONFIG,
        NOW,
      ),
    ).toEqual({ eligible: false, reason: 'documents_expired' });
  });

  it('fails closed for a missing location timestamp', () => {
    expect(
      checkDriverEligibility(
        createEligibleDriver({ lastLocationAt: null }),
        ELIGIBILITY_CONFIG,
        NOW,
      ),
    ).toEqual({ eligible: false, reason: 'stale_location' });
  });

  it('fails closed for missing GPS accuracy', () => {
    expect(
      checkDriverEligibility(
        createEligibleDriver({ gpsAccuracyMeters: null }),
        ELIGIBILITY_CONFIG,
        NOW,
      ),
    ).toEqual({ eligible: false, reason: 'poor_gps_accuracy' });
  });

  it('uses the documented precedence when a driver fails multiple rules', () => {
    expect(
      checkDriverEligibility(
        createEligibleDriver({
          applicationStatus: 'submitted',
          accountStatus: 'blocked',
          availability: 'offline',
          activeTripId: 'trip-1',
          documents: { drivers_license: 'expired' },
          lastLocationAt: NOW - 60_001,
          gpsAccuracyMeters: null,
        }),
        { ...ELIGIBILITY_CONFIG, isInsideServiceArea: () => false },
        NOW,
      ),
    ).toEqual({ eligible: false, reason: 'not_approved' });
  });
});

describe('isLocationFresh', () => {
  it.each([
    ['exactly at the freshness boundary', NOW - 60_000, true],
    ['just before the freshness boundary', NOW - 59_999, true],
    ['just after the freshness boundary', NOW - 60_001, false],
    ['a future timestamp', NOW + 1, false],
    ['a missing timestamp', null, false],
  ] as const)('%s', (_label, lastLocationAt, expected) => {
    expect(isLocationFresh(lastLocationAt, MATCHING_CONFIG, NOW)).toBe(expected);
  });
});
