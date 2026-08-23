import { describe, expect, it } from 'vitest';
import { normalizePhilippineMobile } from './phone-registration.service';

describe('normalizePhilippineMobile', () => {
  it.each([
    ['+639171234567', '+639171234567'],
    ['09171234567', '+639171234567'],
    ['9171234567', '+639171234567'],
  ])('normalizes %s', (value, expected) => expect(normalizePhilippineMobile(value)).toBe(expected));

  it('rejects invalid mobile values', () => {
    expect(normalizePhilippineMobile('08171234567')).toBeNull();
    expect(normalizePhilippineMobile('917123456')).toBeNull();
  });
});
