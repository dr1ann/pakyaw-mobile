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

  const effectiveRiderCount = Math.max(1, draft.passengerCount);
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

  return {
    quote: query.data ?? null,
    isLoading: query.isLoading && !query.data,
    isFetching: query.isFetching,
    isError: query.isError && !query.data,
    error: query.error,
    refetch: query.refetch,
    canQuote,
  };
}
