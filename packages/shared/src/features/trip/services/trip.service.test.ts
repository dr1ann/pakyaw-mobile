import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ callable: vi.fn() }));

vi.mock('firebase/functions', () => ({ httpsCallable: mocks.callable }));
vi.mock('@/services/firebase/firebase', () => ({ firestore: {}, functions: {} }));

import { CancelNotAllowedError, IllegalTransitionError } from '../errors';
import { cancel, transition } from './trip.service';

describe('Day 3 callable trip actions', () => {
  beforeEach(() => {
    mocks.callable.mockReset();
  });

  it('sends driver transitions through the server-authoritative callable', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { result: 'ok' } });
    mocks.callable.mockReturnValue(invoke);

    await expect(transition('trip-1', 'driver-1', 'driver_arriving')).resolves.toBeUndefined();
    expect(mocks.callable).toHaveBeenCalledWith({}, 'transitionTrip');
    expect(invoke).toHaveBeenCalledWith({
      tripId: 'trip-1',
      actorId: 'driver-1',
      transition: 'driver_arriving',
    });
  });

  it('does not allow a client to manufacture requested or accepted transitions', async () => {
    await expect(transition('trip-1', 'driver-1', 'requested')).rejects.toBeInstanceOf(IllegalTransitionError);
    await expect(transition('trip-1', 'driver-1', 'accepted')).rejects.toBeInstanceOf(IllegalTransitionError);
  });

  it('maps rejected lifecycle and cancellation results to safe domain errors', async () => {
    mocks.callable.mockReturnValue(vi.fn().mockResolvedValue({ data: { result: 'invalid_transition' } }));
    await expect(transition('trip-1', 'driver-1', 'driver_arriving')).rejects.toBeInstanceOf(IllegalTransitionError);

    mocks.callable.mockReturnValue(vi.fn().mockResolvedValue({ data: { result: 'cannot_cancel' } }));
    await expect(cancel('trip-1', 'passenger-1', 'passenger_changed_mind')).rejects.toBeInstanceOf(CancelNotAllowedError);
  });

  it('sends only canonical cancellation reasons to the callable', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { result: 'ok' } });
    mocks.callable.mockReturnValue(invoke);

    await cancel('trip-1', 'driver-1', 'vehicle_issue');
    expect(mocks.callable).toHaveBeenCalledWith({}, 'cancelTrip');
    expect(invoke).toHaveBeenCalledWith({
      tripId: 'trip-1',
      actorId: 'driver-1',
      reason: 'vehicle_issue',
    });
  });
});
