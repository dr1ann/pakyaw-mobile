import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CancelNotAllowedError,
  IllegalTransitionError,
  TripNotFoundError,
} from '@pakyaw/shared/features/trip/errors';
import type { TripStatus } from '@pakyaw/shared/features/trip/types';
import { ALLOWED_TRANSITIONS, CANCELLABLE_STATUSES } from '@pakyaw/shared/features/trip/types';

// ─── Mock Firestore ──────────────────────────────────────────────────────────

let mockTripData: Record<string, unknown> | null = null;
let mockDriverData: Record<string, unknown> | null = null;
const mockTxGet = vi.fn();
const mockTxUpdate = vi.fn();
const mockTxDelete = vi.fn();
const mockUpdateDoc = vi.fn();

vi.mock('firebase/firestore', () => {
  return {
    doc: vi.fn((_fs, collection, id) => ({ collection, id })),
    increment: vi.fn((n: number) => ({ __increment: n })),
    onSnapshot: vi.fn(),
    runTransaction: vi.fn(async (_fs, fn) => {
      const tx = {
        get: mockTxGet,
        update: mockTxUpdate,
        delete: mockTxDelete,
      };
      await fn(tx);
    }),
    serverTimestamp: vi.fn(() => ({ __serverTimestamp: true })),
    updateDoc: mockUpdateDoc,
  };
});

vi.mock('@/services/firebase/firebase', () => ({
  firestore: {},
}));

vi.mock('@pakyaw/shared/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

function setupMocks(tripData: Record<string, unknown> | null, driverData?: Record<string, unknown> | null) {
  mockTripData = tripData;
  mockDriverData = driverData ?? { availability: 'on_trip', activeTripId: 'trip-1' };

  mockTxGet.mockImplementation((ref: { collection: string }) => {
    if (ref.collection === 'trips') {
      return {
        exists: () => mockTripData !== null,
        data: () => mockTripData,
      };
    }
    if (ref.collection === 'drivers') {
      return {
        exists: () => mockDriverData !== null,
        data: () => mockDriverData,
      };
    }
    return { exists: () => false, data: () => null };
  });
}

describe('trip.service — transition()', () => {
  let transition: typeof import('@pakyaw/shared/features/trip/services/trip.service').transition;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('@pakyaw/shared/features/trip/services/trip.service');
    transition = mod.transition;
  });

  it('rejects transition to "request"', async () => {
    await expect(transition('trip-1', 'request')).rejects.toThrow(
      IllegalTransitionError,
    );
    expect(mockTxUpdate).not.toHaveBeenCalled();
  });

  it('rejects transition to "accepted" (belongs to Phase 7)', async () => {
    await expect(transition('trip-1', 'accepted')).rejects.toThrow(
      IllegalTransitionError,
    );
    expect(mockTxUpdate).not.toHaveBeenCalled();
  });

  it('throws TripNotFoundError for missing trip', async () => {
    setupMocks(null);
    await expect(transition('trip-1', 'driver_arriving')).rejects.toThrow(
      TripNotFoundError,
    );
  });

  it('rejects transition from "request" status', async () => {
    setupMocks({ status: 'request', driverId: null });
    await expect(transition('trip-1', 'driver_arriving')).rejects.toThrow(
      IllegalTransitionError,
    );
  });

  it('allows accepted → driver_arriving', async () => {
    setupMocks({ status: 'accepted', driverId: 'driver-1' });
    await expect(transition('trip-1', 'driver_arriving')).resolves.toBeUndefined();
    expect(mockTxUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'trips' }),
      { status: 'driver_arriving' },
    );
  });

  it('allows driver_arriving → driver_arrived', async () => {
    setupMocks({ status: 'driver_arriving', driverId: 'driver-1' });
    await expect(transition('trip-1', 'driver_arrived')).resolves.toBeUndefined();
    expect(mockTxUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'trips' }),
      { status: 'driver_arrived' },
    );
  });

  it('allows driver_arrived → in_progress', async () => {
    setupMocks({ status: 'driver_arrived', driverId: 'driver-1' });
    await expect(transition('trip-1', 'in_progress')).resolves.toBeUndefined();
    expect(mockTxUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'trips' }),
      { status: 'in_progress' },
    );
  });

  it('allows in_progress → completed (resets driver)', async () => {
    setupMocks({ status: 'in_progress', driverId: 'driver-1' });
    await expect(transition('trip-1', 'completed')).resolves.toBeUndefined();

    expect(mockTxUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'trips' }),
      expect.objectContaining({ status: 'completed' }),
    );
    expect(mockTxUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'drivers' }),
      expect.objectContaining({
        activeTripId: null,
        availability: 'online',
        tripCount: { __increment: 1 },
      }),
    );
  });

  it('rejects skip: accepted → completed', async () => {
    setupMocks({ status: 'accepted', driverId: 'driver-1' });
    await expect(transition('trip-1', 'completed')).rejects.toThrow(
      IllegalTransitionError,
    );
  });

  it('rejects skip: accepted → in_progress', async () => {
    setupMocks({ status: 'accepted', driverId: 'driver-1' });
    await expect(transition('trip-1', 'in_progress')).rejects.toThrow(
      IllegalTransitionError,
    );
  });

  it('rejects transition from terminal "completed"', async () => {
    setupMocks({ status: 'completed', driverId: 'driver-1' });
    await expect(transition('trip-1', 'cancelled')).rejects.toThrow(
      IllegalTransitionError,
    );
  });

  it('rejects transition from terminal "cancelled"', async () => {
    setupMocks({ status: 'cancelled', driverId: 'driver-1' });
    await expect(transition('trip-1', 'driver_arriving')).rejects.toThrow(
      IllegalTransitionError,
    );
  });
});

