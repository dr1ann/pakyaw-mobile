import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ callable: vi.fn(), httpsCallable: vi.fn() }));

vi.mock('@/services/firebase/firebase', () => ({
  functions: {},
  httpsCallable: mocks.httpsCallable,
}));

import { createTripIncident, getSafetyStatus } from './incident.service';

describe('passenger incident callable adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.httpsCallable.mockReturnValue(mocks.callable);
  });

  it('submits the authenticated participant context to createIncident', async () => {
    mocks.callable.mockResolvedValue({ data: { incidentId: 'incident-1', status: 'active' } });

    await expect(createTripIncident('trip-1', 'passenger-1', {
      latitude: 11.005,
      longitude: 124.6075,
    })).resolves.toEqual({ incidentId: 'incident-1', status: 'active' });
    expect(mocks.httpsCallable).toHaveBeenCalledWith(expect.anything(), 'createIncident');
    expect(mocks.callable).toHaveBeenCalledWith({
      tripId: 'trip-1',
      triggeredBy: 'passenger-1',
      location: { latitude: 11.005, longitude: 124.6075 },
    });
  });

  it('reads the server-controlled SOS feature flag', async () => {
    mocks.callable.mockResolvedValue({ data: { sosEnabled: false } });
    await expect(getSafetyStatus()).resolves.toEqual({ sosEnabled: false });
    expect(mocks.httpsCallable).toHaveBeenCalledWith(expect.anything(), 'getSafetyStatus');
  });
});
