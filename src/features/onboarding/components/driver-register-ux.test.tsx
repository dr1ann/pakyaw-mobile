import { describe, expect, it } from 'vitest';
import { normalizePhilippineMobile } from '@/features/onboarding/services/driver-registration.service';
import { sanitizeMobileInput, sanitizeOtpCode } from '@/features/onboarding/input-validation';

function maskMobile(mobile: string): string {
  const normalized = normalizePhilippineMobile(mobile) || mobile;
  const digits = normalized.replace(/[^0-9+]/g, '');
  if (digits.startsWith('+63') && digits.length >= 12) {
    return `+63 •••• ${digits.slice(-4)}`;
  }
  if (digits.length >= 10) {
    return `${digits.slice(0, 4)} ••• ${digits.slice(-4)}`;
  }
  return digits;
}

function formatCooldown(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

describe('Driver Registration & OTP UX utilities', () => {
  describe('maskMobile', () => {
    it('masks standard +63 Philippine mobile numbers correctly', () => {
      expect(maskMobile('+639171234567')).toBe('+63 •••• 4567');
      expect(maskMobile('09171234567')).toBe('+63 •••• 4567');
      expect(maskMobile('9171234567')).toBe('+63 •••• 4567');
    });

    it('handles short or unnormalized inputs gracefully without throwing', () => {
      expect(maskMobile('123')).toBe('123');
      expect(maskMobile('')).toBe('');
    });
  });

  describe('formatCooldown', () => {
    it('formats seconds into mm:ss timer format', () => {
      expect(formatCooldown(60)).toBe('01:00');
      expect(formatCooldown(24)).toBe('00:24');
      expect(formatCooldown(5)).toBe('00:05');
      expect(formatCooldown(0)).toBe('00:00');
    });
  });

  describe('input sanitization', () => {
    it('sanitizes mobile input to digits only', () => {
      expect(sanitizeMobileInput('0917-123-4567')).toBe('09171234567');
      expect(sanitizeMobileInput('+63 917 123 4567')).toBe('+639171234567');
      expect(sanitizeMobileInput('abc0917xyz')).toBe('0917');
    });

    it('sanitizes OTP code to 6 digits maximum', () => {
      expect(sanitizeOtpCode('123456')).toBe('123456');
      expect(sanitizeOtpCode('12-34-56-78')).toBe('123456');
      expect(sanitizeOtpCode('abc123def')).toBe('123');
    });
  });
});
