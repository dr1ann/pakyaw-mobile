import { create } from 'zustand';

import { clamp, MIN_SEATS } from '@/lib/seatModel';
import type { Place } from '@/features/booking/types';

export type BookingDraft = {
  readonly pickup: Place | null;
  readonly destination: Place | null;
  readonly passengerCount: number;
};

export type BookingDraftState = {
  readonly draft: BookingDraft;
  setPickup: (pickup: Place | null) => void;
  setDestination: (destination: Place | null) => void;
  setPassengerCount: (count: number) => void;
  reset: () => void;
};

const emptyDraft: BookingDraft = {
  pickup: null,
  destination: null,
  passengerCount: MIN_SEATS,
};

export const useBookingDraftStore = create<BookingDraftState>((set) => ({
  draft: emptyDraft,
  setPickup: (pickup) => set((state) => ({ draft: { ...state.draft, pickup } })),
  setDestination: (destination) => set((state) => ({ draft: { ...state.draft, destination } })),
  setPassengerCount: (count) =>
    set((state) => ({ draft: { ...state.draft, passengerCount: clamp(count) } })),
  reset: () => set({ draft: emptyDraft }),
}));
