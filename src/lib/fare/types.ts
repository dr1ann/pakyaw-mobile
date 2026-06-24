// Shape of inputs for the future fare engine.
// All monetary details and pricing logic are deferred (architecture §4 hard rule).
export type RiderType = 'regular' | 'student' | 'pwd' | 'senior';

export enum SurchargeType {
  RAIN = 'RAIN',
  RUSH_HOUR = 'RUSH_HOUR',
  HOLIDAY = 'HOLIDAY',
  NIGHT_DIFF = 'NIGHT_DIFF',
}

export interface FareInput {
  barangay: string;
  billedSeats: number;
  riderType: RiderType;
  surcharges: SurchargeType[];
}

export type FareOutput = null;
