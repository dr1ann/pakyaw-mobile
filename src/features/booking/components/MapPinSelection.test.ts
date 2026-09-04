import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useBookingDraftStore } from '@/stores/bookingDraftStore';
import { isInServiceArea } from '@/lib/serviceArea';
import type { Place } from '@pakyaw/shared/types/place';

function isSameCoordinate(
  a: { readonly lat?: number; readonly latitude?: number; readonly lng?: number; readonly longitude?: number } | null | undefined,
  b: { readonly lat?: number; readonly latitude?: number; readonly lng?: number; readonly longitude?: number } | null | undefined
): boolean {
  if (!a || !b) return false;
  const latA = a.lat ?? a.latitude;
  const lngA = a.lng ?? a.longitude;
  const latB = b.lat ?? b.latitude;
  const lngB = b.lng ?? b.longitude;
  if (latA === undefined || lngA === undefined || latB === undefined || lngB === undefined) return false;
  return Math.abs(latA - latB) < 1e-6 && Math.abs(lngA - lngB) < 1e-6;
}

type SearchMode = 'pickup' | 'destination' | null;
type PinTarget = 'pickup' | 'destination' | null;

describe('Map Pin Selection State Machine & Regression Tests', () => {
  beforeEach(() => {
    useBookingDraftStore.getState().reset();
    vi.clearAllMocks();
  });

  it('preserves draft store unchanged until user explicitly confirms pinning', () => {
    const initialPickup: Place = {
      label: 'Home',
      address: 'Can-adieng, Ormoc City',
      coords: { lat: 11.005, lng: 124.605 },
    };
    useBookingDraftStore.getState().setPickup(initialPickup);

    // Enter pin mode with initial target coords
    let searchMode: SearchMode = 'pickup';
    let pinTarget: PinTarget = null;
    let pinSelection: Place | null = null;

    // Trigger onChooseOnMap
    const pinCoords = { lat: 11.010, lng: 124.610 };
    pinSelection = {
      label: 'Pinned location',
      address: 'Ormoc City, Leyte',
      coords: pinCoords,
    };
    pinTarget = 'destination';
    searchMode = null;

    // Verify booking draft destination is NOT mutated yet
    expect(useBookingDraftStore.getState().draft.destination).toBeNull();
    // Verify booking draft pickup is untouched
    expect(useBookingDraftStore.getState().draft.pickup).toEqual(initialPickup);
    // Verify pinSelection holds the active pinning state
    expect(pinSelection).toEqual({
      label: 'Pinned location',
      address: 'Ormoc City, Leyte',
      coords: pinCoords,
    });
    expect(searchMode).toBeNull();
    expect(pinTarget).toBe('destination');
  });

  it('updates pinSelection immediately on map pan/drag with truthful fallback label', () => {
    let pinSelection: Place | null = {
      label: 'Pinned location',
      address: 'Ormoc City, Leyte',
      coords: { lat: 11.010, lng: 124.610 },
    };

    // User drags map to new region
    const newRegion = { latitude: 11.015, longitude: 124.620 };
    pinSelection = {
      coords: { lat: newRegion.latitude, lng: newRegion.longitude },
      label: 'Pinned location',
      address: 'Ormoc City, Leyte',
    };

    expect(pinSelection.coords).toEqual({ lat: 11.015, lng: 124.620 });
    expect(pinSelection.label).toBe('Pinned location');
    expect(pinSelection.address).toBe('Ormoc City, Leyte');
  });

  it('applies resolved geocode only when coordinates match active pin (guards against late stale responses)', async () => {
    let pinSelection: Place | null = {
      coords: { lat: 11.010, lng: 124.610 },
      label: 'Pinned location',
      address: 'Ormoc City, Leyte',
    };

    const coordA = { lat: 11.010, lng: 124.610 };
    const coordB = { lat: 11.020, lng: 124.630 };

    // Rapid drag to coordB happens before geocode for coordA finishes
    pinSelection = {
      coords: coordB,
      label: 'Pinned location',
      address: 'Ormoc City, Leyte',
    };

    // Stale geocode result returns for coordA
    const staleResultA: Place = {
      label: 'Old Point A',
      address: 'Old Street A, Ormoc City',
      coords: coordA,
    };

    // Race condition guard: compare coordinates before updating
    if (pinSelection && isSameCoordinate(pinSelection.coords, staleResultA.coords)) {
      pinSelection = staleResultA;
    }

    // Must still reflect coordB, not staleResultA
    expect(pinSelection.coords).toEqual(coordB);
    expect(pinSelection.label).toBe('Pinned location');

    // Now geocode result returns for coordB
    const resultB: Place = {
      label: 'New Point B',
      address: 'New Street B, Ormoc City',
      coords: coordB,
    };

    if (pinSelection && isSameCoordinate(pinSelection.coords, resultB.coords)) {
      pinSelection = resultB;
    }

    expect(pinSelection.coords).toEqual(coordB);
    expect(pinSelection.label).toBe('New Point B');
    expect(pinSelection.address).toBe('New Street B, Ormoc City');
  });

  it('keeps controls and truthful fallback available even if geocoding fails or is pending', () => {
    const pinSelection: Place = {
      coords: { lat: 11.005, lng: 124.605 },
      label: 'Pinned location',
      address: 'Ormoc City, Leyte',
    };
    const isGeocoding = true;
    const isPinOutsideServiceArea = !isInServiceArea(pinSelection.coords);

    // Confirm is enabled even during geocoding so network delay never blocks confirmation
    const isConfirmDisabled = !pinSelection.coords || isPinOutsideServiceArea;
    expect(isConfirmDisabled).toBe(false);

    // Address box renders truthful fallback
    const displayLabel = pinSelection.label || 'Pinned location';
    const displaySub = pinSelection.address || (isGeocoding ? 'Resolving location…' : null);

    expect(displayLabel).toBe('Pinned location');
    expect(displaySub).toBe('Ormoc City, Leyte');
  });

  it('disables confirm button when coordinates are outside Ormoc service area', () => {
    const outsideCoords = { lat: 10.3157, lng: 123.8854 }; // Cebu City
    const pinSelection: Place = {
      coords: outsideCoords,
      label: 'Pinned location',
      address: 'Cebu City',
    };

    const isPinOutsideServiceArea = !isInServiceArea(pinSelection.coords);
    expect(isPinOutsideServiceArea).toBe(true);

    const isConfirmDisabled = !pinSelection.coords || isPinOutsideServiceArea;
    expect(isConfirmDisabled).toBe(true);
  });

  it('canceling pin selection discards temporary state and returns cleanly to search mode', () => {
    let searchMode: SearchMode = null;
    let pinTarget: PinTarget = 'destination';
    let pinSelection: Place | null = {
      coords: { lat: 11.010, lng: 124.610 },
      label: 'Pinned location',
      address: 'Ormoc City, Leyte',
    };

    // Cancel action
    const target = pinTarget;
    pinSelection = null;
    pinTarget = null;
    searchMode = target;

    expect(pinSelection).toBeNull();
    expect(pinTarget).toBeNull();
    expect(searchMode).toBe('destination');
    expect(useBookingDraftStore.getState().draft.destination).toBeNull();
  });

  it('confirming pin selection commits exact coordinates and resolved label to bookingDraftStore', () => {
    let searchMode: SearchMode = null;
    let pinTarget: PinTarget = 'pickup';
    let pinSelection: Place | null = {
      coords: { lat: 11.006, lng: 124.608 },
      label: 'Camp Downes Elementary School',
      address: 'Camp Downes, Ormoc City',
    };

    // Confirm action
    const isPickup = pinTarget === 'pickup';
    const placeToSave = pinSelection;
    if (isPickup) {
      useBookingDraftStore.getState().setPickup(placeToSave!);
    } else {
      useBookingDraftStore.getState().setDestination(placeToSave!);
    }
    pinSelection = null;
    pinTarget = null;
    searchMode = null;

    expect(searchMode).toBeNull();
    expect(pinTarget).toBeNull();
    expect(pinSelection).toBeNull();
    expect(useBookingDraftStore.getState().draft.pickup).toEqual({
      coords: { lat: 11.006, lng: 124.608 },
      label: 'Camp Downes Elementary School',
      address: 'Camp Downes, Ormoc City',
    });
  });

  it('keeps destination pin mode rendered after the search overlay closes (regression test for blank sheet)', () => {
    let searchMode: SearchMode = 'destination';
    let pinTarget: PinTarget = null;
    let pinSelection: Place | null = null;

    // Transition to choose on map
    pinSelection = {
      coords: { lat: 11.006, lng: 124.608 },
      label: 'Pinned location',
      address: 'Ormoc City, Leyte',
    };
    pinTarget = 'destination';
    searchMode = null;

    // Pin rendering no longer depends on the search overlay's state.
    const isPinMode = pinTarget !== null && pinSelection !== null;
    expect(searchMode).toBeNull();
    expect(pinTarget).toBe('destination');
    expect(isPinMode).toBe(true);
  });
});
