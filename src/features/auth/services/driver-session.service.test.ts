import { describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

vi.mock('@/services/firebase/firebase', () => ({
  auth: { currentUser: null },
  firestore: {},
  doc: vi.fn(),
  getDoc: vi.fn(),
  signOut: vi.fn().mockResolvedValue(undefined),
}));

import type { UserDoc } from '@pakyaw/shared/features/auth/types';
import {
  driverSessionStatusForAuthUser,
  deriveDriverSessionStatus,
  isDriverApplicationState,
  isDriverWorkspaceState,
} from './driver-session.service';

const activeDriver = {
  uid: 'driver-uid',
  name: 'Driver',
  mobile: '+639171234567',
  role: 'driver',
  accountStatus: 'active',
  createdAt: {} as never,
  updatedAt: {} as never,
} satisfies UserDoc;

describe('Driver session state resolver', () => {
  it('routes no Firebase user to auth screens while an auth user starts resolution', () => {
    expect(driverSessionStatusForAuthUser(null)).toBe('unauthenticated');
    expect(driverSessionStatusForAuthUser({ uid: 'driver-uid' })).toBe('loading');
  });

  it('routes an authenticated user with no users doc to account recovery', () => {
    expect(deriveDriverSessionStatus(null, null)).toBe('authenticated_account_missing');
  });

  it('routes a non-driver account to a safe role error', () => {
    expect(deriveDriverSessionStatus({ ...activeDriver, role: 'passenger' }, null)).toBe(
      'authenticated_role_mismatch',
    );
  });

  it.each([
    ['suspended', 'account_suspended'],
    ['blocked', 'account_blocked'],
  ] as const)('routes an account with status %s to %s', (accountStatus, expected) => {
    expect(deriveDriverSessionStatus({ ...activeDriver, accountStatus }, null)).toBe(expected);
  });

  it('routes an active Driver with no application to onboarding', () => {
    expect(deriveDriverSessionStatus(activeDriver, null)).toBe(
      'authenticated_driver_application_missing',
    );
  });

  it.each([
    ['draft', 'driver_application_draft'],
    ['submitted', 'driver_application_submitted'],
    ['under_review', 'driver_application_submitted'],
    ['needs_correction', 'driver_application_needs_correction'],
    ['rejected', 'driver_application_rejected'],
    ['approved', 'driver_application_approved'],
  ] as const)('routes application status %s to %s', (applicationStatus, expected) => {
    expect(deriveDriverSessionStatus(activeDriver, { status: applicationStatus })).toBe(expected);
  });

  it('allows the operational workspace only for approved Drivers', () => {
    expect(isDriverWorkspaceState('driver_application_approved')).toBe(true);
    for (const status of [
      'loading',
      'unauthenticated',
      'authenticated_account_missing',
      'authenticated_role_mismatch',
      'authenticated_driver_application_missing',
      'driver_application_draft',
      'driver_application_submitted',
      'driver_application_needs_correction',
      'driver_application_rejected',
      'account_suspended',
      'account_blocked',
      'driver_session_error',
    ] as const) {
      expect(isDriverWorkspaceState(status)).toBe(false);
    }
  });

  it('marks only onboarding/application states as application flow', () => {
    expect(isDriverApplicationState('authenticated_driver_application_missing')).toBe(true);
    expect(isDriverApplicationState('driver_application_draft')).toBe(true);
    expect(isDriverApplicationState('driver_application_submitted')).toBe(true);
    expect(isDriverApplicationState('driver_application_needs_correction')).toBe(true);
    expect(isDriverApplicationState('driver_application_rejected')).toBe(true);
    expect(isDriverApplicationState('driver_application_approved')).toBe(false);
    expect(isDriverApplicationState('account_blocked')).toBe(false);
  });

  it('rejects a Passenger account, signs out from Firebase, and clears session store', async () => {
    const { getDoc, signOut } = await import('@/services/firebase/firebase');
    const { useSessionStore } = await import('@pakyaw/shared/stores/sessionStore');
    const { useDriverSessionStore } = await import('@/features/auth/stores/driver-session.store');
    const { resolveAndStoreDriverSession } = await import('./driver-session.service');

    (getDoc as any).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ ...activeDriver, role: 'passenger' }),
    });

    useSessionStore.getState().setSession('passenger-uid', 'driver');
    useDriverSessionStore.getState().setResolution({
      status: 'driver_application_approved',
      uid: 'passenger-uid',
      role: 'driver',
    });

    const resolution = await resolveAndStoreDriverSession('passenger-uid');

    expect(resolution.status).toBe('authenticated_role_mismatch');
    expect(signOut).toHaveBeenCalled();
    expect(useSessionStore.getState().status).toBe('unauthenticated');
    expect(useDriverSessionStore.getState().status).toBe('unauthenticated');
  });

  it('succeeds for a valid approved Driver account and sets active session', async () => {
    const { getDoc } = await import('@/services/firebase/firebase');
    const { useSessionStore } = await import('@pakyaw/shared/stores/sessionStore');
    const { useDriverSessionStore } = await import('@/features/auth/stores/driver-session.store');
    const { resolveAndStoreDriverSession } = await import('./driver-session.service');

    (getDoc as any)
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => activeDriver,
      })
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ status: 'approved' }),
      });

    const resolution = await resolveAndStoreDriverSession('driver-uid');

    expect(resolution.status).toBe('driver_application_approved');
    expect(useSessionStore.getState().status).toBe('authenticated');
    expect(useSessionStore.getState().role).toBe('driver');
    expect(useDriverSessionStore.getState().status).toBe('driver_application_approved');
  });

  it('rejects an unregistered phone (missing users/{uid}), signs out from Firebase, and clears session', async () => {
    const { getDoc, signOut } = await import('@/services/firebase/firebase');
    const { useSessionStore } = await import('@pakyaw/shared/stores/sessionStore');
    const { useDriverSessionStore } = await import('@/features/auth/stores/driver-session.store');
    const { resolveAndStoreDriverSession } = await import('./driver-session.service');

    (getDoc as any).mockResolvedValueOnce({
      exists: () => false,
    });

    useSessionStore.getState().setSession('unregistered-uid', 'driver');
    useDriverSessionStore.getState().setResolution({
      status: 'driver_application_approved',
      uid: 'unregistered-uid',
      role: 'driver',
    });

    const resolution = await resolveAndStoreDriverSession('unregistered-uid');

    expect(resolution.status).toBe('authenticated_account_missing');
    expect(signOut).toHaveBeenCalled();
    expect(useSessionStore.getState().status).toBe('unauthenticated');
    expect(useDriverSessionStore.getState().status).toBe('unauthenticated');
  });
});
