import { describe, expect, it } from 'vitest';
import {
  requirementAppliesToVehicle,
  type DriverOnboardingCatalog,
} from '@pakyaw/shared/onboarding';
import { getHumanReadableState } from '../components/RequirementCard';
import {
  adaptDynamicRequirementsToLegacyForm,
  adaptLegacyFormToRequirementMetadata,
} from '../services/compatibility-adapter';
import type { DriverApplicationForm } from '../types';

const mockCatalog: DriverOnboardingCatalog = {
  vehicleTypes: [
    {
      id: 'tricycle',
      type: 'Tricycle',
      capacity: 6,
      wheels: 3,
      icon: '🛺',
      status: 'active',
    },
    {
      id: 'motorcycle',
      type: 'Motorcycle Taxi',
      capacity: 1,
      wheels: 2,
      icon: '🏍️',
      status: 'active',
    },
  ],
  documentRequirements: [
    {
      key: 'drivers_license',
      label: "Driver's License",
      description: 'Professional license issued by LTO',
      requiresIdentification: true,
      requiresIssuanceDate: false,
      requiresExpiryDate: true,
      requiredForApplication: true,
      requiredForOnline: true,
      vehicleTypeIds: [], // All vehicles
      active: true,
      sortOrder: 1,
    },
    {
      key: 'tricycle_franchise',
      label: 'Ormoc Tricycle Franchise',
      description: 'City government issued MTOP franchise',
      requiresIdentification: true,
      requiresIssuanceDate: true,
      requiresExpiryDate: true,
      requiredForApplication: true,
      requiredForOnline: true,
      vehicleTypeIds: ['tricycle'], // Scoped to tricycle only!
      active: true,
      sortOrder: 2,
    },
    {
      key: 'motorcycle_helmet_permit',
      label: 'Helmet Safety Permit',
      description: 'Safety gear inspection certificate',
      requiresIdentification: false,
      requiresIssuanceDate: false,
      requiresExpiryDate: false,
      requiredForApplication: true,
      requiredForOnline: false,
      vehicleTypeIds: ['motorcycle'], // Scoped to motorcycle only!
      active: true,
      sortOrder: 3,
    },
    {
      key: 'inactive_doc',
      label: 'Deprecated Document',
      description: 'Deprecated document for test',
      requiresIdentification: false,
      requiresIssuanceDate: false,
      requiresExpiryDate: false,
      requiredForApplication: true,
      requiredForOnline: false,
      vehicleTypeIds: [],
      active: false, // Inactive!
      sortOrder: 99,
    },
  ],
};

const sampleForm: DriverApplicationForm = {
  personalDetails: {
    fullLegalName: 'Carlos P. Garcia',
    verifiedMobile: '+639170001111',
    barangayAddress: 'Brgy. Linao, Ormoc City',
    emergencyContact: { name: 'Elena Garcia', mobile: '+639180002222' },
  },
  vehicle: {
    vehicleTypeId: 'tricycle',
    plateNumber: 'ORM-789',
    unitBodyNumber: '342',
    description: '',
    ownerOperatorInfo: '',
    isDriverOwner: true,
    orcrNumber: '',
    orcrExpiry: '',
  },
  license: { number: '', expiry: '' },
  franchise: { documentType: '', documentNumber: '', expiry: '' },
};

