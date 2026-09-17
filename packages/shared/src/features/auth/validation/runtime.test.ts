import { describe, expect, it } from 'vitest';
import { parseUserDoc } from './runtime';

const validUser = {
  uid: 'passenger-1',
  name: 'Passenger One',
  mobile: '+639171234567',
  role: 'passenger',
  accountStatus: 'active',
  createdAt: { seconds: 100, nanoseconds: 0 },
  updatedAt: { seconds: 100, nanoseconds: 0 },
};

describe('Auth runtime reader', () => {
  it('accepts a canonical user document', () => {
    expect(parseUserDoc('passenger-1', validUser)?.role).toBe('passenger');
  });

  it('rejects a user document whose UID or required status is malformed', () => {
    expect(parseUserDoc('other-uid', validUser)).toBeNull();
    expect(parseUserDoc('passenger-1', { ...validUser, accountStatus: 'enabled' })).toBeNull();
    expect(parseUserDoc('passenger-1', { ...validUser, updatedAt: {} })).toBeNull();
  });
});
