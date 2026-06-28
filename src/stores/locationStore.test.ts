import { beforeEach, describe, expect, it } from 'vitest';
import { useLocationStore } from './locationStore';

describe('locationStore', () => {
  beforeEach(() => {
    useLocationStore.getState().reset();
  });

  it('initializes with default state', () => {
    const state = useLocationStore.getState();
    expect(state.location).toBeNull();
    expect(state.permissionStatus).toBeNull();
  });

  it('allows setting location', () => {
    const store = useLocationStore.getState();
    const mockLocation = {
      latitude: 11.0050,
      longitude: 124.6075,
      heading: 90,
      accuracy: 5,
      timestamp: 1620000000000,
    };

    store.setLocation(mockLocation);
    
    const state = useLocationStore.getState();
    expect(state.location).toEqual(mockLocation);
  });

  it('allows setting permission status', () => {
    const store = useLocationStore.getState();
    
    store.setPermissionStatus('granted');
    expect(useLocationStore.getState().permissionStatus).toBe('granted');

    store.setPermissionStatus('denied');
    expect(useLocationStore.getState().permissionStatus).toBe('denied');
  });

  it('resets to initial state', () => {
    const store = useLocationStore.getState();
    
    store.setLocation({
      latitude: 11.0050,
      longitude: 124.6075,
      heading: 90,
      accuracy: 5,
      timestamp: 1620000000000,
    });
    store.setPermissionStatus('granted');

    store.reset();

    const state = useLocationStore.getState();
    expect(state.location).toBeNull();
    expect(state.permissionStatus).toBeNull();
  });
});
