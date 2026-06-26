import { create } from 'zustand';

import { clamp, MIN_SEATS } from '@/lib/seatModel';
import type { Place } from '@/features/booking/types';

export type BookingDraft = {
  readonly pickup: Place | null;
  readonly destination: Place | null;
  readonly passengerCount: number;
  readonly route: {
    readonly distanceMeters: number;
    readonly durationSeconds: number;
    readonly polyline: string;
  } | null;
};

export type BookingDraftState = {
  readonly draft: BookingDraft;
  setPickup: (pickup: Place | null) => void;
  setDestination: (destination: Place | null) => void;
  setPassengerCount: (count: number) => void;
  setRoute: (
    route: {
      readonly distanceMeters: number;
      readonly durationSeconds: number;
      readonly polyline: string;
    } | null
  ) => void;
  reset: () => void;
};

const emptyDraft: BookingDraft = {
  pickup: null,
  destination: null,
  passengerCount: MIN_SEATS,
  route: null,
};

export const useBookingDraftStore = create<BookingDraftState>((set) => ({
  draft: emptyDraft,
  setPickup: (pickup) =>
    set((state) => ({
      draft: { ...state.draft, pickup, route: null },
    })),
  setDestination: (destination) =>
    set((state) => ({
      draft: { ...state.draft, destination, route: null },
    })),
  setPassengerCount: (count) =>
    set((state) => ({ draft: { ...state.draft, passengerCount: clamp(count) } })),
  setRoute: (route) =>
    set((state) => ({
      draft: { ...state.draft, route },
    })),
  reset: () => set({ draft: emptyDraft }),
}));