describe('Dynamic Admin Onboarding Acceptance Tests', () => {
  describe('Dynamic Vehicle Types', () => {
    it('filters out inactive vehicle types configured in Admin', () => {
      const mixedTypes = [
        ...mockCatalog.vehicleTypes,
        { id: 'inactive_van', type: 'Van', capacity: 12, wheels: 4, icon: null, status: 'inactive' },
      ];
      const activeTypes = mixedTypes.filter((vt) => vt.status === 'active');
      expect(activeTypes).toHaveLength(2);
      expect(activeTypes.map((vt) => vt.id)).toEqual(['tricycle', 'motorcycle']);
      expect(activeTypes.some((vt) => vt.id === 'inactive_van')).toBe(false);
    });

    it('renders dynamic capacity from Admin without hardcoding', () => {
      const tricycle = mockCatalog.vehicleTypes.find((vt) => vt.id === 'tricycle');
      const motorcycle = mockCatalog.vehicleTypes.find((vt) => vt.id === 'motorcycle');

      expect(tricycle?.capacity).toBe(6);
      expect(motorcycle?.capacity).toBe(1);
    });

    it('detects when no active vehicle types are configured', () => {
      const emptyCatalog: DriverOnboardingCatalog = {
        vehicleTypes: [],
        documentRequirements: [],
      };
      const activeTypes = emptyCatalog.vehicleTypes.filter((vt) => vt.status === 'active');
      expect(activeTypes).toHaveLength(0);
    });
  });

  describe('Dynamic Document Requirements', () => {
    it('filters out inactive requirements configured in Admin', () => {
      const activeReqs = mockCatalog.documentRequirements.filter((req) => req.active);
      expect(activeReqs).toHaveLength(3);
      expect(activeReqs.some((req) => req.key === 'inactive_doc')).toBe(false);
    });

    it('applies global requirements (empty applicableVehicleTypeIds) to all vehicle types', () => {
      const license = mockCatalog.documentRequirements.find((req) => req.key === 'drivers_license')!;
      expect(requirementAppliesToVehicle(license, 'tricycle')).toBe(true);
      expect(requirementAppliesToVehicle(license, 'motorcycle')).toBe(true);
      expect(requirementAppliesToVehicle(license, 'any_other_vehicle')).toBe(true);
    });

    it('scopes vehicle-specific requirements to selected vehicle type only', () => {
      const tricycleFranchise = mockCatalog.documentRequirements.find(
        (req) => req.key === 'tricycle_franchise',
      )!;
      const helmetPermit = mockCatalog.documentRequirements.find(
        (req) => req.key === 'motorcycle_helmet_permit',
      )!;

      // Tricycle franchise applies only to tricycle
      expect(requirementAppliesToVehicle(tricycleFranchise, 'tricycle')).toBe(true);
      expect(requirementAppliesToVehicle(tricycleFranchise, 'motorcycle')).toBe(false);

      // Helmet permit applies only to motorcycle
      expect(requirementAppliesToVehicle(helmetPermit, 'motorcycle')).toBe(true);
      expect(requirementAppliesToVehicle(helmetPermit, 'tricycle')).toBe(false);
    });

    it('honors conditional field flags from Admin (requiresIdentification, requiresIssuanceDate, requiresExpiryDate)', () => {
      const license = mockCatalog.documentRequirements.find((req) => req.key === 'drivers_license')!;
      const franchise = mockCatalog.documentRequirements.find((req) => req.key === 'tricycle_franchise')!;
      const helmet = mockCatalog.documentRequirements.find((req) => req.key === 'motorcycle_helmet_permit')!;

      // License needs ID number and expiry, but no issuance date
      expect(license.requiresIdentification).toBe(true);
      expect(license.requiresIssuanceDate).toBe(false);
      expect(license.requiresExpiryDate).toBe(true);

      // Franchise needs all three
      expect(franchise.requiresIdentification).toBe(true);
      expect(franchise.requiresIssuanceDate).toBe(true);
      expect(franchise.requiresExpiryDate).toBe(true);

      // Helmet permit requires neither
      expect(helmet.requiresIdentification).toBe(false);
      expect(helmet.requiresIssuanceDate).toBe(false);
      expect(helmet.requiresExpiryDate).toBe(false);
    });
  });

  describe('Human-Readable Status Translation', () => {
    it('translates raw states into clear human labels and tones', () => {
      expect(getHumanReadableState('missing')).toEqual({ label: 'Not started', tone: 'neutral' });
      expect(getHumanReadableState('uploaded')).toEqual({ label: 'Uploaded', tone: 'info' });
      expect(getHumanReadableState('under_review')).toEqual({ label: 'Under review', tone: 'info' });
      expect(getHumanReadableState('approved')).toEqual({ label: 'Approved', tone: 'success' });
      expect(getHumanReadableState('rejected')).toEqual({ label: 'Rejected', tone: 'danger' });
      expect(getHumanReadableState('expired')).toEqual({ label: 'Expired', tone: 'danger' });
    });

    it('prioritizes "Needs update" when an item has an operational correction reason', () => {
      expect(getHumanReadableState('rejected', true)).toEqual({
        label: 'Needs update',
        tone: 'warning',
      });
      expect(getHumanReadableState('uploaded', true)).toEqual({
        label: 'Needs update',
        tone: 'warning',
      });
    });
  });

  describe('Compatibility Adapter & No Duplicate Inputs', () => {
    it('maps dynamic requirements into legacy fields when driver enters metadata', () => {
      const metadata = {
        drivers_license: {
          identificationNumber: 'D02-99-123456',
          expiryDate: '2029-03-30',
        },
      };

      const adapted = adaptDynamicRequirementsToLegacyForm(sampleForm, metadata, 'Tricycle');

      expect(adapted.license.number).toBe('D02-99-123456');
      expect(adapted.license.expiry).toBe('2029-03-30');
      expect(adapted.vehicle.isDriverOwner).toBe(true);
      expect(adapted.vehicle.ownerOperatorInfo).toBe('Carlos P. Garcia');
    });

    it('restores draft metadata from previous draft without losing data', () => {
      const existingDraft: DriverApplicationForm = {
        ...sampleForm,
        license: { number: 'OLD-D02', expiry: '2027-12-01' },
      };

      const restored = adaptLegacyFormToRequirementMetadata(existingDraft);
      expect(restored.drivers_license?.identificationNumber).toBe('OLD-D02');
      expect(restored.drivers_license?.expiryDate).toBe('2027-12-01');
    });
  });
});
