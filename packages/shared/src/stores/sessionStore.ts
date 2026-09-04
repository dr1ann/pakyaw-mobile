import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { useActiveTripStore } from './activeTripStore';

export type SessionStatus = 'loading' | 'unauthenticated' | 'authenticated';
export type SessionRole = 'passenger' | 'driver' | null;

export type SessionState = {
  readonly status: SessionStatus;
  readonly uid: string | null;
  readonly role: SessionRole;
  readonly onboardingSeen: boolean;
  readonly signingIn: boolean;
  setSession: (uid: string, role: Exclude<SessionRole, null>) => void;
  clear: () => void;
  setStatus: (status: SessionStatus) => void;
  setOnboardingSeen: (value: boolean) => void;
  setSigningIn: (value: boolean) => void;
};

export type PersistedSessionState = Pick<SessionState, 'onboardingSeen'>;

export const SESSION_STORAGE_KEY = 'pakyaw:session';

export function getPersistedSessionState(
  state: SessionState,
): PersistedSessionState {
  return { onboardingSeen: state.onboardingSeen };
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      status: 'loading',
      uid: null,
      role: null,
      onboardingSeen: false,
      signingIn: false,
      setSession: (uid, role) => {
        const currentUid = get().uid;
        if (currentUid && currentUid !== uid) {
          useActiveTripStore.getState().clearTrip();
        }
        set({ status: 'authenticated', uid, role });
      },
      clear: () => {
        useActiveTripStore.getState().clearTrip();
        set({ status: 'unauthenticated', uid: null, role: null });
      },
      setStatus: (status) => set({ status }),
      setOnboardingSeen: (value) => set({ onboardingSeen: value }),
      setSigningIn: (value) => set({ signingIn: value }),
    }),
    {
      name: SESSION_STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: getPersistedSessionState,
      version: 1,
    },
  ),
);
