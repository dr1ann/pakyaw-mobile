import { describe, expect, it } from 'vitest';

import {
  isExpiryDateValid,
  normalizePhilippineMobile,
  validateDriverApplication,
} from '@pakyaw/shared/onboarding/driver-application-schema';
import { VALID_DRIVER_APPLICATION } from '@pakyaw/shared/onboarding/fixtures';
import type {
  DocumentState,
  DriverApplication,
} from '@pakyaw/shared/onboarding/types';

const NOW = Date.UTC(2027, 0, 15, 4, 0, 0);
const REQUIRED_DOCUMENT_TYPES = ['drivers_license', 'orcr', 'franchise'] as const;
type RequiredDocumentType = (typeof REQUIRED_DOCUMENT_TYPES)[number];

function createApplication(
  overrides: {
    personalDetails?: Partial<
      Omit<DriverApplication['personalDetails'], 'emergencyContact'>
    > & {
      emergencyContact?: Partial<
        DriverApplication['personalDetails']['emergencyContact']
      >;
    };
    vehicle?: Partial<DriverApplication['vehicle']>;
    license?: Partial<DriverApplication['license']>;
    franchise?: Partial<DriverApplication['franchise']>;
    documents?: Partial<
      Record<'drivers_license' | 'orcr' | 'franchise', DocumentState>
    >;
    status?: DriverApplication['status'];
  } = {},
): DriverApplication {
  const personalDetails = overrides.personalDetails;

  return {
    ...VALID_DRIVER_APPLICATION,
    status: overrides.status ?? VALID_DRIVER_APPLICATION.status,
    personalDetails: {
      ...VALID_DRIVER_APPLICATION.personalDetails,
      ...personalDetails,
      emergencyContact: {
        ...VALID_DRIVER_APPLICATION.personalDetails.emergencyContact,
        ...personalDetails?.emergencyContact,
      },
    },
    vehicle: {
      ...VALID_DRIVER_APPLICATION.vehicle,
      ...overrides.vehicle,
    },
    license: {
      ...VALID_DRIVER_APPLICATION.license,
      ...overrides.license,
    },
    franchise: {
      ...VALID_DRIVER_APPLICATION.franchise,
      ...overrides.franchise,
    },
    documents: {
      drivers_license:
        overrides.documents?.drivers_license ??
        VALID_DRIVER_APPLICATION.documents.drivers_license,
      orcr: overrides.documents?.orcr ?? VALID_DRIVER_APPLICATION.documents.orcr,
      franchise:
        overrides.documents?.franchise ??
        VALID_DRIVER_APPLICATION.documents.franchise,
    },
  };
}

function issueCodes(application: DriverApplication): string[] {
  return validateDriverApplication(application, NOW).map((issue) => issue.code);
}

