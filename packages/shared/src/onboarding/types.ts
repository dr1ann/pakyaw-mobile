/**
 * Contract-aligned onboarding and driver-review domain types.
 *
 * These types deliberately have no Firebase, React, Expo, UI, or Storage
 * imports. Privileged review metadata is represented only to the minimum
 * shape established by the unified contract; a backend audit event belongs to
 * the later server-authoritative workflow.
 */

export type ApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'needs_correction'
  | 'approved'
  | 'rejected'
  | 'suspended'
  | 'expired';

export type DocumentState =
  | 'missing'
  | 'uploaded'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'expired';

export type DriverDocumentMetadata = {
  readonly identificationNumber?: string;
  readonly issuanceDate?: string;
  readonly expiryDate?: string;
};

export type StructuredLegalName = {
  readonly firstName?: string;
  readonly middleName?: string;
  readonly lastName?: string;
  readonly suffix?: string;
};

export function composeStructuredLegalName(input?: {
  readonly firstName?: string | null;
  readonly middleName?: string | null;
  readonly lastName?: string | null;
  readonly suffix?: string | null;
  readonly fullLegalName?: string | null;
  readonly name?: string | null;
} | null): string {
  if (!input) return '';
  const firstName = typeof input.firstName === 'string' ? input.firstName.trim() : '';
  const lastName = typeof input.lastName === 'string' ? input.lastName.trim() : '';
  if (firstName && lastName) {
    const middle = typeof input.middleName === 'string' ? input.middleName.trim() : '';
    const suffix = typeof input.suffix === 'string' ? input.suffix.trim() : '';
    return [firstName, middle, lastName, suffix].filter(Boolean).join(' ');
  }
  const fallback = typeof input.fullLegalName === 'string'
    ? input.fullLegalName
    : typeof input.name === 'string'
    ? input.name
    : '';
  return fallback.trim();
}

/**
 * `timestamp` and `action` are the only audit properties established for this
 * application-level foundation. Server-side review work may attach the full
 * admin-audit context later; this module must not fabricate it.
 */
export type AuditEntry = {
  readonly timestamp: number;
  readonly action: string;
};

export type DriverApplication = {
  readonly id: string;
  readonly uid: string;
  readonly status: ApplicationStatus;
  readonly personal?: {
    readonly firstName?: string;
    readonly middleName?: string;
    readonly lastName?: string;
    readonly suffix?: string;
  };
  readonly personalDetails: {
    readonly fullLegalName: string;
    readonly firstName?: string;
    readonly middleName?: string;
    readonly lastName?: string;
    readonly suffix?: string;
    readonly verifiedMobile: string;
    readonly barangayAddress: string;
    readonly emergencyContact: {
      readonly name: string;
      readonly mobile: string;
    };
  };
  readonly vehicle: {
    /** VehicleType document ID; absent only on historical applications. */
    readonly vehicleTypeId?: string;
    readonly plateNumber: string;
    readonly unitBodyNumber: string;
    readonly description: string;
    readonly ownerOperatorInfo: string;
    readonly isDriverOwner: boolean;
    readonly orcrNumber: string;
    /** ISO calendar date in YYYY-MM-DD form. */
    readonly orcrExpiry: string;
  };
  readonly license: {
    readonly number: string;
    /** ISO calendar date in YYYY-MM-DD form. */
    readonly expiry: string;
  };
  readonly franchise: {
    readonly documentType: string;
    readonly documentNumber: string;
    /** ISO calendar date in YYYY-MM-DD form. */
    readonly expiry: string;
  };
  readonly documents: Readonly<Record<string, DocumentState>>;
  /** Metadata for the private driverDocuments records, when available. */
  readonly documentMetadata?: Readonly<Record<string, DriverDocumentMetadata>>;
  readonly submittedAt?: number;
  readonly reviewedAt?: number;
  readonly reviewedBy?: string;
  readonly correctionReason?: string;
  readonly rejectionReason?: string;
  readonly auditTrail: readonly AuditEntry[];
};
