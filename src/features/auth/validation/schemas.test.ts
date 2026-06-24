import { describe, expect, it } from 'vitest';

import {
  signUpCredentialsSchema,
  signUpProfileSchema,
  signInSchema,
  driverSignInSchema,
  riderTypeSchema,
} from './schemas';

// ---------------------------------------------------------------------------
// signUpCredentialsSchema
// ---------------------------------------------------------------------------
describe('signUpCredentialsSchema', () => {
  it('accepts valid email + password of 6+ chars', () => {
    const result = signUpCredentialsSchema.safeParse({
      email: 'user@example.com',
      password: 'secret123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = signUpCredentialsSchema.safeParse({
      email: 'not-an-email',
      password: 'secret123',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain('valid email');
  });

  it('rejects password shorter than 6 chars', () => {
    const result = signUpCredentialsSchema.safeParse({
      email: 'user@example.com',
      password: '123',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain('6 characters');
  });

  it('rejects empty password', () => {
    const result = signUpCredentialsSchema.safeParse({
      email: 'user@example.com',
      password: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing email', () => {
    const result = signUpCredentialsSchema.safeParse({
      password: 'secret123',
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// signUpProfileSchema
// ---------------------------------------------------------------------------
describe('signUpProfileSchema', () => {
  it('accepts valid first/last name and +63 phone', () => {
    const result = signUpProfileSchema.safeParse({
      firstName: 'Juan',
      lastName: 'dela Cruz',
      phone: '+639171234567',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty first name', () => {
    const result = signUpProfileSchema.safeParse({
      firstName: '',
      lastName: 'dela Cruz',
      phone: '+639171234567',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain('required');
  });

  it('rejects empty last name', () => {
    const result = signUpProfileSchema.safeParse({
      firstName: 'Juan',
      lastName: '',
      phone: '+639171234567',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain('required');
  });

  it('rejects phone not starting with +639', () => {
    const result = signUpProfileSchema.safeParse({
      firstName: 'Juan',
      lastName: 'dela Cruz',
      phone: '+6391234',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain('+639');
  });

  it('rejects phone with wrong country code', () => {
    const result = signUpProfileSchema.safeParse({
      firstName: 'Juan',
      lastName: 'dela Cruz',
      phone: '+1234567890',
    });
    expect(result.success).toBe(false);
  });

  it('rejects phone with too few digits after +639', () => {
    const result = signUpProfileSchema.safeParse({
      firstName: 'Juan',
      lastName: 'dela Cruz',
      phone: '+63912345678', // 8 digits after +639 — needs 9
    });
    expect(result.success).toBe(false);
  });

  it('accepts exactly 9 digits after +639', () => {
    const result = signUpProfileSchema.safeParse({
      firstName: 'Juan',
      lastName: 'dela Cruz',
      phone: '+639123456789',
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// signInSchema
// ---------------------------------------------------------------------------
describe('signInSchema', () => {
  it('accepts valid email + non-empty password', () => {
    const result = signInSchema.safeParse({
      email: 'user@test.com',
      password: 'anypassword',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = signInSchema.safeParse({
      email: 'invalid',
      password: 'anypassword',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty password', () => {
    const result = signInSchema.safeParse({
      email: 'user@test.com',
      password: '',
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// driverSignInSchema
// ---------------------------------------------------------------------------
describe('driverSignInSchema', () => {
  it('accepts valid email and password', () => {
    const result = driverSignInSchema.safeParse({
      email: 'driver@example.com',
      password: 'secret123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = driverSignInSchema.safeParse({
      email: 'not-an-email',
      password: 'secret123',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain('valid email');
  });

  it('rejects empty password', () => {
    const result = driverSignInSchema.safeParse({
      email: 'driver@example.com',
      password: '',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain('required');
  });

  it('rejects missing email', () => {
    const result = driverSignInSchema.safeParse({
      password: 'secret123',
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// riderTypeSchema
// ---------------------------------------------------------------------------
describe('riderTypeSchema', () => {
  it.each(['regular', 'student', 'pwd', 'senior'] as const)(
    'accepts rider type "%s"',
    (riderType) => {
      const result = riderTypeSchema.safeParse({ riderType });
      expect(result.success).toBe(true);
    },
  );

  it('rejects unknown rider type', () => {
    const result = riderTypeSchema.safeParse({ riderType: 'vip' });
    expect(result.success).toBe(false);
  });
});
