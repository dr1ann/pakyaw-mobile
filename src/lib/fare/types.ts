export type RiderType = 'regular' | 'student' | 'pwd' | 'senior';

export enum SurchargeType {
  RAIN = 'RAIN',
  RUSH_HOUR = 'RUSH_HOUR',
  HOLIDAY = 'HOLIDAY',
  NIGHT_DIFF = 'NIGHT_DIFF',
  SPECIAL_TRIP_PICKUP = 'SPECIAL_TRIP_PICKUP',
  SPECIAL_TRIP_DROPOFF = 'SPECIAL_TRIP_DROPOFF',
}

export interface FareInput {
  distanceKm: number;
  billedSeats: number;
  riderType: RiderType;
  surcharges: SurchargeType[];
}

export interface FareOutput {
  totalFare: number;
  breakdown: {
    baseFare: number;
    distanceSurcharge: number;
    nightSurcharge: number;
    bookingFee: number;
    specialTripSurcharge: number;
    singleSeatFare: number;
  };
}

export interface FareConfig {
  baseFare: number;
  baseDistanceKm: number;
  succeedingKmRate: number;
  specialTripSurcharge: number;
  specialTripThresholdMeters: number;
  lateNightEnabled: boolean;
  lateNightRadiusKm: number;
  lateNightInsideRate: number;
  lateNightOutsideRate: number;
  lateNightStartTime: string;
  lateNightEndTime: string;
  active_scheme: string;
  schemes: {
    shared_fee?: { booking_fee: number; platform_share_percent: number; driver_share_percent: number };
    subsidized?: { total_booking_fee: number; passenger_pays: number };
    full_pass_on?: { booking_fee: number };
    flat_commission?: { commission_percent: number };
    subscription?: { daily_fee: number };
    tiered?: { short_distance_km: number; short_fee: number; long_fee: number };
  };
}
