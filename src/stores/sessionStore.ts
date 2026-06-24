import { create } from 'zustand';

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

export const useSessionStore = create<SessionState>((set) => ({
  status: 'loading',
  uid: null,
  role: null,
  onboardingSeen: false,
  signingIn: false,
  setSession: (uid, role) => set({ status: 'authenticated', uid, role }),
  clear: () => set({ status: 'unauthenticated', uid: null, role: null }),
  setStatus: (status) => set({ status }),
  setOnboardingSeen: (value) => set({ onboardingSeen: value }),
  setSigningIn: (value) => set({ signingIn: value }),
}));
