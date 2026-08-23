import { describe, expect, it } from 'vitest';

import { clamp, MAX_SEATS, MIN_SEATS } from '@/lib/seatModel';

describe('seatModel.clamp', () => {
  it('returns MIN_SEATS for values below the floor', () => {
    expect(clamp(0)).toBe(MIN_SEATS);
    expect(clamp(-1)).toBe(MIN_SEATS);
  });

  it('returns MAX_SEATS for values above the ceiling', () => {
    expect(clamp(7)).toBe(MAX_SEATS);
    expect(clamp(100)).toBe(MAX_SEATS);
  });

  it('passes valid integers through', () => {
    expect(clamp(1)).toBe(1);
    expect(clamp(3)).toBe(3);
    expect(clamp(4)).toBe(4);
    expect(clamp(5)).toBe(5);
    expect(clamp(6)).toBe(6);
  });

  it('truncates fractional values', () => {
    expect(clamp(4.9)).toBe(4);
    expect(clamp(5.5)).toBe(5);
  });

  it('falls back to MIN_SEATS for NaN and clamps Infinities', () => {
    expect(clamp(Number.NaN)).toBe(MIN_SEATS);
    expect(clamp(Number.POSITIVE_INFINITY)).toBe(MIN_SEATS);
    expect(clamp(Number.NEGATIVE_INFINITY)).toBe(MIN_SEATS);
  });
});