describe('trip.service — cancel()', () => {
  let cancel: typeof import('@pakyaw/shared/features/trip/services/trip.service').cancel;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('@pakyaw/shared/features/trip/services/trip.service');
    cancel = mod.cancel;
  });

  it('throws TripNotFoundError for missing trip', async () => {
    setupMocks(null);
    await expect(cancel('trip-1', 'driver', 'test')).rejects.toThrow(
      TripNotFoundError,
    );
  });

  it('cancels from "accepted" status', async () => {
    setupMocks({ status: 'accepted', driverId: 'driver-1' });
    await expect(cancel('trip-1', 'passenger', 'changed mind')).resolves.toBeUndefined();

    expect(mockTxUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'trips' }),
      expect.objectContaining({
        status: 'cancelled',
        cancelledBy: 'passenger',
        cancelReason: 'changed mind',
      }),
    );
    expect(mockTxUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'drivers' }),
      expect.objectContaining({
        activeTripId: null,
        availability: 'online',
      }),
    );
  });

  it('cancels from "driver_arriving" status', async () => {
    setupMocks({ status: 'driver_arriving', driverId: 'driver-1' });
    await expect(cancel('trip-1', 'driver', 'emergency')).resolves.toBeUndefined();
  });

  it('cancels from "driver_arrived" status', async () => {
    setupMocks({ status: 'driver_arrived', driverId: 'driver-1' });
    await expect(cancel('trip-1', 'passenger', 'no show')).resolves.toBeUndefined();
  });

  it('deletes the trip document on cancel from "request" status (pre-acceptance abandonment)', async () => {
    setupMocks({ status: 'request', driverId: null });
    await expect(cancel('trip-1', 'passenger', 'no longer need')).resolves.toBeUndefined();

    // Abandoned request: the document is deleted outright.
    expect(mockTxDelete).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'trips' }),
    );

    // No 'cancelled' status is written and no driver doc is touched.
    expect(mockTxUpdate).not.toHaveBeenCalled();
  });

  it('rejects cancel from "in_progress"', async () => {
    setupMocks({ status: 'in_progress', driverId: 'driver-1' });
    await expect(cancel('trip-1', 'driver', 'reason')).rejects.toThrow(
      CancelNotAllowedError,
    );
  });

  it('rejects cancel from "completed"', async () => {
    setupMocks({ status: 'completed', driverId: 'driver-1' });
    await expect(cancel('trip-1', 'passenger', 'reason')).rejects.toThrow(
      CancelNotAllowedError,
    );
  });

  it('rejects cancel from "cancelled"', async () => {
    setupMocks({ status: 'cancelled', driverId: 'driver-1' });
    await expect(cancel('trip-1', 'driver', 'reason')).rejects.toThrow(
      CancelNotAllowedError,
    );
  });

  it('does not increment tripCount on cancel', async () => {
    setupMocks({ status: 'accepted', driverId: 'driver-1' });
    await cancel('trip-1', 'driver', 'test');

    const driverUpdates = mockTxUpdate.mock.calls.find(
      (call) => call[0].collection === 'drivers',
    );
    expect(driverUpdates).toBeDefined();
    expect(driverUpdates![1]).not.toHaveProperty('tripCount');
  });
});

describe('ALLOWED_TRANSITIONS constant', () => {
  it('has no path from accepted to completed without intermediates', () => {
    const from: Exclude<TripStatus, 'request'> = 'accepted';
    expect(ALLOWED_TRANSITIONS[from]).not.toContain('completed');
  });

  it('terminal states have no outgoing transitions', () => {
    expect(ALLOWED_TRANSITIONS.completed).toHaveLength(0);
    expect(ALLOWED_TRANSITIONS.cancelled).toHaveLength(0);
  });

  it('each non-terminal has exactly one forward step', () => {
    expect(ALLOWED_TRANSITIONS.accepted).toEqual(['driver_arriving']);
    expect(ALLOWED_TRANSITIONS.driver_arriving).toEqual(['driver_arrived']);
    expect(ALLOWED_TRANSITIONS.driver_arrived).toEqual(['in_progress']);
    expect(ALLOWED_TRANSITIONS.in_progress).toEqual(['completed']);
  });
});

describe('CANCELLABLE_STATUSES constant', () => {
  it('includes request, accepted, driver_arriving, driver_arrived', () => {
    expect(CANCELLABLE_STATUSES).toContain('request');
    expect(CANCELLABLE_STATUSES).toContain('accepted');
    expect(CANCELLABLE_STATUSES).toContain('driver_arriving');
    expect(CANCELLABLE_STATUSES).toContain('driver_arrived');
  });

  it('excludes terminal and in_progress statuses', () => {
    expect(CANCELLABLE_STATUSES).not.toContain('in_progress');
    expect(CANCELLABLE_STATUSES).not.toContain('completed');
    expect(CANCELLABLE_STATUSES).not.toContain('cancelled');
  });
});

describe('trip.service — publishTripProgress()', () => {
  let publishTripProgress: typeof import('@pakyaw/shared/features/trip/services/trip.service').publishTripProgress;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('@pakyaw/shared/features/trip/services/trip.service');
    publishTripProgress = mod.publishTripProgress;
  });

  it('writes only the lightweight tripProgress payload', async () => {
    await expect(
      publishTripProgress('trip-1', {
        remainingMeters: 1234,
        etaSeconds: 456,
      })
    ).resolves.toBeUndefined();

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'trips', id: 'trip-1' }),
      {
        tripProgress: {
          remainingMeters: 1234,
          etaSeconds: 456,
          updatedAt: { __serverTimestamp: true },
        },
      }
    );
  });
});
