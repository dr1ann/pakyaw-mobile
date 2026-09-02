const MAX_NAME_PART_LENGTH = 80;

/** Keeps characters normally used in Filipino legal names while removing accidental numeric/symbol input. */
export function sanitizeNamePart(value: string, maximumLength = MAX_NAME_PART_LENGTH): string {
  return value
    .normalize('NFC')
    .replace(/[^\p{L}\p{M}\s.'-]/gu, '')
    .replace(/\s+/g, ' ')
    .slice(0, maximumLength);
}

export { composeStructuredLegalName, type StructuredLegalName } from '@pakyaw/shared/onboarding';

export function composeFullLegalName(firstName: string, middleName: string, lastName: string): string {
  return [firstName, middleName, lastName]
    .map((part) => sanitizeNamePart(part).trim())
    .filter(Boolean)
    .join(' ');
}

export function hasNamePart(value: string): boolean {
  return sanitizeNamePart(value).trim().length > 0;
}

/** Allows the three Philippine entry forms while the shared normalizer remains the final authority. */
export function sanitizeMobileInput(value: string): string {
  const hasLeadingPlus = value.trimStart().startsWith('+');
  const digits = value.replace(/\D/g, '').slice(0, 12);
  return hasLeadingPlus ? `+${digits}` : digits;
}

export function sanitizeOtpCode(value: string): string {
  return value.replace(/\D/g, '').slice(0, 6);
}

/**
 * Government identifiers have multiple current and legacy forms. Keep the
 * input legible and safe without claiming an unsupported exact format.
 */
export function sanitizeIdentifier(value: string, maximumLength = 40): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9 -]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, maximumLength);
}

export function sanitizeDescription(value: string, maximumLength = 160): string {
  return value.replace(/[\u0000-\u001F\u007F]/g, '').slice(0, maximumLength);
}

export function formatDateOnly(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Creates a local noon date so displaying a date-only value cannot drift at midnight. */
export function dateFromDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  return date.getFullYear() === Number(match[1])
    && date.getMonth() === Number(match[2]) - 1
    && date.getDate() === Number(match[3])
    ? date
    : null;
}

export function formatReadableDate(value: string): string {
  const date = dateFromDateOnly(value);
  return date
    ? new Intl.DateTimeFormat('en-PH', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
    : 'Choose expiry date';
}
