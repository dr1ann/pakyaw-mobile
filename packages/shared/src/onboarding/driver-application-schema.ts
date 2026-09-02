import type { OnboardingDocumentRequirement } from './catalog';
import type { DocumentState, DriverApplication } from './types';

/** Required document keys shared with the matching eligibility snapshot. */
export const REQUIRED_DOCUMENT_TYPES = [
  'drivers_license',
  'orcr',
  'franchise',
] as const;

export type RequiredDocumentType = (typeof REQUIRED_DOCUMENT_TYPES)[number];

export type SubmissionIssueCode =
  | 'application_status_not_submittable'
  | 'full_legal_name_required'
  | 'verified_mobile_required'
  | 'verified_mobile_invalid'
  | 'barangay_address_required'
  | 'emergency_contact_name_required'
  | 'emergency_contact_mobile_required'
  | 'emergency_contact_mobile_invalid'
  | 'plate_number_required'
  | 'unit_body_number_required'
  | 'vehicle_description_required'
  | 'vehicle_type_required'
  | 'owner_operator_info_required'
  | 'driver_owner_flag_invalid'
  | 'orcr_number_required'
  | 'orcr_expiry_required'
  | 'orcr_expiry_invalid'
  | 'orcr_expiry_expired'
  | 'license_number_required'
  | 'license_expiry_required'
  | 'license_expiry_invalid'
  | 'license_expiry_expired'
  | 'franchise_type_required'
  | 'franchise_number_required'
  | 'franchise_expiry_required'
  | 'franchise_expiry_invalid'
  | 'franchise_expiry_expired'
  | 'document_missing'
  | 'document_under_review'
  | 'document_rejected'
  | 'document_expired'
  | 'document_invalid_state'
  | 'document_identification_required'
  | 'document_issuance_date_required'
  | 'document_issuance_date_invalid'
  | 'document_expiry_date_required'
  | 'document_expiry_date_invalid'
  | 'document_expiry_date_expired';

export type SubmissionField =
  | 'status'
  | 'personalDetails.fullLegalName'
  | 'personalDetails.verifiedMobile'
  | 'personalDetails.barangayAddress'
  | 'personalDetails.emergencyContact.name'
  | 'personalDetails.emergencyContact.mobile'
  | 'vehicle.plateNumber'
  | 'vehicle.vehicleTypeId'
  | 'vehicle.unitBodyNumber'
  | 'vehicle.description'
  | 'vehicle.ownerOperatorInfo'
  | 'vehicle.isDriverOwner'
  | 'vehicle.orcrNumber'
  | 'vehicle.orcrExpiry'
  | 'license.number'
  | 'license.expiry'
  | 'franchise.documentType'
  | 'franchise.documentNumber'
  | 'franchise.expiry'
  | `documents.${RequiredDocumentType}`
  | `documents.${string}`;

export type SubmissionIssue = {
  readonly field: SubmissionField;
  readonly code: SubmissionIssueCode;
};

type DateParts = {
  readonly year: number;
  readonly month: number;
  readonly day: number;
};

const PHILIPPINE_UTC_OFFSET_MS = 8 * 60 * 60 * 1_000;
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function parseDateOnly(value: string): DateParts | null {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (match === null) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (year < 1_000 || year > 9_999 || month < 1 || month > 12 || day < 1) {
    return null;
  }

  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);

  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? { year, month, day }
    : null;
}

/**
 * Converts an accepted Philippine mobile representation to E.164. Local
 * 09xxxxxxxxx, national 9xxxxxxxxx, and +639xxxxxxxxx forms are accepted.
 */
export function normalizePhilippineMobile(value: string): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const compact = value.trim().replace(/[\s()-]/g, '');
  let nationalNumber: string;

  if (compact.startsWith('+63')) {
    nationalNumber = compact.slice(3);
  } else if (compact.startsWith('0')) {
    nationalNumber = compact.slice(1);
  } else {
    nationalNumber = compact;
  }

  return /^9\d{9}$/.test(nationalNumber) ? `+63${nationalNumber}` : null;
}

