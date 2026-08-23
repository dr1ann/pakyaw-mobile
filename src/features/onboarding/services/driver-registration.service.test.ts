import { describe, expect, it } from 'vitest';
import { normalizePhilippineMobile } from './driver-registration.service';

describe('driver registration mobile normalization', () => {
  it.each([['+639171234567', '+639171234567'], ['09171234567', '+639171234567'], ['9171234567', '+639171234567']])(
    'normalizes %s', (value, expected) => expect(normalizePhilippineMobile(value)).toBe(expected),
  );
  it('rejects non-Philippine mobile values', () => expect(normalizePhilippineMobile('08171234567')).toBeNull());
});
