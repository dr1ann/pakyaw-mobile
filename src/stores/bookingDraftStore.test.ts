import { beforeEach, describe, expect, it } from 'vitest';
import { useBookingDraftStore, routeMatchesInputs } from './bookingDraftStore';

describe('bookingDraftStore', () => {
  beforeEach(() => {
    useBookingDraftStore.getState().reset();
  });

  it('initializes with default state', () => {
    const state = useBookingDraftStore.getState().draft;
    expect(state.pickup).toBeNull();
    expect(state.destination).toBeNull();
    expect(state.passengerCount).toBe(1); // MIN_SEATS
    expect(state.route).toBeNull();
  });

  it('allows setting pickup and retains route', () => {
    const store = useBookingDraftStore.getState();
    
    // Set a route first
    const mockRoute = {
      distanceMeters: 1000,
      durationSeconds: 120,
      polyline: 'abc',
    };
    store.setRoute(mockRoute);
    
    expect(useBookingDraftStore.getState().draft.route).not.toBeNull();

    const mockPlace = {
      label: 'Ormoc City Hall',
      coords: { lat: 11.0050, lng: 124.6075 },
    };

    store.setPickup(mockPlace);
    
    const state = useBookingDraftStore.getState().draft;
    expect(state.pickup).toEqual(mockPlace);
    expect(state.route).toEqual(mockRoute); // Should be retained
  });

  it('allows setting destination and retains route', () => {
    const store = useBookingDraftStore.getState();
    
    // Set a route first
    const mockRoute = {
      distanceMeters: 1000,
      durationSeconds: 120,
      polyline: 'abc',
    };
    store.setRoute(mockRoute);

    const mockPlace = {
      label: 'Ormoc Superdome',
      coords: { lat: 11.0070, lng: 124.6090 },
    };

    store.setDestination(mockPlace);
    
    const state = useBookingDraftStore.getState().draft;
    expect(state.destination).toEqual(mockPlace);
    expect(state.route).toEqual(mockRoute); // Should be retained
  });

  it('allows setting passengerCount', () => {
    const store = useBookingDraftStore.getState();
    
    store.setPassengerCount(5);
    expect(useBookingDraftStore.getState().draft.passengerCount).toBe(5);

    // Clamping checks
    store.setPassengerCount(7);
    expect(useBookingDraftStore.getState().draft.passengerCount).toBe(6); // Clamped max

    store.setPassengerCount(2);
    expect(useBookingDraftStore.getState().draft.passengerCount).toBe(2);

    store.setPassengerCount(0);
    expect(useBookingDraftStore.getState().draft.passengerCount).toBe(1); // Clamped min
  });

  it('handles setRideMode transitions and passengerCount invariants', () => {
    const store = useBookingDraftStore.getState();

    // Start in private with 5 passengers
    store.setPassengerCount(5);
    expect(useBookingDraftStore.getState().draft.passengerCount).toBe(5);

    // Switch to shared -> count resets to 1 because 5 > 3
    store.setRideMode('shared');
    expect(useBookingDraftStore.getState().draft.rideMode).toBe('shared');
    expect(useBookingDraftStore.getState().draft.passengerCount).toBe(1);

    // Increase to 2 in shared
    store.setPassengerCount(2);
    expect(useBookingDraftStore.getState().draft.passengerCount).toBe(2);

    // Switch to hopon -> count resets to 1 (Hop invariant)
    store.setRideMode('hopon');
    expect(useBookingDraftStore.getState().draft.rideMode).toBe('hopon');
    expect(useBookingDraftStore.getState().draft.passengerCount).toBe(1);

    // Switch back to private
    store.setRideMode('private');
    expect(useBookingDraftStore.getState().draft.rideMode).toBe('private');
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
    expect(state.passengerCount).toBe(1);
    expect(state.route).toBeNull();
  });
});

describe('routeMatchesInputs', () => {
  beforeEach(() => {
    useBookingDraftStore.getState().reset();
  });

  const pickup = { label: 'P', coords: { lat: 11.0, lng: 124.6 } };
  const destination = { label: 'D', coords: { lat: 11.02, lng: 124.61 } };

  it('returns false when there is no route', () => {
    expect(routeMatchesInputs(useBookingDraftStore.getState().draft)).toBe(false);
  });

  it('treats a sourceless (legacy/manual) route as matching', () => {
    const store = useBookingDraftStore.getState();
    store.setRoute({ distanceMeters: 1000, durationSeconds: 120, polyline: 'abc' });
    expect(routeMatchesInputs(useBookingDraftStore.getState().draft)).toBe(true);
  });

  it('matches a route whose source equals the current inputs', () => {
    const store = useBookingDraftStore.getState();
    store.setPickup(pickup);
    store.setDestination(destination);
    store.setRoute({
      distanceMeters: 1000,
      durationSeconds: 120,
      polyline: 'abc',
      source: { pickup: pickup.coords, destination: destination.coords },
    });
    expect(routeMatchesInputs(useBookingDraftStore.getState().draft)).toBe(true);
  });

  it('detects a stale route after the pickup moves to a different place', () => {
    const store = useBookingDraftStore.getState();
    store.setPickup(pickup);
    store.setDestination(destination);
    store.setRoute({
      distanceMeters: 1000,
      durationSeconds: 120,
      polyline: 'abc',
      source: { pickup: pickup.coords, destination: destination.coords },
    });

    // User changes pickup; the retained route's origin no longer matches.
    store.setPickup({ label: 'Elsewhere', coords: { lat: 11.05, lng: 124.55 } });

    expect(routeMatchesInputs(useBookingDraftStore.getState().draft)).toBe(false);
  });
});
