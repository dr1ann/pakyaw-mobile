export {
  isExpiryDateValid,
  normalizePhilippineMobile,
  REQUIRED_DOCUMENT_TYPES,
  validateDriverApplication,
} from './driver-application-schema';
export type {
  RequiredDocumentType,
  SubmissionField,
  SubmissionIssue,
  SubmissionIssueCode,
} from './driver-application-schema';
export {
  EXPIRED_DRIVER_APPLICATION,
  INCOMPLETE_DRIVER_APPLICATION,
  INVALID_DRIVER_APPLICATION,
  VALID_DRIVER_APPLICATION,
} from './fixtures';
export {
  getSubmissionReadiness,
} from './submission-readiness';
export type { SubmissionReadiness } from './submission-readiness';
export type {
  ApplicationStatus,
  AuditEntry,
  DocumentState,
  DriverApplication,
} from './types';
