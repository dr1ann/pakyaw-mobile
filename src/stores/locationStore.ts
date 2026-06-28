import { create } from 'zustand';

export type DeviceLocation = {
  readonly latitude: number;
  readonly longitude: number;
  readonly heading: number | null;
  readonly accuracy: number | null;
  readonly timestamp: number | null;
};

export type LocationPermissionStatus = 'granted' | 'denied' | 'undetermined' | null;

export type LocationState = {
  readonly location: DeviceLocation | null;
  readonly permissionStatus: LocationPermissionStatus;
  
  // Actions
  setLocation: (location: DeviceLocation | null) => void;
  setPermissionStatus: (status: LocationPermissionStatus) => void;
  reset: () => void;
};

const initialState = {
  location: null,
  permissionStatus: null,
};

export const useLocationStore = create<LocationState>((set) => ({
  ...initialState,
  setLocation: (location) => set({ location }),
  setPermissionStatus: (permissionStatus) => set({ permissionStatus }),
  reset: () => set(initialState),
}));
