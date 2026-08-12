import { describe, expect, it } from 'vitest';

import {
  EXPIRED_DRIVER_APPLICATION,
  INCOMPLETE_DRIVER_APPLICATION,
  INVALID_DRIVER_APPLICATION,
  VALID_DRIVER_APPLICATION,
} from '@pakyaw/shared/onboarding/fixtures';
import { getSubmissionReadiness } from '@pakyaw/shared/onboarding/submission-readiness';

const NOW = Date.UTC(2027, 0, 15, 4, 0, 0);

describe('getSubmissionReadiness', () => {
  it('reports a complete draft as ready for submission', () => {
    expect(getSubmissionReadiness(VALID_DRIVER_APPLICATION, NOW)).toEqual({
      ready: true,
      issues: [],
    });
  });

  it('returns stable field-level issues for incomplete, invalid, and expired fixtures', () => {
    expect(getSubmissionReadiness(INCOMPLETE_DRIVER_APPLICATION, NOW)).toEqual({
      ready: false,
      issues: expect.arrayContaining([
        {
          field: 'personalDetails.fullLegalName',
          code: 'full_legal_name_required',
        },
        { field: 'vehicle.plateNumber', code: 'plate_number_required' },
        { field: 'documents.drivers_license', code: 'document_missing' },
      ]),
    });
    expect(getSubmissionReadiness(INVALID_DRIVER_APPLICATION, NOW)).toEqual({
      ready: false,
      issues: expect.arrayContaining([
        {
          field: 'personalDetails.verifiedMobile',
          code: 'verified_mobile_invalid',
        },
        { field: 'vehicle.orcrExpiry', code: 'orcr_expiry_invalid' },
        { field: 'documents.franchise', code: 'document_rejected' },
      ]),
    });
    expect(getSubmissionReadiness(EXPIRED_DRIVER_APPLICATION, NOW)).toEqual({
      ready: false,
      issues: expect.arrayContaining([
        { field: 'vehicle.orcrExpiry', code: 'orcr_expiry_expired' },
        { field: 'license.expiry', code: 'license_expiry_expired' },
        { field: 'franchise.expiry', code: 'franchise_expiry_expired' },
        { field: 'documents.drivers_license', code: 'document_expired' },
      ]),
    });
  });

  it('does not mutate status or grant approval while checking readiness', () => {
    const before = JSON.stringify(VALID_DRIVER_APPLICATION);
    const result = getSubmissionReadiness(VALID_DRIVER_APPLICATION, NOW);

    expect(result.ready).toBe(true);
    expect(VALID_DRIVER_APPLICATION.status).toBe('draft');
    expect(JSON.stringify(VALID_DRIVER_APPLICATION)).toBe(before);
  });
});
