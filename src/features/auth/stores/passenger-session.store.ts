import { create } from 'zustand';
import type { UserDoc } from '@pakyaw/shared/features/auth/types';

export type PassengerSessionStatus =
  | 'idle'
  | 'unauthenticated'
  | 'resolving'
  | 'active'
  | 'suspended'
  | 'blocked'
  | 'needs_recovery'
  | 'error';

export interface PassengerSessionState {
  status: PassengerSessionStatus;
  uid: string | null;
  profile: UserDoc | null;
  errorMessage: string | null;

  beginResolving: (uid: string) => void;
  setActive: (uid: string, profile: UserDoc) => void;
  setSuspended: (uid: string, profile: UserDoc) => void;
  setBlocked: (uid: string, profile: UserDoc) => void;
  setNeedsRecovery: (uid: string) => void;
  setError: (uid: string, errorMessage: string) => void;
  clear: () => void;
}

export const usePassengerSessionStore = create<PassengerSessionState>((set) => ({
  status: 'idle',
  uid: null,
  profile: null,
  errorMessage: null,

  beginResolving: (uid: string) =>
    set({
      status: 'resolving',
      uid,
      errorMessage: null,
    }),

  setActive: (uid: string, profile: UserDoc) =>
    set({
      status: 'active',
      uid,
      profile,
      errorMessage: null,
    }),

  setSuspended: (uid: string, profile: UserDoc) =>
    set({
      status: 'suspended',
      uid,
      profile,
      errorMessage: null,
    }),

  setBlocked: (uid: string, profile: UserDoc) =>
    set({
      status: 'blocked',
      uid,
      profile,
      errorMessage: null,
    }),

  setNeedsRecovery: (uid: string) =>
    set({
      status: 'needs_recovery',
      uid,
      profile: null,
      errorMessage: null,
    }),

  setError: (uid: string, errorMessage: string) =>
    set({
      status: 'error',
      uid,
      profile: null,
      errorMessage,
    }),

  clear: () =>
    set({
      status: 'unauthenticated',
      uid: null,
      profile: null,
      errorMessage: null,
    }),
}));
