import { describe, expect, it } from 'vitest';
import {
  adaptDynamicRequirementsToLegacyForm,
  adaptLegacyFormToRequirementMetadata,
} from './compatibility-adapter';
import type { DriverApplicationForm } from '../types';

const baseForm: DriverApplicationForm = {
  personalDetails: {
    fullLegalName: 'Juan Dela Cruz',
    verifiedMobile: '+639171234567',
    barangayAddress: 'Cogon, Ormoc City',
    emergencyContact: { name: 'Maria Dela Cruz', mobile: '+639181234567' },
  },
  vehicle: {
    vehicleTypeId: 'tricycle',
    plateNumber: 'ABC-1234',
    unitBodyNumber: '017',
    description: '',
    ownerOperatorInfo: '',
    isDriverOwner: true,
    orcrNumber: '',
    orcrExpiry: '',
  },
  license: { number: '', expiry: '' },
  franchise: { documentType: '', documentNumber: '', expiry: '' },
};

describe('compatibility-adapter', () => {
  it('synchronizes dynamic documentMetadata into legacy fields without double input', () => {
    const dynamicMetadata = {
      drivers_license: {
        identificationNumber: 'N01-23-456789',
        expiryDate: '2028-09-24',
      },
      orcr: {
        identificationNumber: 'ORCR-998877',
        expiryDate: '2027-01-15',
      },
      franchise: {
        identificationNumber: 'FRAN-2025-01',
        expiryDate: '2026-12-31',
      },
    };

    const adapted = adaptDynamicRequirementsToLegacyForm(
      baseForm,
      dynamicMetadata,
      'Tricycle',
    );

    // Driver's License
    expect(adapted.license.number).toBe('N01-23-456789');
    expect(adapted.license.expiry).toBe('2028-09-24');

    // OR/CR
    expect(adapted.vehicle.orcrNumber).toBe('ORCR-998877');
    expect(adapted.vehicle.orcrExpiry).toBe('2027-01-15');

    // Franchise
    expect(adapted.franchise.documentNumber).toBe('FRAN-2025-01');
    expect(adapted.franchise.expiry).toBe('2026-12-31');
    expect(adapted.franchise.documentType).toBe('franchise');

    // Ownership & vehicle description
    expect(adapted.vehicle.ownerOperatorInfo).toBe('Juan Dela Cruz');
    expect(adapted.vehicle.description).toContain('Tricycle');
    expect(adapted.vehicle.description).toContain('017');
  });

  it('preserves non-owner operator name when isDriverOwner is false', () => {
    const nonOwnerForm: DriverApplicationForm = {
      ...baseForm,
      vehicle: {
        ...baseForm.vehicle,
        isDriverOwner: false,
        ownerOperatorInfo: 'Pedro Santos',
      },
    };

    const adapted = adaptDynamicRequirementsToLegacyForm(nonOwnerForm, {});
    expect(adapted.vehicle.ownerOperatorInfo).toBe('Pedro Santos');
  });

  it('adapts legacy draft fields back into requirement metadata on resume', () => {
    const legacyForm: DriverApplicationForm = {
      ...baseForm,
      license: { number: 'OLD-LIC-123', expiry: '2026-05-10' },
      vehicle: { ...baseForm.vehicle, orcrNumber: 'OLD-ORCR-456', orcrExpiry: '2025-11-20' },
    };

    const metadata = adaptLegacyFormToRequirementMetadata(legacyForm);
    expect(metadata.drivers_license?.identificationNumber).toBe('OLD-LIC-123');
    expect(metadata.drivers_license?.expiryDate).toBe('2026-05-10');
    expect(metadata.orcr?.identificationNumber).toBe('OLD-ORCR-456');
    expect(metadata.orcr?.expiryDate).toBe('2025-11-20');
  });
});