/**
 * Returns true when the document is still valid for the stated Philippine
 * calendar day. An expiry of 2027-01-31 stops being valid at 2027-02-01
 * 00:00 Asia/Manila; `now` is always injected by the caller.
 */
export function isExpiryDateValid(expiry: string, now: number): boolean {
  const parts = parseDateOnly(expiry);
  if (parts === null || !Number.isFinite(now)) {
    return false;
  }

  const nextPhilippineMidnight =
    Date.UTC(parts.year, parts.month - 1, parts.day + 1) -
    PHILIPPINE_UTC_OFFSET_MS;

  return now < nextPhilippineMidnight;
}

function isSubmittableStatus(status: unknown): boolean {
  return status === 'draft' || status === 'needs_correction';
}

function documentIssueCode(state: DocumentState | undefined): SubmissionIssueCode | null {
  switch (state) {
    case 'uploaded':
    case 'approved':
      return null;
    case 'missing':
    case undefined:
      return 'document_missing';
    case 'under_review':
      return 'document_under_review';
    case 'rejected':
      return 'document_rejected';
    case 'expired':
      return 'document_expired';
    default:
      return 'document_invalid_state';
  }
}

function addDocumentMetadataIssues(
  issues: SubmissionIssue[],
  documentType: string,
  requirement: OnboardingDocumentRequirement,
  application: DriverApplication,
  state: DocumentState | undefined,
  now: number,
): void {
  if (state !== 'uploaded' && state !== 'approved') return;
  const metadata = application.documentMetadata?.[documentType] ?? {};
  const field = `documents.${documentType}` as SubmissionField;
  if (requirement.requiresIdentification && !hasText(metadata.identificationNumber)) {
    issues.push({ field, code: 'document_identification_required' });
  }
  if (requirement.requiresIssuanceDate) {
    if (!hasText(metadata.issuanceDate)) issues.push({ field, code: 'document_issuance_date_required' });
    else if (parseDateOnly(metadata.issuanceDate) === null) issues.push({ field, code: 'document_issuance_date_invalid' });
  }
  if (requirement.requiresExpiryDate) {
    if (!hasText(metadata.expiryDate)) issues.push({ field, code: 'document_expiry_date_required' });
    else if (parseDateOnly(metadata.expiryDate) === null) issues.push({ field, code: 'document_expiry_date_invalid' });
    else if (!isExpiryDateValid(metadata.expiryDate, now)) issues.push({ field, code: 'document_expiry_date_expired' });
  }
}

function addRequiredTextIssue(
  issues: SubmissionIssue[],
  field: SubmissionField,
  code: SubmissionIssueCode,
  value: unknown,
): void {
  if (!hasText(value)) {
    issues.push({ field, code });
  }
}

function addMobileIssue(
  issues: SubmissionIssue[],
  field: SubmissionField,
  requiredCode: SubmissionIssueCode,
  invalidCode: SubmissionIssueCode,
  value: unknown,
): void {
  if (!hasText(value)) {
    issues.push({ field, code: requiredCode });
  } else if (normalizePhilippineMobile(value) === null) {
    issues.push({ field, code: invalidCode });
  }
}

function addExpiryIssues(
  issues: SubmissionIssue[],
  field: SubmissionField,
  value: unknown,
  now: number,
  requiredCode: SubmissionIssueCode,
  invalidCode: SubmissionIssueCode,
  expiredCode: SubmissionIssueCode,
): void {
  if (!hasText(value)) {
    issues.push({ field, code: requiredCode });
    return;
  }

  if (parseDateOnly(value) === null) {
    issues.push({ field, code: invalidCode });
  } else if (!isExpiryDateValid(value, now)) {
    issues.push({ field, code: expiredCode });
  }
}

/**
 * Performs deterministic, field-level validation for a driver application.
 * It does not alter the application status or create approvals/audit entries.
 */
