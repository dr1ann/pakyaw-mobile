import {
  validateDriverApplication,
  type SubmissionIssue,
} from './driver-application-schema';
import type { DriverApplication } from './types';

export type SubmissionReadiness = {
  readonly ready: boolean;
  readonly issues: readonly SubmissionIssue[];
};

/**
 * Reports whether an application contains all submit-ready data. It is a pure
 * read: approval, submitted-state changes, server timestamps, and audit writes
 * remain server-authoritative Day 2+ operations.
 */
export function getSubmissionReadiness(
  application: DriverApplication,
  now: number,
): SubmissionReadiness {
  const issues = validateDriverApplication(application, now);
  return { ready: issues.length === 0, issues };
}
