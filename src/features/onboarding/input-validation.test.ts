import { describe, expect, it } from 'vitest';

import {
  composeFullLegalName,
  composeStructuredLegalName,
  dateFromDateOnly,
  formatDateOnly,
  hasNamePart,
  sanitizeIdentifier,
  sanitizeMobileInput,
  sanitizeNamePart,
  sanitizeOtpCode,
} from '@/features/onboarding/input-validation';

describe('driver onboarding input validation', () => {
  describe('structured legal name composition', () => {
    it('handles first + last', () => {
      const result = composeStructuredLegalName({
        firstName: 'Juan',
        lastName: 'Dela Cruz',
      });
      expect(result).toBe('Juan Dela Cruz');
    });

    it('handles first + middle + last', () => {
      const result = composeStructuredLegalName({
        firstName: 'Juan',
        middleName: 'Santos',
        lastName: 'Dela Cruz',
      });
      expect(result).toBe('Juan Santos Dela Cruz');
    });

    it('handles first + last + suffix', () => {
      const result = composeStructuredLegalName({
        firstName: 'Juan',
        lastName: 'Dela Cruz',
        suffix: 'Jr.',
      });
      expect(result).toBe('Juan Dela Cruz Jr.');
    });

    it('handles full first + middle + last + suffix', () => {
      const result = composeStructuredLegalName({
        firstName: 'Juan',
        middleName: 'Santos',
        lastName: 'Dela Cruz',
        suffix: 'Jr.',
      });
      expect(result).toBe('Juan Santos Dela Cruz Jr.');
    });

    it('handles whitespace normalization', () => {
      const result = composeStructuredLegalName({
        firstName: '  Juan  ',
        middleName: '  Santos  ',
        lastName: '  Dela Cruz  ',
        suffix: '  Jr.  ',
      });
      expect(result).toBe('Juan Santos Dela Cruz Jr.');
    });

    it('handles optional middle/suffix when empty or whitespace', () => {
      const result1 = composeStructuredLegalName({
        firstName: 'Juan',
        middleName: '',
        lastName: 'Dela Cruz',
        suffix: '',
      });
      expect(result1).toBe('Juan Dela Cruz');

      const result2 = composeStructuredLegalName({
        firstName: 'Juan',
        middleName: '   ',
        lastName: 'Dela Cruz',
        suffix: undefined,
      });
      expect(result2).toBe('Juan Dela Cruz');
    });

    it('handles legacy full-name fallback without unsafe parsing', () => {
      const result1 = composeStructuredLegalName({
        fullLegalName: 'Juan Santos Dela Cruz Jr.',
      });
      expect(result1).toBe('Juan Santos Dela Cruz Jr.');

      const result2 = composeStructuredLegalName({
        name: 'Maria Clara De Los Santos',
      });
      expect(result2).toBe('Maria Clara De Los Santos');

      // Incomplete structured fields fall back to legacy name
      const result3 = composeStructuredLegalName({
        firstName: 'Juan',
        // missing lastName
        fullLegalName: 'Juan Dela Cruz Legacy',
      });
      expect(result3).toBe('Juan Dela Cruz Legacy');
    });

    it('derives users.name correctly from structured legal name', () => {
      const structured = {
        firstName: 'Juan',
        middleName: 'Santos',
        lastName: 'Dela Cruz',
        suffix: 'Jr.',
      };
      const usersName = composeStructuredLegalName(structured);
      expect(usersName).toBe('Juan Santos Dela Cruz Jr.');
    });
  });

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
