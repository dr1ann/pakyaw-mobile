import type { Timestamp } from 'firebase/firestore';

/**
 * User role — routes the app into (passenger) or (driver).
 * Stored in users/{uid}.role.
 */
export type UserRole = 'passenger' | 'driver';

/**
 * Rider type — stored at sign-up, used for display only in MVP.
 * The 20% privilege discount is deferred pricing — no code in MVP
 * reads this for money. Searching for "riderType" should only show
 * usages inside auth and profile screens.
 */
export type RiderType = 'regular' | 'student' | 'pwd' | 'senior';

/**
 * User document shape — matches database_schema.md §2.
 * Keyed by Firebase Auth uid in users/{uid}.
 */
export interface UserDoc {
  uid: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  phone: string; // +63 E.164 format (NFR-2)
  phoneVerified: boolean; // set true after SMS OTP (FR-1.1.3)
  email: string | null; // passengers sign up with email; driver may be null
  riderType: RiderType; // FR-1.1.4 — STORED ONLY, not priced in MVP
  birthday?: string;
  gender?: string;
  address?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * The shape written to Firestore at sign-up (without server-set timestamps).
 */
export type UserDocInput = Omit<UserDoc, 'createdAt' | 'updatedAt'>;
