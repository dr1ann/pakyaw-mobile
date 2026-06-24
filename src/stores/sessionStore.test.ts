import { beforeEach, describe, expect, it } from 'vitest';

import { useSessionStore } from './sessionStore';

const initial = useSessionStore.getState();

beforeEach(() => {
  useSessionStore.setState({
    status: 'unauthenticated',
    uid: null,
    role: null,
    onboardingSeen: false,
  });
});

describe('sessionStore', () => {
  it('defaults to unauthenticated with no uid or role', () => {
    expect(initial.status).toBe('unauthenticated');
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
});
