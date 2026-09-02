import type { ApplicationStatus, DocumentState, DriverApplication, DriverDocumentMetadata } from '@pakyaw/shared/onboarding';

export type DriverApplicationForm = Omit<DriverApplication, 'id' | 'uid' | 'status' | 'documents' | 'auditTrail' | 'submittedAt' | 'reviewedAt' | 'reviewedBy' | 'correctionReason' | 'rejectionReason'>;

export type DriverApplicationSnapshot = DriverApplication & {
  readonly correctionReason?: string;
  readonly correctionDocumentTypes?: readonly string[];
};

export type DriverApplicationDocumentMetadata = DriverDocumentMetadata;

export type DocumentUploadMetadata = {
  readonly state: DocumentState;
  readonly storagePath: string;
  readonly contentType: string;
  readonly sizeBytes: number;
} & DriverDocumentMetadata;

export type ApplicationUiState = Extract<ApplicationStatus, 'draft' | 'submitted' | 'needs_correction' | 'approved' | 'rejected' | 'suspended' | 'expired'>;
