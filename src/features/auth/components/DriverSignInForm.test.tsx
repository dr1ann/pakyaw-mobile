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

describe('DriverSignInForm UX & OTP validation', () => {
  describe('Phone input validation & normalization', () => {
    it('normalizes local Philippine mobile format (09171234567) to international format', () => {
      expect(normalizePhilippineMobile('09171234567')).toBe('+639171234567');
      expect(normalizePhilippineMobile('9171234567')).toBe('+639171234567');
      expect(normalizePhilippineMobile('+639171234567')).toBe('+639171234567');
    });

    it('rejects invalid or incomplete phone numbers', () => {
      expect(normalizePhilippineMobile('12345')).toBeNull();
      expect(normalizePhilippineMobile('08171234567')).toBeNull(); // non-9 prefix
      expect(normalizePhilippineMobile('')).toBeNull();
    });

    it('sanitizes user input by stripping forbidden characters', () => {
      expect(sanitizeMobileInput('0917-123-4567')).toBe('09171234567');
      expect(sanitizeMobileInput('+63 917 123 4567')).toBe('+639171234567');
      expect(sanitizeMobileInput('abc 0917 123 4567')).toBe('09171234567');
    });
  });

  describe('OTP formatting and masking', () => {
    it('masks phone numbers securely for OTP screen display', () => {
      expect(maskMobile('+639171234567')).toBe('+63 •••• 4567');
      expect(maskMobile('09171234567')).toBe('+63 •••• 4567');
      expect(maskMobile('09987654321')).toBe('+63 •••• 4321');
    });

    it('sanitizes OTP code to numbers only with maximum 6 digits', () => {
      expect(sanitizeOtpCode('123456')).toBe('123456');
      expect(sanitizeOtpCode('12345678')).toBe('123456');
      expect(sanitizeOtpCode('12-34-56')).toBe('123456');
      expect(sanitizeOtpCode('abc123456')).toBe('123456');
    });

    it('formats countdown seconds as MM:SS string', () => {
      expect(formatCooldown(60)).toBe('01:00');
      expect(formatCooldown(45)).toBe('00:45');
      expect(formatCooldown(9)).toBe('00:09');
      expect(formatCooldown(0)).toBe('00:00');
    });
  });
});
