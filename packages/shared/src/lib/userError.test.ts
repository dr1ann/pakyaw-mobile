import { describe, expect, it } from 'vitest';
import { formatUserFriendlyError } from './userError';

describe('formatUserFriendlyError — Failure UX mapping', () => {
  it('formats network / offline errors into clear connection advice', () => {
    const err = new Error('network-request-failed (firebase/unavailable)');
    const formatted = formatUserFriendlyError(err);
    expect(formatted).toBe('Connection issue detected. Please check your internet connection and try again.');
  });

  it('formats session expiry errors clearly', () => {
    const err = new Error('permission-denied: unauthenticated');
    const formatted = formatUserFriendlyError(err);
    expect(formatted).toBe('Your session has expired. Please sign in again to continue.');
  });

  it('formats already taken / closed offers cleanly', () => {
    const formatted = formatUserFriendlyError('offer_already_taken');
    expect(formatted).toBe('This ride offer was already accepted by another driver.');
  });

  it('formats expired requests cleanly', () => {
    const formatted = formatUserFriendlyError('request_expired');
    expect(formatted).toBe('This request has expired and is no longer available.');
  });

  it('uses default fallback for unknown raw exceptions', () => {
    const formatted = formatUserFriendlyError(null, 'Action failed.');
    expect(formatted).toBe('Action failed.');
  });
});
