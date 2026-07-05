import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getPersistedSessionState,
  useSessionStore,
  type SessionState,
} from './sessionStore';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

const initial = useSessionStore.getState();

beforeEach(() => {
  useSessionStore.setState({
    status: 'unauthenticated',
    uid: null,
    role: null,
    onboardingSeen: false,
    signingIn: false,
  });
});

describe('sessionStore', () => {
  it('defaults to loading with no uid or role', () => {
    expect(initial.status).toBe('loading');
    expect(initial.uid).toBeNull();
    expect(initial.role).toBeNull();
    expect(initial.onboardingSeen).toBe(false);
  });

  it('setSession promotes to authenticated with uid and role', () => {
    useSessionStore.getState().setSession('uid-1', 'passenger');
    const s = useSessionStore.getState();
    expect(s.status).toBe('authenticated');
    expect(s.uid).toBe('uid-1');
    expect(s.role).toBe('passenger');
  });

  it('clear resets to unauthenticated and drops uid/role', () => {
    useSessionStore.getState().setSession('uid-2', 'driver');
    useSessionStore.getState().clear();
    const s = useSessionStore.getState();
    expect(s.status).toBe('unauthenticated');
    expect(s.uid).toBeNull();
    expect(s.role).toBeNull();
  });

  it('setOnboardingSeen toggles independently of auth', () => {
    useSessionStore.getState().setOnboardingSeen(true);
    expect(useSessionStore.getState().onboardingSeen).toBe(true);
    expect(useSessionStore.getState().status).toBe('unauthenticated');
  });

  it('setStatus can move into loading', () => {
    useSessionStore.getState().setStatus('loading');
    expect(useSessionStore.getState().status).toBe('loading');
  });

  it('persists only onboardingSeen', () => {
    const state = {
      ...useSessionStore.getState(),
      status: 'authenticated',
      uid: 'uid-3',
      role: 'passenger',
      onboardingSeen: true,
      signingIn: true,
    } as SessionState;

    expect(getPersistedSessionState(state)).toEqual({ onboardingSeen: true });
  });
});
