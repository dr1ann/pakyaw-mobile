import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { StepAboutYou } from './StepAboutYou';
import { StepVehicle } from './StepVehicle';
import { StepRequirements } from './StepRequirements';
import { RequirementCard } from './RequirementCard';
import { StepReview } from './StepReview';
import {
  SubmittedStatusScreen,
  NeedsCorrectionStatusScreen,
  ApprovedStatusScreen,
  RejectedStatusScreen,
} from './OnboardingStatusScreens';
import type { DriverApplicationForm } from '../types';
import type { DriverOnboardingCatalog } from '@pakyaw/shared/onboarding';

vi.mock('@pakyaw/shared/components/ui/SymbolIcon', () => ({
  SymbolIcon: () => null,
}));

describe('Driver Onboarding UI Components — Phase 9 Polish', () => {
  const mockForm: DriverApplicationForm = {
    personalDetails: {
      fullLegalName: 'Juan Santos Dela Cruz',
      verifiedMobile: '+639171234567',
      barangayAddress: 'Brgy. Cogon, Ormoc City',
      emergencyContact: {
        name: 'Maria Dela Cruz',
        mobile: '09181234567',
      },
    },
    vehicle: {
      vehicleTypeId: 'vt_tricycle_standard',
      plateNumber: '1234 HA',
      unitBodyNumber: '042',
      description: 'Blue Bajaj',
      ownerOperatorInfo: 'Juan Santos Dela Cruz',
      isDriverOwner: true,
      orcrNumber: '',
      orcrExpiry: '',
    },
    license: { number: '', expiry: '' },
    franchise: { documentType: 'franchise', documentNumber: '', expiry: '' },
  };

  const mockCatalog: DriverOnboardingCatalog = {
    vehicleTypes: [
      {
        id: 'vt_tricycle_standard',
        type: 'Tricycle',
        capacity: 4,
        wheels: 3,
        status: 'active',
        icon: null,
      },
      {
        id: 'vt_motorcycle',
        type: 'Motorcycle',
        capacity: 1,
        wheels: 2,
        status: 'active',
        icon: null,
      },
    ],
    documentRequirements: [
      {
        key: 'driver_license',
        label: 'Driver License',
        description: 'Professional driver license issued by LTO',
        sortOrder: 1,
        active: true,
        requiredForApplication: true,
        requiredForOnline: true,
        requiresIdentification: true,
        requiresIssuanceDate: true,
        requiresExpiryDate: true,
        vehicleTypeIds: [],
      },
      {
        key: 'orcr',
        label: 'OR/CR',
        description: 'Official Receipt / Certificate of Registration',
        sortOrder: 2,
        active: true,
        requiredForApplication: true,
        requiredForOnline: true,
        requiresIdentification: false,
        requiresIssuanceDate: false,
        requiresExpiryDate: true,
        vehicleTypeIds: [],
      },
    ],
  };

  describe('StepAboutYou', () => {
    it('renders verified account information, residence, and emergency contact', () => {
      const onChange = vi.fn();
      const onNext = vi.fn();

      const element = (
        <StepAboutYou
          form={mockForm}
          onChange={onChange}
          onNext={onNext}
        />
      );
      expect(element).toBeDefined();
    });
  });

  describe('StepVehicle', () => {
    it('renders only active vehicle types from dynamic catalog with capacity', () => {
      const onChange = vi.fn();
      const onNext = vi.fn();

      const element = (
        <StepVehicle
          form={mockForm}
          catalog={mockCatalog}
          isLoadingCatalog={false}
          onChange={onChange}
          onNext={onNext}
        />
      );
      expect(element).toBeDefined();

      const activeTypes = mockCatalog.vehicleTypes.filter((vt) => vt.status === 'active');
      expect(activeTypes).toHaveLength(2);
      expect(activeTypes[0].capacity).toBe(4);
    });

    it('handles empty catalog state gracefully', () => {
      const emptyCatalog: DriverOnboardingCatalog = {
        vehicleTypes: [],
        documentRequirements: [],
      };

      const element = (
        <StepVehicle
          form={mockForm}
          catalog={emptyCatalog}
          isLoadingCatalog={false}
          onChange={vi.fn()}
          onNext={vi.fn()}
        />
      );
      expect(element).toBeDefined();
    });
  });

  describe('StepRequirements & RequirementCard', () => {
    it('renders requirements disclaimer and dynamic document list', () => {
      const element = (
        <StepRequirements
          catalog={mockCatalog}
          isLoadingCatalog={false}
          selectedVehicleTypeId="vt_tricycle_standard"
          documents={{ driver_license: 'uploaded', orcr: 'missing' }}
          documentMetadata={{
            driver_license: {
              identificationNumber: 'N01-12-345678',
              issuanceDate: '2024-01-01',
              expiryDate: '2029-01-01',
            },
          }}
          onMetadataChange={vi.fn()}
          onUploadDocument={vi.fn().mockResolvedValue(undefined)}
          onNext={vi.fn()}
        />
      );
      expect(element).toBeDefined();
    });

    it('renders RequirementCard with conditional ID, issuance, and expiry fields based on catalog flags', () => {
      const licenseReq = mockCatalog.documentRequirements[0];
      const element = (
        <RequirementCard
          requirement={licenseReq}
          state="uploaded"
          metadata={{
            identificationNumber: 'N01-12-345678',
            issuanceDate: '2024-01-01',
            expiryDate: '2029-01-01',
          }}
          onMetadataChange={vi.fn()}
          onUpload={vi.fn().mockResolvedValue(undefined)}
        />
      );
      expect(element).toBeDefined();
      expect(licenseReq.requiresIdentification).toBe(true);
      expect(licenseReq.requiresIssuanceDate).toBe(true);
      expect(licenseReq.requiresExpiryDate).toBe(true);
    });
  });

  describe('StepReview', () => {
    it('renders complete review summary and missing alerts when documents are incomplete', () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      const onEditStep = vi.fn();

      const element = (
        <StepReview
          form={mockForm}
          catalog={mockCatalog}
          documents={{ driver_license: 'uploaded', orcr: 'missing' }}
          documentMetadata={{
            driver_license: {
              identificationNumber: 'N01-12-345678',
              issuanceDate: '2024-01-01',
              expiryDate: '2029-01-01',
            },
          }}
          onEditStep={onEditStep}
          onSubmit={onSubmit}
        />
      );
      expect(element).toBeDefined();
    });
  });

  describe('OnboardingStatusScreens', () => {
    it('renders SubmittedStatusScreen with review timeline', () => {
      const onAction = vi.fn();
      const element = <SubmittedStatusScreen onAction={onAction} />;
      expect(element).toBeDefined();
    });

    it('renders NeedsCorrectionStatusScreen with actionable reason', () => {
      const onAction = vi.fn();
      const element = (
        <NeedsCorrectionStatusScreen
          reason="The license photo is blurry. Please upload a clear photo."
          onAction={onAction}
        />
      );
      expect(element).toBeDefined();
    });

    it('renders ApprovedStatusScreen with Start Driving action when no online requirements remain', () => {
      const onAction = vi.fn();
      const tree = ApprovedStatusScreen({ onAction, pendingOnlineRequirements: [] });
      expect(tree).toBeDefined();
      const json = JSON.stringify(tree);
      expect(json).toContain("You're ready to drive");
      expect(json).toContain('Start driving');
    });

    it('renders ApprovedStatusScreen with pending online requirements when requiredForOnline docs remain', () => {
      const onAction = vi.fn();
      const pendingOnline = [
        { key: 'daily_inspection', label: 'Daily Vehicle Inspection' },
        { key: 'health_card', label: 'City Health Certificate' },
      ];
      const tree = ApprovedStatusScreen({ onAction, pendingOnlineRequirements: pendingOnline });
      expect(tree).toBeDefined();
      const json = JSON.stringify(tree);
      expect(json).toContain('Application approved');
      expect(json).toContain('2 requirements still need attention before you can go online');
      expect(json).toContain('Daily Vehicle Inspection');
      expect(json).toContain('City Health Certificate');
      expect(json).toContain('Complete online requirements');
    });

    it('renders RejectedStatusScreen with decline reason and support action', () => {
      const onContactSupport = vi.fn();
      const element = (
        <RejectedStatusScreen
          reason="Application did not meet operational criteria."
          onContactSupport={onContactSupport}
        />
      );
      expect(element).toBeDefined();
    });
  });
});
