import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ callable: vi.fn(), httpsCallable: vi.fn() }));

vi.mock('@/services/firebase/firebase', () => ({
  functions: {},
  httpsCallable: mocks.httpsCallable,
}));

import { createSupportTicket } from './support-ticket.service';

describe('passenger support ticket / case reporting service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.httpsCallable.mockReturnValue(mocks.callable);
  });

  it('submits a Lost Item case with item details and trip context', async () => {
    mocks.callable.mockResolvedValue({
      data: { ticketId: 'ticket-lost-1', status: 'driver_notified' },
    });

    const result = await createSupportTicket({
      category: 'lost_item',
      caseType: 'lost_item',
      priority: 'normal',
      subject: 'Lost Item: Umbrella',
      body: 'Item: Umbrella\nDescription: Black folding\nRemembered location: Back seat',
      relatedTripId: 'trip-101',
      lostItemDetails: {
        itemName: 'Umbrella',
        description: 'Black folding',
        rememberedLocation: 'Back seat',
      },
    });

    expect(result).toEqual({ ticketId: 'ticket-lost-1', status: 'driver_notified' });
    expect(mocks.httpsCallable).toHaveBeenCalledWith(expect.anything(), 'createSupportTicket');
    expect(mocks.callable).toHaveBeenCalledWith({
      category: 'lost_item',
      caseType: 'lost_item',
      priority: 'normal',
      subject: 'Lost Item: Umbrella',
      body: 'Item: Umbrella\nDescription: Black folding\nRemembered location: Back seat',
      relatedTripId: 'trip-101',
      lostItemDetails: {
        itemName: 'Umbrella',
        description: 'Black folding',
        rememberedLocation: 'Back seat',
      },
    });
  });

  it('submits a Safety Concern case as high priority', async () => {
    mocks.callable.mockResolvedValue({
      data: { ticketId: 'ticket-safety-1', status: 'open' },
    });

    const result = await createSupportTicket({
      category: 'safety_concern',
      caseType: 'safety_concern',
      priority: 'high',
      subject: 'Safety Concern: trip-102',
      body: 'Reckless driving observed on highway',
      relatedTripId: 'trip-102',
    });

    expect(result).toEqual({ ticketId: 'ticket-safety-1', status: 'open' });
    expect(mocks.callable).toHaveBeenCalledWith({
      category: 'safety_concern',
      caseType: 'safety_concern',
      priority: 'high',
      subject: 'Safety Concern: trip-102',
      body: 'Reckless driving observed on highway',
      relatedTripId: 'trip-102',
      lostItemDetails: undefined,
    });
  });
});
