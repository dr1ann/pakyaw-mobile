import type { DriverDocumentMetadata } from '@pakyaw/shared/onboarding';
import type { DriverApplicationForm } from '../types';

/**
 * Synchronizes dynamic requirement data (owned by RequirementCard) into legacy
 * compatibility fields (license, vehicle.orcr, franchise, ownerOperatorInfo).
 *
 * This ensures backend validation and legacy consumers receive all required data
 * without forcing the Driver to type the same information twice.
 */
export function adaptDynamicRequirementsToLegacyForm(
  form: DriverApplicationForm,
  documentMetadata: Readonly<Record<string, DriverDocumentMetadata>>,
  selectedVehicleTypeName?: string,
): DriverApplicationForm {
  const licenseMeta = documentMetadata.drivers_license;
  const orcrMeta = documentMetadata.orcr;
  const franchiseMeta = documentMetadata.franchise;

  const nextLicense = {
    ...form.license,
    number: licenseMeta?.identificationNumber !== undefined ? licenseMeta.identificationNumber : form.license.number,
    expiry: licenseMeta?.expiryDate !== undefined ? licenseMeta.expiryDate : form.license.expiry,
  };

  const nextVehicle = {
    ...form.vehicle,
    orcrNumber: orcrMeta?.identificationNumber !== undefined ? orcrMeta.identificationNumber : form.vehicle.orcrNumber,
    orcrExpiry: orcrMeta?.expiryDate !== undefined ? orcrMeta.expiryDate : form.vehicle.orcrExpiry,
    description:
      selectedVehicleTypeName && (!form.vehicle.description || form.vehicle.description === '')
        ? `${selectedVehicleTypeName} - Body #${form.vehicle.unitBodyNumber || 'N/A'}`
        : !form.vehicle.description && form.vehicle.vehicleTypeId
        ? form.vehicle.vehicleTypeId
        : form.vehicle.description,
    ownerOperatorInfo: form.vehicle.isDriverOwner
      ? form.personalDetails.fullLegalName
      : form.vehicle.ownerOperatorInfo,
  };

  const nextFranchise = {
    ...form.franchise,
    documentNumber: franchiseMeta?.identificationNumber !== undefined ? franchiseMeta.identificationNumber : form.franchise.documentNumber,
    expiry: franchiseMeta?.expiryDate !== undefined ? franchiseMeta.expiryDate : form.franchise.expiry,
    documentType: form.franchise.documentType || 'franchise',
  };

  return {
    ...form,
    license: nextLicense,
    vehicle: nextVehicle,
    franchise: nextFranchise,
  };
}

/**
 * Seeds initial metadata from legacy application fields if resuming a draft
 * that was created under the previous schema.
 */
export function adaptLegacyFormToRequirementMetadata(
  form: DriverApplicationForm,
  existingMetadata: Readonly<Record<string, DriverDocumentMetadata>> = {},
): Record<string, DriverDocumentMetadata> {
  const metadata: Record<string, DriverDocumentMetadata> = { ...existingMetadata };

  if (form.license.number || form.license.expiry) {
    metadata.drivers_license = {
      identificationNumber: metadata.drivers_license?.identificationNumber || form.license.number,
      expiryDate: metadata.drivers_license?.expiryDate || form.license.expiry,
      issuanceDate: metadata.drivers_license?.issuanceDate,
    };
  }

  if (form.vehicle.orcrNumber || form.vehicle.orcrExpiry) {
    metadata.orcr = {
      identificationNumber: metadata.orcr?.identificationNumber || form.vehicle.orcrNumber,
      expiryDate: metadata.orcr?.expiryDate || form.vehicle.orcrExpiry,
      issuanceDate: metadata.orcr?.issuanceDate,
    };
  }

  if (form.franchise.documentNumber || form.franchise.expiry) {
    metadata.franchise = {
      identificationNumber: metadata.franchise?.identificationNumber || form.franchise.documentNumber,
      expiryDate: metadata.franchise?.expiryDate || form.franchise.expiry,
      issuanceDate: metadata.franchise?.issuanceDate,
    };
  }

  return metadata;
}
