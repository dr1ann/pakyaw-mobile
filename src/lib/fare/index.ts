import type { FareInput, FareOutput, FareConfig } from './types';
import { SurchargeType } from './types';

export function computeFare(
  input: FareInput,
  config: FareConfig,
  requestTime: Date = new Date()
): FareOutput {
  const { billedSeats, riderType, surcharges, distanceKm } = input;
  
  // Base fare in config is the per-seat base fare.
  let perSeatBase = config.baseFare;
  if (riderType !== 'regular') {
    perSeatBase = perSeatBase * 0.80;
  }
  
  const actualSeats = Math.max(4, Math.min(6, billedSeats));
  const baseBuyout = perSeatBase * actualSeats;
  
  let distanceSurchargePerSeat = 0;
  if (distanceKm > config.baseDistanceKm) {
    distanceSurchargePerSeat = (distanceKm - config.baseDistanceKm) * config.succeedingKmRate;
    if (riderType !== 'regular') {
      distanceSurchargePerSeat = distanceSurchargePerSeat * 0.80;
    }
  }
  
  const totalDistanceSurcharge = distanceSurchargePerSeat * actualSeats;
  
  let surchargesSum = 0;
  let specialTripSurcharge = 0;
  
  if (surcharges.includes(SurchargeType.SPECIAL_TRIP_PICKUP) || surcharges.includes(SurchargeType.SPECIAL_TRIP_DROPOFF)) {
    specialTripSurcharge = config.specialTripSurcharge || 50;
  }
  
  surchargesSum += specialTripSurcharge;
  
  let nightSurcharge = 0;
  if (config.lateNightEnabled) {
    const currentHour = requestTime.getHours();
    const currentMin = requestTime.getMinutes();
    const currentMins = currentHour * 60 + currentMin;

    const parseTime = (timeStr: string) => {
      if (!timeStr) return { h: 0, m: 0 };
      const [h, m] = timeStr.split(':').map(Number);
      return { h: isNaN(h) ? 0 : h, m: isNaN(m) ? 0 : m };
    };

    const start = parseTime(config.lateNightStartTime);
    const end = parseTime(config.lateNightEndTime);
    const startMins = start.h * 60 + start.m;
    const endMins = end.h * 60 + end.m;

    let isNight = false;
    if (startMins <= endMins) {
      isNight = currentMins >= startMins && currentMins < endMins;
    } else {
      // Overnight wrap (e.g. 22:00 to 06:00)
      isNight = currentMins >= startMins || currentMins < endMins;
    }

    if (isNight) {
      if (distanceKm <= config.lateNightRadiusKm) {
        nightSurcharge = config.lateNightInsideRate;
      } else {
        nightSurcharge = config.lateNightOutsideRate;
      }
      surchargesSum += nightSurcharge;
    }
  }
  
  const baseCalculatedFare = baseBuyout + totalDistanceSurcharge + surchargesSum;
  let totalFare = baseCalculatedFare;
  let bookingFee = 0;

  switch (config.active_scheme) {
    case 'shared_fee': {
      if (config.schemes.shared_fee) {
        bookingFee = config.schemes.shared_fee.booking_fee;
        totalFare = baseCalculatedFare + bookingFee;
      }
      break;
    }
    case 'subsidized': {
      if (config.schemes.subsidized) {
        bookingFee = config.schemes.subsidized.passenger_pays;
        totalFare = baseCalculatedFare + bookingFee;
      }
      break;
    }
    case 'full_pass_on': {
      if (config.schemes.full_pass_on) {
        bookingFee = config.schemes.full_pass_on.booking_fee;
        totalFare = baseCalculatedFare + bookingFee;
      }
      break;
    }
    case 'tiered': {
      if (config.schemes.tiered) {
        const fee = distanceKm <= config.schemes.tiered.short_distance_km ? config.schemes.tiered.short_fee : config.schemes.tiered.long_fee;
        bookingFee = fee;
        totalFare = baseCalculatedFare + bookingFee;
      }
      break;
    }
    default:
      break;
  }

  return { 
    totalFare,
    breakdown: {
      baseFare: baseBuyout,
      distanceSurcharge: totalDistanceSurcharge,
      nightSurcharge,
      bookingFee,
      specialTripSurcharge,
      singleSeatFare: perSeatBase + distanceSurchargePerSeat
    }
  };
}
export function computeSharedFare(
  input: FareInput,
  config: FareConfig,
  requestTime: Date = new Date()
): FareOutput {
  const { billedSeats, riderType, surcharges, distanceKm } = input;
  
  // Base fare in config is the per-seat base fare.
  let perSeatBase = config.baseFare;
  if (riderType !== 'regular') {
    perSeatBase = perSeatBase * 0.80;
  }
  
  // No minimum 4 seat buyout for shared rides. 
  // Passenger pays exactly for the seats they cover (1-3).
  const actualSeats = billedSeats;
  const baseBuyout = perSeatBase * actualSeats;
  
  let distanceSurchargePerSeat = 0;
  if (distanceKm > config.baseDistanceKm) {
    distanceSurchargePerSeat = (distanceKm - config.baseDistanceKm) * config.succeedingKmRate;
    if (riderType !== 'regular') {
      distanceSurchargePerSeat = distanceSurchargePerSeat * 0.80;
    }
  }
  
  const totalDistanceSurcharge = distanceSurchargePerSeat * actualSeats;
  
  let surchargesSum = 0;
  let specialTripSurcharge = 0;
  
  // In shared mode, they always pay the special trip pickup fee if applicable
  if (surcharges.includes(SurchargeType.SPECIAL_TRIP_PICKUP) || surcharges.includes(SurchargeType.SPECIAL_TRIP_DROPOFF)) {
    specialTripSurcharge = config.specialTripSurcharge || 50;
  }
  
  surchargesSum += specialTripSurcharge;
  
  let nightSurcharge = 0;
  if (config.lateNightEnabled) {
    const currentHour = requestTime.getHours();
    const currentMin = requestTime.getMinutes();
    const currentMins = currentHour * 60 + currentMin;

    const parseTime = (timeStr: string) => {
      if (!timeStr) return { h: 0, m: 0 };
      const [h, m] = timeStr.split(':').map(Number);
      return { h: isNaN(h) ? 0 : h, m: isNaN(m) ? 0 : m };
    };

    const start = parseTime(config.lateNightStartTime);
    const end = parseTime(config.lateNightEndTime);
    const startMins = start.h * 60 + start.m;
    const endMins = end.h * 60 + end.m;

    let isNight = false;
    if (startMins <= endMins) {
      isNight = currentMins >= startMins && currentMins < endMins;
    } else {
      isNight = currentMins >= startMins || currentMins < endMins;
    }

    if (isNight) {
      if (distanceKm <= config.lateNightRadiusKm) {
        nightSurcharge = config.lateNightInsideRate;
      } else {
        nightSurcharge = config.lateNightOutsideRate;
      }
      surchargesSum += nightSurcharge;
    }
  }
  
  const baseCalculatedFare = baseBuyout + totalDistanceSurcharge + surchargesSum;
  let totalFare = baseCalculatedFare;
  let bookingFee = 0;

  switch (config.active_scheme) {
    case 'shared_fee': {
      if (config.schemes.shared_fee) {
        bookingFee = config.schemes.shared_fee.booking_fee;
        totalFare = baseCalculatedFare + bookingFee;
      }
      break;
    }
    case 'subsidized': {
      if (config.schemes.subsidized) {
        bookingFee = config.schemes.subsidized.passenger_pays;
        totalFare = baseCalculatedFare + bookingFee;
      }
      break;
    }
    case 'full_pass_on': {
      if (config.schemes.full_pass_on) {
        bookingFee = config.schemes.full_pass_on.booking_fee;
        totalFare = baseCalculatedFare + bookingFee;
      }
      break;
    }
    case 'tiered': {
      if (config.schemes.tiered) {
        const fee = distanceKm <= config.schemes.tiered.short_distance_km ? config.schemes.tiered.short_fee : config.schemes.tiered.long_fee;
        bookingFee = fee;
        totalFare = baseCalculatedFare + bookingFee;
      }
      break;
    }
    default:
      break;
  }

  return { 
    totalFare,
    breakdown: {
      baseFare: baseBuyout,
      distanceSurcharge: totalDistanceSurcharge,
      nightSurcharge,
      bookingFee,
      specialTripSurcharge,
      singleSeatFare: perSeatBase + distanceSurchargePerSeat
    }
  };
}
