import { useQuery } from '@tanstack/react-query';
import { useBookingDraftStore, routeMatchesInputs } from '@/stores/bookingDraftStore';
import { quoteTrip, type PassengerFareQuote } from '@/features/booking/services/quote.service';
import { toRideMode, type CreateBookingInput } from '@/features/booking/types';

export function useQuote() {
  const draft = useBookingDraftStore((s) => s.draft);

  const routeIsCurrent = routeMatchesInputs(draft);
  const currentRoute = routeIsCurrent ? draft.route : null;
  const isRouteValid = !!currentRoute && currentRoute.distanceMeters >= 50;

  const hasCoords = !!draft.pickup?.coords && !!draft.destination?.coords;
  const canQuote = hasCoords && isRouteValid;

  const effectiveRiderCount = draft.rideMode === 'hopon' ? 1 : Math.max(1, draft.passengerCount);
  const effectiveBilledSeats = draft.rideMode === 'private'
    ? Math.max(4, effectiveRiderCount)
    : effectiveRiderCount;

  const payload: CreateBookingInput | null = canQuote && draft.pickup && draft.destination && currentRoute
    ? {
        mode: toRideMode(draft.rideMode),
        pickup: draft.pickup,
        destination: draft.destination,
        passengerCount: effectiveRiderCount,
        route: {
          distanceMeters: currentRoute.distanceMeters,
          durationSeconds: currentRoute.durationSeconds,
          polyline: currentRoute.polyline,
        },
      }
    : null;

  const queryKey = [
    'quoteTrip',
    draft.rideMode,
    draft.pickup?.coords?.lat,
    draft.pickup?.coords?.lng,
    draft.destination?.coords?.lat,
    draft.destination?.coords?.lng,
    effectiveRiderCount,
    currentRoute?.distanceMeters,
    currentRoute?.polyline,
  ];

  const query = useQuery<PassengerFareQuote, Error>({
    queryKey,
    queryFn: async () => {
      if (!payload) throw new Error('Incomplete booking inputs for fare quote.');
      return quoteTrip(payload);
    },
    placeholderData: (previousData) => previousData,
    enabled: Boolean(canQuote && payload),
    staleTime: 30_000,
    retry: 1,
  });

  // Dynamically compute instantaneous quote for rider count changes using the current route quote
  const rawQuote = query.data ?? null;
  let dynamicQuote: PassengerFareQuote | null = rawQuote;

  if (rawQuote && rawQuote.fare) {
    const quoteBilledSeats = rawQuote.billedSeats || (rawQuote.fare as any).billedSeats || 4;
    const baseFare = rawQuote.fare.perSeat?.baseFare
      ?? (rawQuote.fare.baseFare != null ? rawQuote.fare.baseFare / (rawQuote.fare.perSeat ? 1 : quoteBilledSeats) : 10);
    const succeedingKm = rawQuote.fare.perSeat?.succeedingKmCharge
      ?? ((rawQuote.fare.succeedingKmCharge ?? rawQuote.fare.distanceFare ?? 0) / (rawQuote.fare.perSeat ? 1 : quoteBilledSeats));
    const techFee = rawQuote.fare.techFee ?? 0;
    const surchargeTotal = typeof rawQuote.fare.surcharges === 'number'
      ? rawQuote.fare.surcharges
      : typeof (rawQuote.fare.surcharges as any)?.total === 'number'
        ? (rawQuote.fare.surcharges as any).total
        : 0;

    const perSeatTotal = baseFare + succeedingKm;
    const transportTotal = perSeatTotal * effectiveBilledSeats;
    const total = transportTotal + techFee + surchargeTotal;

    dynamicQuote = {
      ...rawQuote,
      passengerCount: effectiveRiderCount,
      billedSeats: effectiveBilledSeats,
      fare: {
        ...rawQuote.fare,
        baseFare: Number((baseFare * effectiveBilledSeats).toFixed(2)),
        succeedingKmCharge: Number((succeedingKm * effectiveBilledSeats).toFixed(2)),
        distanceFare: Number((succeedingKm * effectiveBilledSeats).toFixed(2)),
        techFee,
        surcharges: surchargeTotal,
        total: Number(total.toFixed(2)),
        perSeat: {
          baseFare: Number(baseFare.toFixed(2)),
          succeedingKmCharge: Number(succeedingKm.toFixed(2)),
          distanceFare: Number(succeedingKm.toFixed(2)),
          surchargeTotal: 0,
          transportFare: Number(perSeatTotal.toFixed(2)),
        },
      } as any,
    };
  }

  return {
    quote: dynamicQuote,
    isLoading: query.isLoading && !dynamicQuote,
    isFetching: query.isFetching,
    isError: query.isError && !dynamicQuote,
    error: query.error,
    refetch: query.refetch,
    canQuote,
  };
}
