export const MIN_SEATS = 1;
export const MAX_SEATS = 6;

export function clamp(passengerCount: number): number {
  if (!Number.isFinite(passengerCount)) return MIN_SEATS;
  const rounded = Math.trunc(passengerCount);
  if (rounded < MIN_SEATS) return MIN_SEATS;
  if (rounded > MAX_SEATS) return MAX_SEATS;
  return rounded;
}
