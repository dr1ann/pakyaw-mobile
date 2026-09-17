import type { UserDoc } from '@pakyaw/shared/features/auth/types';

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isTimestamp(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const seconds = typeof value.seconds === 'number' ? value.seconds : null;
  const nanoseconds = typeof value.nanoseconds === 'number' ? value.nanoseconds : null;
  return seconds !== null
    && nanoseconds !== null
    && Number.isInteger(seconds)
    && Number.isInteger(nanoseconds)
    && nanoseconds >= 0
    && nanoseconds < 1_000_000_000;
}

/** Validate an Auth-owned users/{uid} document before session state changes. */
export function parseUserDoc(uid: string, value: unknown): UserDoc | null {
  if (!isRecord(value)
    || value.uid !== uid
    || !nonEmptyString(value.name)
    || !nonEmptyString(value.mobile)
    || (value.role !== 'driver' && value.role !== 'passenger')
    || (value.accountStatus !== 'active'
      && value.accountStatus !== 'suspended'
      && value.accountStatus !== 'blocked')
    || !isTimestamp(value.createdAt)
    || !isTimestamp(value.updatedAt)) {
    return null;
  }
  return value as unknown as UserDoc;
}
