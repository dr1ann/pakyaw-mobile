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

  it('allows setting bookingFor, riderFirstName, and pickupNote', () => {
    const store = useBookingDraftStore.getState();
    expect(store.draft.bookingFor).toBe('self');
    expect(store.draft.riderFirstName).toBe('');
    expect(store.draft.pickupNote).toBe('');

    store.setBookingFor('other');
    store.setRiderFirstName('Anna');
    store.setPickupNote('Waiting by the pharmacy');

    const state = useBookingDraftStore.getState().draft;
    expect(state.bookingFor).toBe('other');
    expect(state.riderFirstName).toBe('Anna');
    expect(state.pickupNote).toBe('Waiting by the pharmacy');

    // Switching ride mode preserves bookingFor choice and rider data
    store.setRideMode('shared');
    expect(useBookingDraftStore.getState().draft.bookingFor).toBe('other');
    expect(useBookingDraftStore.getState().draft.riderFirstName).toBe('Anna');
    expect(useBookingDraftStore.getState().draft.pickupNote).toBe('Waiting by the pharmacy');
  });

  it('resets to initial state', () => {
    const store = useBookingDraftStore.getState();

    store.setPickup({ label: 'A', coords: { lat: 1, lng: 1 } });
    store.setDestination({ label: 'B', coords: { lat: 2, lng: 2 } });
    store.setPassengerCount(5);
    store.setRoute({ distanceMeters: 10, durationSeconds: 2, polyline: 'p' });
    store.setBookingFor('other');
    store.setRiderFirstName('Anna');
    store.setPickupNote('Waiting near Gate 2');

    store.reset();

    const state = useBookingDraftStore.getState().draft;
    expect(state.pickup).toBeNull();
    expect(state.destination).toBeNull();
    expect(state.passengerCount).toBe(1);
    expect(state.route).toBeNull();
    expect(state.bookingFor).toBe('self');
    expect(state.riderFirstName).toBe('');
    expect(state.pickupNote).toBe('');
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

  it('guarantees atomic pickup update: moving pin from A to B replaces coordinates and old label', () => {
    // 1. Initial location A (e.g. Linao)
    useBookingDraftStore.getState().setPickup({
      label: 'Linao',
      coords: { lat: 11.0345, lng: 124.6012 },
      address: 'Linao, Ormoc City',
    });

    expect(useBookingDraftStore.getState().draft.pickup?.label).toBe('Linao');
    expect(useBookingDraftStore.getState().draft.pickup?.coords).toEqual({ lat: 11.0345, lng: 124.6012 });

    // 2. Move pin to location B (e.g. Camp Downes) - old label 'Linao' cannot remain
    const locationB = {
      label: 'Pinned location',
      coords: { lat: 10.9959, lng: 124.6183 },
      address: 'Camp Downes, Ormoc City',
    };
    useBookingDraftStore.getState().setPickup(locationB);

    expect(useBookingDraftStore.getState().draft.pickup?.coords).toEqual({ lat: 10.9959, lng: 124.6183 });
    expect(useBookingDraftStore.getState().draft.pickup?.label).toBe('Pinned location');
    expect(useBookingDraftStore.getState().draft.pickup?.label).not.toBe('Linao');
  });

  it('preserves atomic place consistency when autocomplete place is overridden by manual pin', () => {
    // 1. Autocomplete selection (Robinsons)
    useBookingDraftStore.getState().setPickup({
      label: 'Robinsons Place Ormoc',
      coords: { lat: 11.0254, lng: 124.6050 },
      address: 'Brgy. Cogon, Ormoc City',
    });

    expect(useBookingDraftStore.getState().draft.pickup?.label).toBe('Robinsons Place Ormoc');

    // 2. Manual pin override
    useBookingDraftStore.getState().setPickup({
      label: 'Pinned location, Ormoc City',
      coords: { lat: 11.0051, lng: 124.6076 },
    });

    expect(useBookingDraftStore.getState().draft.pickup?.coords).toEqual({ lat: 11.0051, lng: 124.6076 });
    expect(useBookingDraftStore.getState().draft.pickup?.label).toBe('Pinned location, Ormoc City');
    expect(useBookingDraftStore.getState().draft.pickup?.label).not.toBe('Robinsons Place Ormoc');
  });

  it('guarantees trip restoration restores pickup label and coordinates from same trip snapshot', () => {
    const tripSnapshot = {
      pickup: {
        label: 'Camp Downes',
        coords: { lat: 10.9959, lng: 124.6183 },
      },
      destination: {
        label: 'SM Center Ormoc',
        coords: { lat: 11.0108, lng: 124.6077 },
      },
    };

    useBookingDraftStore.getState().setPickup(tripSnapshot.pickup);
    useBookingDraftStore.getState().setDestination(tripSnapshot.destination);

    expect(useBookingDraftStore.getState().draft.pickup?.label).toBe('Camp Downes');
    expect(useBookingDraftStore.getState().draft.pickup?.coords).toEqual({ lat: 10.9959, lng: 124.6183 });
  });
});
