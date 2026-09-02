import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type {
  DriverSessionResolution,
  DriverSessionStatus,
} from '@/features/auth/services/driver-session.service';

export type PendingDriverSetup = {
  readonly legalName: {
    readonly firstName: string;
    readonly middleName?: string;
    readonly lastName: string;
    readonly suffix?: string;
  };
  readonly termsAccepted: boolean;
  readonly privacyAccepted: boolean;
};

export type DriverSessionState = {
  readonly status: DriverSessionStatus;
  readonly uid: string | null;
  readonly role: 'driver' | 'passenger' | null;
  readonly pendingSetup: PendingDriverSetup | null;
  beginResolving: (uid: string) => void;
  setResolution: (resolution: DriverSessionResolution) => void;
  setResolutionError: (uid: string) => void;
  setPendingSetup: (setup: PendingDriverSetup) => void;
  clearPendingSetup: () => void;
  clear: () => void;
};

export const DRIVER_SESSION_STORAGE_KEY = 'pakyaw:driver-session';

export type PersistedDriverSessionState = Pick<DriverSessionState, 'pendingSetup'>;

export function getPersistedDriverSessionState(
  state: DriverSessionState,
): PersistedDriverSessionState {
  return { pendingSetup: state.pendingSetup };
}

export const useDriverSessionStore = create<DriverSessionState>()(
  persist(
    (set) => ({
      status: 'loading',
      uid: null,
      role: null,
      pendingSetup: null,
      beginResolving: (uid) => set({ status: 'loading', uid, role: null }),
      setResolution: ({ status, uid, role }) => set({ status, uid, role }),
      setResolutionError: (uid) => set({ status: 'driver_session_error', uid, role: null }),
      setPendingSetup: (pendingSetup) => set({ pendingSetup }),
      clearPendingSetup: () => set({ pendingSetup: null }),
      clear: () => set({ status: 'unauthenticated', uid: null, role: null, pendingSetup: null }),
    }),
    {
      name: DRIVER_SESSION_STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: getPersistedDriverSessionState,
      version: 1,
    },
  ),
);

export function useDriverSession() {
  const status = useDriverSessionStore((state) => state.status);
  const uid = useDriverSessionStore((state) => state.uid);
  const role = useDriverSessionStore((state) => state.role);
  const pendingSetup = useDriverSessionStore((state) => state.pendingSetup);
  return { status, uid, role, pendingSetup };
}
