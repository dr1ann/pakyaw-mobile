import { beforeEach, describe, expect, it } from 'vitest';
import { useBookingDraftStore } from './bookingDraftStore';

describe('bookingDraftStore', () => {
  beforeEach(() => {
    useBookingDraftStore.getState().reset();
  });

  it('initializes with default state', () => {
    const state = useBookingDraftStore.getState().draft;
    expect(state.pickup).toBeNull();
    expect(state.destination).toBeNull();
    expect(state.passengerCount).toBe(4); // MIN_SEATS
    expect(state.route).toBeNull();
  });

  it('allows setting pickup and resets route', () => {
    const store = useBookingDraftStore.getState();
    
    // Set a route first
    store.setRoute({
      distanceMeters: 1000,
      durationSeconds: 120,
      polyline: 'abc',
    });
    
    expect(useBookingDraftStore.getState().draft.route).not.toBeNull();

    const mockPlace = {
      label: 'Ormoc City Hall',
      coords: { lat: 11.0050, lng: 124.6075 },
    };

    store.setPickup(mockPlace);
    
    const state = useBookingDraftStore.getState().draft;
    expect(state.pickup).toEqual(mockPlace);
    expect(state.route).toBeNull(); // Should be reset
  });

  it('allows setting destination and resets route', () => {
    const store = useBookingDraftStore.getState();
    
    // Set a route first
    store.setRoute({
      distanceMeters: 1000,
      durationSeconds: 120,
      polyline: 'abc',
    });

    const mockPlace = {
      label: 'Ormoc Superdome',
      coords: { lat: 11.0070, lng: 124.6090 },
    };

    store.setDestination(mockPlace);
    
    const state = useBookingDraftStore.getState().draft;
    expect(state.destination).toEqual(mockPlace);
    expect(state.route).toBeNull(); // Should be reset
  });

  it('allows setting passengerCount', () => {
    const store = useBookingDraftStore.getState();
    
    store.setPassengerCount(5);
    expect(useBookingDraftStore.getState().draft.passengerCount).toBe(5);

    // Clamping checks
    store.setPassengerCount(7);
    expect(useBookingDraftStore.getState().draft.passengerCount).toBe(6); // Clamped max

    store.setPassengerCount(2);
    expect(useBookingDraftStore.getState().draft.passengerCount).toBe(4); // Clamped min
  });

  it('allows setting route', () => {
    const store = useBookingDraftStore.getState();
    const route = {
      distanceMeters: 2500,
      durationSeconds: 400,
      polyline: 'xyz_encoded',
    };

    store.setRoute(route);
    expect(useBookingDraftStore.getState().draft.route).toEqual(route);
  });

  it('resets to initial state', () => {
    const store = useBookingDraftStore.getState();
    
    store.setPickup({ label: 'A', coords: { lat: 1, lng: 1 } });
    store.setDestination({ label: 'B', coords: { lat: 2, lng: 2 } });
    store.setPassengerCount(5);
    store.setRoute({ distanceMeters: 10, durationSeconds: 2, polyline: 'p' });

    store.reset();

    const state = useBookingDraftStore.getState().draft;
    expect(state.pickup).toBeNull();
    expect(state.destination).toBeNull();
    expect(state.passengerCount).toBe(4);
    expect(state.route).toBeNull();
  });
});
