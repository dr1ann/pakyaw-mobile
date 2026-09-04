import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDoc = vi.fn((_fs, _col, id) => ({ path: `users/${id}`, id }));
const mockGetDoc = vi.fn();

vi.mock('@/services/firebase/firebase', () => ({
  auth: { currentUser: null },
  firestore: {},
  doc: (first: any, ...rest: string[]) => (mockDoc as any)(first, ...rest),
  getDoc: (docRef: any) => mockGetDoc(docRef),
}));

import {
  resolvePassengerSession,
  storePassengerSessionResolution,
} from './passenger-session.service';
import { usePassengerSessionStore } from '@/features/auth/stores/passenger-session.store';
import { useSessionStore } from '@pakyaw/shared/stores/sessionStore';

describe('passenger-session.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePassengerSessionStore.getState().clear();
    useSessionStore.getState().clear();
  });

  describe('resolvePassengerSession', () => {
    it('returns needs_recovery when user doc does not exist', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });

      const result = await resolvePassengerSession('uid-missing');
      expect(result).toEqual({ status: 'needs_recovery', uid: 'uid-missing' });
    });

    it('returns invalid_role when user role is not passenger', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ role: 'driver', accountStatus: 'active' }),
      });

      const result = await resolvePassengerSession('uid-driver');
      expect(result).toEqual({ status: 'invalid_role', uid: 'uid-driver', role: 'driver' });
    });

    it('returns suspended when accountStatus is suspended', async () => {
      const profile = { uid: 'uid-susp', role: 'passenger', accountStatus: 'suspended', name: 'User' };
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => profile,
      });

      const result = await resolvePassengerSession('uid-susp');
      expect(result).toEqual({ status: 'suspended', uid: 'uid-susp', profile });
    });

    it('returns blocked when accountStatus is blocked', async () => {
      const profile = { uid: 'uid-block', role: 'passenger', accountStatus: 'blocked', name: 'User' };
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => profile,
      });

      const result = await resolvePassengerSession('uid-block');
      expect(result).toEqual({ status: 'blocked', uid: 'uid-block', profile });
    });

    it('returns active when accountStatus is active', async () => {
      const profile = { uid: 'uid-act', role: 'passenger', accountStatus: 'active', name: 'Active User' };
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => profile,
      });

      const result = await resolvePassengerSession('uid-act');
      expect(result).toEqual({ status: 'active', uid: 'uid-act', profile });
    });
  });

  describe('storePassengerSessionResolution', () => {
    it('stores active session in stores', () => {
      const profile = { uid: 'uid-1', role: 'passenger' as const, accountStatus: 'active' as const, name: 'User', mobile: '+639171234567', createdAt: {} as any, updatedAt: {} as any };
      storePassengerSessionResolution({ status: 'active', uid: 'uid-1', profile });

      expect(usePassengerSessionStore.getState().status).toBe('active');
      expect(usePassengerSessionStore.getState().uid).toBe('uid-1');
      expect(useSessionStore.getState().status).toBe('authenticated');
      expect(useSessionStore.getState().role).toBe('passenger');
    });

    it('stores suspended session in stores', () => {
      const profile = { uid: 'uid-2', role: 'passenger' as const, accountStatus: 'suspended' as const, name: 'User', mobile: '+639171234567', createdAt: {} as any, updatedAt: {} as any };
      storePassengerSessionResolution({ status: 'suspended', uid: 'uid-2', profile });

      expect(usePassengerSessionStore.getState().status).toBe('suspended');
      expect(useSessionStore.getState().status).toBe('unauthenticated');
    });

    it('clears stores when resolution is invalid_role', () => {
      useSessionStore.getState().setSession('uid-driver', 'passenger');
      usePassengerSessionStore.getState().setActive('uid-driver', {} as any);

      storePassengerSessionResolution({ status: 'invalid_role', uid: 'uid-driver', role: 'driver' });

      expect(usePassengerSessionStore.getState().status).toBe('unauthenticated');
      expect(useSessionStore.getState().status).toBe('unauthenticated');
    });

    it('clears stores when resolution is needs_recovery (missing account document)', () => {
      useSessionStore.getState().setSession('uid-missing', 'passenger');
      usePassengerSessionStore.getState().setActive('uid-missing', {} as any);

      storePassengerSessionResolution({ status: 'needs_recovery', uid: 'uid-missing' });

      expect(usePassengerSessionStore.getState().status).toBe('unauthenticated');
      expect(useSessionStore.getState().status).toBe('unauthenticated');
    });
  });
});
