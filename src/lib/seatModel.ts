export const MIN_SEATS = 1;
export const MAX_SEATS = 6;

export function clamp(passengerCount: number, maxSeats: number = MAX_SEATS, minSeats: number = MIN_SEATS): number {
  if (!Number.isFinite(passengerCount)) return minSeats;
  const rounded = Math.trunc(passengerCount);
  if (rounded < minSeats) return minSeats;
  if (rounded > maxSeats) return maxSeats;
  return rounded;
}
