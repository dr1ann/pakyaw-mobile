import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DriverAccountNotReadyError,
  PresenceWriteError,
} from '@/features/driver-availability/errors';
import { goOffline, goOnline } from '@/features/driver-availability/services/presence.service';
import { httpsCallable } from '@/services/firebase/firebase';

vi.mock('@/services/firebase/firebase', () => {
  const callableMock = vi.fn();
  return {
    functions: {},
    httpsCallable: vi.fn(() => callableMock),
    FirebaseError: class extends Error {
      code: string;
      constructor(code: string, message: string) {
        super(message);
        this.code = code;
      }
    },
  };
});

vi.mock('@pakyaw/shared/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('presence.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('goOnline invokes setDriverAvailability with online payload', async () => {
    const callableMock = vi.fn().mockResolvedValue({ data: { availability: 'online' } });
    vi.mocked(httpsCallable).mockReturnValue(callableMock as any);

    await expect(goOnline('driver-123')).resolves.toBeUndefined();
    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'setDriverAvailability');
    expect(callableMock).toHaveBeenCalledWith({ driverId: 'driver-123', availability: 'online' });
  });

  it('goOffline invokes setDriverAvailability with offline payload', async () => {
    const callableMock = vi.fn().mockResolvedValue({ data: { availability: 'offline' } });
    vi.mocked(httpsCallable).mockReturnValue(callableMock as any);

    await expect(goOffline('driver-123')).resolves.toBeUndefined();
    expect(callableMock).toHaveBeenCalledWith({ driverId: 'driver-123', availability: 'offline' });
  });

  it('translates failed-precondition with reason into DriverAccountNotReadyError', async () => {
    const callableMock = vi.fn().mockRejectedValue({
      code: 'functions/failed-precondition',
      message: 'Cannot go online: documents_incomplete.',
    });
    vi.mocked(httpsCallable).mockReturnValue(callableMock as any);

    await expect(goOnline('driver-123')).rejects.toBeInstanceOf(DriverAccountNotReadyError);
  });

  it('translates generic network errors into PresenceWriteError', async () => {
    const callableMock = vi.fn().mockRejectedValue(new Error('Network error'));
    vi.mocked(httpsCallable).mockReturnValue(callableMock as any);

    await expect(goOffline('driver-123')).rejects.toBeInstanceOf(PresenceWriteError);
  });
});
