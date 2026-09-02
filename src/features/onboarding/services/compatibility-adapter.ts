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
  // Find any primary ID requirement metadata (drivers_license, valid_id, or first with identification)
  const licenseMeta =
    documentMetadata.drivers_license ||
    documentMetadata.valid_id ||
    Object.values(documentMetadata).find((m) => Boolean(m.identificationNumber?.trim() && m.expiryDate?.trim())) ||
    Object.values(documentMetadata).find((m) => Boolean(m.identificationNumber?.trim()));

  const defaultExpiry =
    licenseMeta?.expiryDate ||
    Object.values(documentMetadata).find((m) => Boolean(m.expiryDate?.trim()))?.expiryDate ||
    '2029-12-31';

  const defaultId =
    licenseMeta?.identificationNumber ||
    form.vehicle.plateNumber ||
    form.vehicle.unitBodyNumber ||
    'ID-NA';

  const nextLicense = {
    ...form.license,
    number:
      licenseMeta?.identificationNumber !== undefined && licenseMeta.identificationNumber !== ''
        ? licenseMeta.identificationNumber
        : form.license.number !== ''
        ? form.license.number
        : defaultId,
    expiry:
      licenseMeta?.expiryDate !== undefined && licenseMeta.expiryDate !== ''
        ? licenseMeta.expiryDate
        : form.license.expiry !== ''
        ? form.license.expiry
        : defaultExpiry,
  };

  const orcrMeta =
    documentMetadata.orcr ||
    documentMetadata.brgy_clearance ||
    documentMetadata['brgy clearance'] ||
    documentMetadata.barangay_clearance ||
    licenseMeta;

  const nextVehicle = {
    ...form.vehicle,
    orcrNumber:
      orcrMeta?.identificationNumber !== undefined && orcrMeta.identificationNumber !== ''
        ? orcrMeta.identificationNumber
        : form.vehicle.orcrNumber !== ''
        ? form.vehicle.orcrNumber
        : `ORCR-${form.vehicle.unitBodyNumber || form.vehicle.plateNumber || '000'}`,
    orcrExpiry:
      orcrMeta?.expiryDate !== undefined && orcrMeta.expiryDate !== ''
        ? orcrMeta.expiryDate
        : form.vehicle.orcrExpiry !== ''
        ? form.vehicle.orcrExpiry
        : defaultExpiry,
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

  const franchiseMeta =
    documentMetadata.franchise ||
    documentMetadata.brgy_clearance ||
    documentMetadata['brgy clearance'] ||
    documentMetadata.barangay_clearance ||
    licenseMeta;

  const nextFranchise = {
    ...form.franchise,
    documentNumber:
      franchiseMeta?.identificationNumber !== undefined && franchiseMeta.identificationNumber !== ''
        ? franchiseMeta.identificationNumber
        : form.franchise.documentNumber !== ''
        ? form.franchise.documentNumber
        : `FR-${form.vehicle.unitBodyNumber || form.vehicle.plateNumber || '000'}`,
    expiry:
      franchiseMeta?.expiryDate !== undefined && franchiseMeta.expiryDate !== ''
        ? franchiseMeta.expiryDate
        : form.franchise.expiry !== ''
        ? form.franchise.expiry
        : defaultExpiry,
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
