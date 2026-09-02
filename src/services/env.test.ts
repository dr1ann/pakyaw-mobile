import { describe, expect, it } from 'vitest';

import { parseEnv } from '@/services/env';

const validEnv = {
  APP_ENV: 'development',
  EXPO_PUBLIC_FIREBASE_API_KEY: 'key',
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: 'pakyaw.firebaseapp.com',
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'pakyaw',
  EXPO_PUBLIC_FIREBASE_APP_ID: '1:abc',
  EXPO_PUBLIC_GOOGLE_MAPS_API_KEY: 'AIzaSy_test_key',
};

describe('env.parseEnv', () => {
  it('parses a fully-populated env shape', () => {
    expect(parseEnv(validEnv)).toEqual(validEnv);
  });

  it('defaults APP_ENV to development when omitted', () => {
    const { APP_ENV: _omit, ...rest } = validEnv;
    expect(parseEnv(rest).APP_ENV).toBe('development');
  });

  it('rejects an unknown APP_ENV value', () => {
    expect(() => parseEnv({ ...validEnv, APP_ENV: 'staging' })).toThrow();
  });

  it('rejects missing Firebase keys', () => {
    const { EXPO_PUBLIC_FIREBASE_API_KEY: _omit, ...rest } = validEnv;
    expect(() => parseEnv(rest)).toThrow();
  });

  it('rejects empty string secrets', () => {
    expect(() =>
      parseEnv({ ...validEnv, EXPO_PUBLIC_GOOGLE_MAPS_API_KEY: '' }),
    ).toThrow();
  });

  it('requires a configured Firebase test number when phone auth test mode is enabled', () => {
    expect(() =>
      parseEnv({ ...validEnv, EXPO_PUBLIC_PHONE_AUTH_TEST_MODE: 'true' }),
    ).toThrow(/test phone number is required/);
  });

  it('rejects phone auth test mode in production', () => {
    expect(() =>
      parseEnv({
        ...validEnv,
        APP_ENV: 'production',
        EXPO_PUBLIC_PHONE_AUTH_TEST_MODE: 'true',
        EXPO_PUBLIC_PHONE_AUTH_TEST_NUMBER: '+639171234567',
      }),
    ).toThrow(/cannot be enabled in production/);
  });

  it('accepts a configured phone auth test number in development', () => {
    expect(
      parseEnv({
        ...validEnv,
        EXPO_PUBLIC_PHONE_AUTH_TEST_MODE: 'true',
        EXPO_PUBLIC_PHONE_AUTH_TEST_NUMBER: '+639171234567',
      }),
    ).toMatchObject({
      EXPO_PUBLIC_PHONE_AUTH_TEST_MODE: 'true',
      EXPO_PUBLIC_PHONE_AUTH_TEST_NUMBER: '+639171234567',
    });
  });
});