export function validateDriverApplication(
  application: DriverApplication,
  now: number,
  requirements?: readonly OnboardingDocumentRequirement[],
): readonly SubmissionIssue[] {
  const issues: SubmissionIssue[] = [];

  if (!isSubmittableStatus(application.status)) {
    issues.push({ field: 'status', code: 'application_status_not_submittable' });
  }

  addRequiredTextIssue(
    issues,
    'personalDetails.fullLegalName',
    'full_legal_name_required',
    application.personalDetails.fullLegalName,
  );
  addMobileIssue(
    issues,
    'personalDetails.verifiedMobile',
    'verified_mobile_required',
    'verified_mobile_invalid',
    application.personalDetails.verifiedMobile,
  );
  addRequiredTextIssue(
    issues,
    'personalDetails.barangayAddress',
    'barangay_address_required',
    application.personalDetails.barangayAddress,
  );
  addRequiredTextIssue(
    issues,
    'personalDetails.emergencyContact.name',
    'emergency_contact_name_required',
    application.personalDetails.emergencyContact.name,
  );
  addMobileIssue(
    issues,
    'personalDetails.emergencyContact.mobile',
    'emergency_contact_mobile_required',
    'emergency_contact_mobile_invalid',
    application.personalDetails.emergencyContact.mobile,
  );

  addRequiredTextIssue(
    issues,
    'vehicle.plateNumber',
    'plate_number_required',
    application.vehicle.plateNumber,
  );
  addRequiredTextIssue(
    issues,
    'vehicle.unitBodyNumber',
    'unit_body_number_required',
    application.vehicle.unitBodyNumber,
  );
  addRequiredTextIssue(
    issues,
    'vehicle.description',
    'vehicle_description_required',
    application.vehicle.description,
  );
  if (requirements !== undefined) {
    addRequiredTextIssue(
      issues,
      'vehicle.vehicleTypeId',
      'vehicle_type_required',
      application.vehicle.vehicleTypeId,
    );
  }
  // The unified contract makes owner/operator information required regardless
  // of ownership. The flag states whether it names the driver or a third party.
  addRequiredTextIssue(
    issues,
    'vehicle.ownerOperatorInfo',
    'owner_operator_info_required',
    application.vehicle.ownerOperatorInfo,
  );
  if (typeof application.vehicle.isDriverOwner !== 'boolean') {
    issues.push({ field: 'vehicle.isDriverOwner', code: 'driver_owner_flag_invalid' });
  }
  addRequiredTextIssue(
    issues,
    'vehicle.orcrNumber',
    'orcr_number_required',
    application.vehicle.orcrNumber,
  );
  addExpiryIssues(
    issues,
    'vehicle.orcrExpiry',
    application.vehicle.orcrExpiry,
    now,
    'orcr_expiry_required',
    'orcr_expiry_invalid',
    'orcr_expiry_expired',
  );

  addRequiredTextIssue(
    issues,
    'license.number',
    'license_number_required',
    application.license.number,
  );
  addExpiryIssues(
    issues,
    'license.expiry',
    application.license.expiry,
    now,
    'license_expiry_required',
    'license_expiry_invalid',
    'license_expiry_expired',
  );

  addRequiredTextIssue(
    issues,
    'franchise.documentType',
    'franchise_type_required',
    application.franchise.documentType,
  );
  addRequiredTextIssue(
    issues,
    'franchise.documentNumber',
    'franchise_number_required',
    application.franchise.documentNumber,
  );
  addExpiryIssues(
    issues,
    'franchise.expiry',
    application.franchise.expiry,
    now,
    'franchise_expiry_required',
    'franchise_expiry_invalid',
    'franchise_expiry_expired',
  );

  const requiredDocumentTypes = requirements === undefined
    ? REQUIRED_DOCUMENT_TYPES
    : requirements.filter((requirement) => requirement.requiredForApplication).map((requirement) => requirement.key);
  for (const documentType of requiredDocumentTypes) {
    const code = documentIssueCode(application.documents[documentType]);
    if (code !== null) {
      issues.push({ field: `documents.${documentType}`, code });
    }
    const requirement = requirements?.find((candidate) => candidate.key === documentType);
    if (requirement) addDocumentMetadataIssues(issues, documentType, requirement, application, application.documents[documentType], now);
  }

  return issues;
}
