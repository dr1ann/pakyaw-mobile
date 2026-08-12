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
  readonly personalDetails: {
    readonly fullLegalName: string;
    readonly verifiedMobile: string;
    readonly barangayAddress: string;
    readonly emergencyContact: {
      readonly name: string;
      readonly mobile: string;
    };
  };
  readonly vehicle: {
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
  readonly submittedAt?: number;
  readonly reviewedAt?: number;
  readonly reviewedBy?: string;
  readonly correctionReason?: string;
  readonly rejectionReason?: string;
  readonly auditTrail: readonly AuditEntry[];
};
