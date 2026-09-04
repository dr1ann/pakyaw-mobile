export type Timestamp = {
  readonly seconds: number;
  readonly nanoseconds: number;
  toDate?: () => Date;
  toMillis?: () => number;
};

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
 * Account status — controls booking and driver eligibility.
 */
export type AccountStatus = 'active' | 'suspended' | 'blocked';

/**
 * Canonical User document shape — matches Firestore security rules and schema §2.
 * Keyed by Firebase Auth UID in users/{uid}.
 */
export interface UserDoc {
  /** Firebase Auth UID (document ID == uid) */
  uid: string;
  /** Full passenger name (minimum 2 characters, composed from firstName + lastName) */
  name: string;
  /** First name (minimum 2 characters) */
  firstName?: string;
  /** Last name (minimum 2 characters) */
  lastName?: string;
  /** Philippine E.164 mobile number verified via Firebase Phone Auth */
  mobile: string;
  /** Role discriminator */
  role: UserRole;
  /** Account lifecycle status */
  accountStatus: AccountStatus;
  /** Server timestamp when Terms of Service were accepted */
  termsAcceptedAt?: Timestamp;
  /** Server timestamp when Privacy Policy was accepted */
  privacyAcceptedAt?: Timestamp;
  /** Server timestamp when the user profile was created */
  createdAt: Timestamp;
  /** Server timestamp when the user profile was last modified */
  updatedAt: Timestamp;
}

/**
 * The shape written to Firestore at sign-up (without server-set timestamps).
 */
export type UserDocInput = Omit<UserDoc, 'createdAt' | 'updatedAt' | 'termsAcceptedAt' | 'privacyAcceptedAt'> & {
  termsAcceptedAt?: Timestamp;
  privacyAcceptedAt?: Timestamp;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

/**
 * Input-only compatibility shape for the retired email/multi-step flow. It
 * must never be persisted as fields on users/{uid}; new registration uses the
 * verified-phone service exclusively.
 */
export type LegacyUserDocInput = {
  readonly firstName?: string;
  readonly lastName?: string;
  readonly phone?: string;
  readonly phoneVerified?: boolean;
  readonly email?: string | null;
  readonly riderType?: RiderType;
  readonly birthday?: string;
  readonly gender?: string;
  readonly address?: string;
};
