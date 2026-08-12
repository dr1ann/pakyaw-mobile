import type { DriverApplication } from './types';

/** Deterministic, fictional fixtures for tests and later UI stories. */
export const VALID_DRIVER_APPLICATION: DriverApplication = {
  id: 'driver-application-example',
  uid: 'driver-example-uid',
  status: 'draft',
  personalDetails: {
    fullLegalName: 'Sample Driver',
    verifiedMobile: '09170000000',
    barangayAddress: 'Barangay Sample, Example City',
    emergencyContact: {
      name: 'Sample Contact',
      mobile: '+639180000000',
    },
  },
  vehicle: {
    plateNumber: 'ABC 1234',
    unitBodyNumber: 'UNIT-EXAMPLE-01',
    description: 'Example tricycle',
    ownerOperatorInfo: 'Sample Driver',
    isDriverOwner: true,
    orcrNumber: 'ORCR-EXAMPLE-01',
    orcrExpiry: '2030-12-31',
  },
  license: {
    number: 'LIC-EXAMPLE-01',
    expiry: '2030-12-31',
  },
  franchise: {
    documentType: 'Tricycle franchise',
    documentNumber: 'FR-EXAMPLE-01',
    expiry: '2030-12-31',
  },
  documents: {
    drivers_license: 'uploaded',
    orcr: 'uploaded',
    franchise: 'uploaded',
  },
  auditTrail: [],
};

export const INCOMPLETE_DRIVER_APPLICATION: DriverApplication = {
  ...VALID_DRIVER_APPLICATION,
  personalDetails: {
    ...VALID_DRIVER_APPLICATION.personalDetails,
    fullLegalName: '',
  },
  vehicle: {
    ...VALID_DRIVER_APPLICATION.vehicle,
    plateNumber: '',
  },
  documents: {
    ...VALID_DRIVER_APPLICATION.documents,
    drivers_license: 'missing',
  },
};

export const INVALID_DRIVER_APPLICATION: DriverApplication = {
  ...VALID_DRIVER_APPLICATION,
  personalDetails: {
    ...VALID_DRIVER_APPLICATION.personalDetails,
    verifiedMobile: 'not-a-mobile-number',
  },
  vehicle: {
    ...VALID_DRIVER_APPLICATION.vehicle,
    orcrExpiry: '2030-02-30',
  },
  documents: {
    ...VALID_DRIVER_APPLICATION.documents,
    franchise: 'rejected',
  },
};

export const EXPIRED_DRIVER_APPLICATION: DriverApplication = {
  ...VALID_DRIVER_APPLICATION,
  vehicle: {
    ...VALID_DRIVER_APPLICATION.vehicle,
    orcrExpiry: '2020-01-01',
  },
  license: {
    ...VALID_DRIVER_APPLICATION.license,
    expiry: '2020-01-01',
  },
  franchise: {
    ...VALID_DRIVER_APPLICATION.franchise,
    expiry: '2020-01-01',
  },
  documents: {
    ...VALID_DRIVER_APPLICATION.documents,
    drivers_license: 'expired',
  },
};
