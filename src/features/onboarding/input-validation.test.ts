import { describe, expect, it } from 'vitest';

import {
  composeFullLegalName,
  dateFromDateOnly,
  formatDateOnly,
  hasNamePart,
  sanitizeIdentifier,
  sanitizeMobileInput,
  sanitizeNamePart,
  sanitizeOtpCode,
} from '@/features/onboarding/input-validation';

describe('driver onboarding input validation', () => {
  it('keeps legitimate name characters and composes an optional middle name safely', () => {
    expect(sanitizeNamePart("Ma. José Dela-Cruz 123!")).toBe('Ma. José Dela-Cruz ');
    expect(composeFullLegalName('Juan', '', 'Dela Cruz')).toBe('Juan Dela Cruz');
    expect(composeFullLegalName('Juan', 'Santos', 'Dela Cruz')).toBe('Juan Santos Dela Cruz');
    expect(hasNamePart('  ')).toBe(false);
  });

  it('keeps only supported characters for mobile, OTP, and flexible identifiers', () => {
    expect(sanitizeMobileInput('+63917 123-4567')).toBe('+639171234567');
    expect(sanitizeOtpCode('12a3-45678')).toBe('123456');
    expect(sanitizeIdentifier('abc-123 /?')).toBe('ABC-123 ');
  });

  it('round-trips valid date-only values without a UTC day shift', () => {
    const selected = new Date(2027, 0, 31, 12);
    expect(formatDateOnly(selected)).toBe('2027-01-31');
    expect(dateFromDateOnly('2027-01-31')?.getDate()).toBe(31);
    expect(dateFromDateOnly('2027-02-30')).toBeNull();
  });
});