describe('validateDriverApplication', () => {
  it('accepts a complete application that is ready for submission', () => {
    expect(validateDriverApplication(createApplication(), NOW)).toEqual([]);
  });

  it.each([
    [
      'full legal name',
      createApplication({ personalDetails: { fullLegalName: '   ' } }),
      'full_legal_name_required',
    ],
    [
      'verified mobile',
      createApplication({ personalDetails: { verifiedMobile: '' } }),
      'verified_mobile_required',
    ],
    [
      'barangay address',
      createApplication({ personalDetails: { barangayAddress: '' } }),
      'barangay_address_required',
    ],
    [
      'emergency contact name',
      createApplication({ personalDetails: { emergencyContact: { name: '' } } }),
      'emergency_contact_name_required',
    ],
    [
      'emergency contact mobile',
      createApplication({ personalDetails: { emergencyContact: { mobile: '' } } }),
      'emergency_contact_mobile_required',
    ],
    [
      'plate number',
      createApplication({ vehicle: { plateNumber: '' } }),
      'plate_number_required',
    ],
    [
      'unit or body number',
      createApplication({ vehicle: { unitBodyNumber: '' } }),
      'unit_body_number_required',
    ],
    [
      'vehicle description',
      createApplication({ vehicle: { description: '' } }),
      'vehicle_description_required',
    ],
    [
      'owner or operator information',
      createApplication({ vehicle: { ownerOperatorInfo: '' } }),
      'owner_operator_info_required',
    ],
    [
      'OR/CR number',
      createApplication({ vehicle: { orcrNumber: '' } }),
      'orcr_number_required',
    ],
    [
      'OR/CR expiry',
      createApplication({ vehicle: { orcrExpiry: '' } }),
      'orcr_expiry_required',
    ],
    [
      'licence number',
      createApplication({ license: { number: '' } }),
      'license_number_required',
    ],
    [
      'licence expiry',
      createApplication({ license: { expiry: '' } }),
      'license_expiry_required',
    ],
    [
      'franchise document type',
      createApplication({ franchise: { documentType: '' } }),
      'franchise_type_required',
    ],
    [
      'franchise document number',
      createApplication({ franchise: { documentNumber: '' } }),
      'franchise_number_required',
    ],
    [
      'franchise expiry',
      createApplication({ franchise: { expiry: '' } }),
      'franchise_expiry_required',
    ],
  ] as const)('requires %s', (_label, application, expectedCode) => {
    expect(issueCodes(application)).toContain(expectedCode);
  });

  it('requires the driver-owner flag to be a boolean', () => {
    const application = createApplication({
      vehicle: { isDriverOwner: undefined as unknown as boolean },
    });

    expect(issueCodes(application)).toContain('driver_owner_flag_invalid');
  });

  it('accepts both driver-owned and third-party-owned vehicles with owner data', () => {
    expect(
      validateDriverApplication(
        createApplication({
          vehicle: { isDriverOwner: true, ownerOperatorInfo: 'Sample Driver' },
        }),
        NOW,
      ),
    ).toEqual([]);
    expect(
      validateDriverApplication(
        createApplication({
          vehicle: {
            isDriverOwner: false,
            ownerOperatorInfo: 'Sample Transport Cooperative',
          },
        }),
        NOW,
      ),
    ).toEqual([]);
  });

  it.each([
    ['+63 E.164', '+639171234567', '+639171234567'],
    ['local normalized form', '09171234567', '+639171234567'],
    ['national normalized form', '9171234567', '+639171234567'],
    ['formatted local form', '0917-123-4567', '+639171234567'],
  ])('normalizes a valid %s Philippine mobile', (_label, input, expected) => {
    expect(normalizePhilippineMobile(input)).toBe(expected);
  });

  it.each(['+6309171234567', '0212345678', '0917123456', 'not-a-number']) (
    'rejects an invalid Philippine mobile: %s',
    (input) => {
      expect(normalizePhilippineMobile(input)).toBeNull();
    },
  );

  it('validates the emergency contact independently of the driver mobile', () => {
    expect(
      issueCodes(
        createApplication({
          personalDetails: {
            verifiedMobile: 'not-a-mobile-number',
            emergencyContact: { mobile: '+639171234567' },
          },
        }),
      ),
    ).toContain('verified_mobile_invalid');

    expect(
      issueCodes(
        createApplication({
          personalDetails: {
            emergencyContact: { mobile: 'not-a-mobile-number' },
          },
        }),
      ),
    ).toContain('emergency_contact_mobile_invalid');
  });

  for (const documentType of REQUIRED_DOCUMENT_TYPES) {
    it.each([
      ['missing', 'document_missing'],
      ['uploaded', null],
      ['under_review', 'document_under_review'],
      ['approved', null],
      ['rejected', 'document_rejected'],
      ['expired', 'document_expired'],
    ] as const)(`handles ${documentType} in the %s state`, (state, expectedCode) => {
      const documents: Partial<Record<RequiredDocumentType, DocumentState>> = {};
      documents[documentType] = state;

      const issue = validateDriverApplication(
        createApplication({ documents }),
        NOW,
      ).find((candidate) => candidate.field === `documents.${documentType}`);

      expect(issue?.code).toBe(expectedCode ?? undefined);
    });
  }

  it('blocks invalid and expired OR/CR, licence, and franchise dates', () => {
    const invalidDates = createApplication({
      vehicle: { orcrExpiry: '2027-02-30' },
      license: { expiry: 'not-a-date' },
      franchise: { expiry: '2020-01-01' },
    });

    expect(issueCodes(invalidDates)).toEqual(
      expect.arrayContaining([
        'orcr_expiry_invalid',
        'license_expiry_invalid',
        'franchise_expiry_expired',
      ]),
    );
  });

  it('only permits draft and needs-correction applications to be submitted', () => {
    expect(validateDriverApplication(createApplication({ status: 'draft' }), NOW)).toEqual([]);
    expect(
      validateDriverApplication(createApplication({ status: 'needs_correction' }), NOW),
    ).toEqual([]);
    expect(issueCodes(createApplication({ status: 'submitted' }))).toContain(
      'application_status_not_submittable',
    );
  });
});

describe('isExpiryDateValid', () => {
  const EXPIRY = '2027-01-31';
  // January 31, 23:59:59.999 in Asia/Manila.
  const JUST_BEFORE_END_OF_EXPIRY_DAY = Date.UTC(2027, 0, 31, 15, 59, 59, 999);
  // February 1, 00:00:00 in Asia/Manila.
  const AT_START_OF_FOLLOWING_DAY = Date.UTC(2027, 0, 31, 16, 0, 0, 0);

  it.each([
    ['just before the expiry boundary', JUST_BEFORE_END_OF_EXPIRY_DAY, true],
    ['at the expiry boundary', AT_START_OF_FOLLOWING_DAY, false],
    ['after the expiry boundary', AT_START_OF_FOLLOWING_DAY + 1, false],
  ] as const)('%s', (_label, now, expected) => {
    expect(isExpiryDateValid(EXPIRY, now)).toBe(expected);
  });

  it.each(['2027-02-29', '2027/01/31', 'not-a-date', '']) (
    'rejects the invalid date string %s',
    (expiry) => {
      expect(isExpiryDateValid(expiry, NOW)).toBe(false);
    },
  );
});
