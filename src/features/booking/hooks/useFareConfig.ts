import { useQuery } from '@tanstack/react-query';
import { doc, getDoc } from 'firebase/firestore';

import { firestore } from '@/services/firebase/firebase';

export function useFareConfig(vehicleType: string = 'Tricycle') {
  return useQuery({
    queryKey: ['fareConfig', vehicleType],
    queryFn: async () => {
      const docRef = doc(firestore, 'config', `fares_${vehicleType}`);
      const snap = await getDoc(docRef);
      if (!snap.exists()) {
        // Return default config
        return {
          baseFare: 10,
          baseDistanceKm: 2.5,
          succeedingKmRate: 1.5,
          specialTripSurcharge: 50,
          specialTripThresholdMeters: 50,
          lateNightEnabled: false,
          lateNightRadiusKm: 2.5,
          lateNightInsideRate: 5,
          lateNightOutsideRate: 10,
          lateNightStartTime: "22:00",
          lateNightEndTime: "06:00",
          active_scheme: 'shared_fee',
          schemes: {
            shared_fee: { booking_fee: 15, platform_share_percent: 60, driver_share_percent: 40 },
            subsidized: { total_booking_fee: 15, passenger_pays: 10 },
            full_pass_on: { booking_fee: 15 },
            flat_commission: { commission_percent: 10 },
            subscription: { daily_fee: 100 },
            tiered: { short_distance_km: 5, short_fee: 10, long_fee: 20 }
          }
        };
      }
      
      const data = snap.data();
      return {
        baseFare: data.base_fare ?? 10,
        baseDistanceKm: data.base_distance_km ?? 2.5,
        succeedingKmRate: data.succeeding_km_rate ?? 1.5,
        specialTripSurcharge: data.special_trip_surcharge ?? 50,
        specialTripThresholdMeters: data.special_trip_threshold_meters ?? 50,
        lateNightEnabled: data.lateNightEnabled ?? false,
        lateNightRadiusKm: data.lateNightRadiusKm ?? 2.5,
        lateNightInsideRate: data.lateNightInsideRate ?? 5,
        lateNightOutsideRate: data.lateNightOutsideRate ?? 10,
        lateNightStartTime: data.lateNightStartTime ?? "22:00",
        lateNightEndTime: data.lateNightEndTime ?? "06:00",
        active_scheme: data.active_scheme ?? 'shared_fee',
        schemes: {
          shared_fee: {
            booking_fee: data.schemes?.shared_fee?.booking_fee ?? 15,
            platform_share_percent: data.schemes?.shared_fee?.platform_share_percent ?? 60,
            driver_share_percent: data.schemes?.shared_fee?.driver_share_percent ?? 40,
          },
          subsidized: {
            total_booking_fee: data.schemes?.subsidized?.total_booking_fee ?? 15,
            passenger_pays: data.schemes?.subsidized?.passenger_pays ?? 10,
          },
          full_pass_on: {
            booking_fee: data.schemes?.full_pass_on?.booking_fee ?? 15,
          },
          flat_commission: {
            commission_percent: data.schemes?.flat_commission?.commission_percent ?? 10,
          },
          subscription: {
            daily_fee: data.schemes?.subscription?.daily_fee ?? 100,
          },
          tiered: {
            short_distance_km: data.schemes?.tiered?.short_distance_km ?? 5,
            short_fee: data.schemes?.tiered?.short_fee ?? 10,
            long_fee: data.schemes?.tiered?.long_fee ?? 20,
          }
        }
      };
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}
