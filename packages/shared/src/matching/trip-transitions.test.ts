import { describe, expect, it } from 'vitest';

import {
  canCancel,
  getCancelReasons,
  tripTransition,
} from '@pakyaw/shared/matching/trip-transitions';
import type { TripActor, TripStatus } from '@pakyaw/shared/matching/types';

describe('tripTransition', () => {
  it.each([
    ['requested', 'accepted', 'driver'],
    ['accepted', 'driver_arriving', 'driver'],
    ['driver_arriving', 'driver_arrived', 'driver'],
    ['driver_arrived', 'in_progress', 'driver'],
    ['in_progress', 'completed', 'driver'],
  ] as const)(
    'allows the forward transition %s → %s for a %s',
    (current, next, actor) => {
      expect(tripTransition(current, { type: 'transition', next }, actor)).toEqual({
        allowed: true,
        next,
      });
    },
  );

  it.each([
    ['skipped transition', 'accepted', 'completed', 'driver', 'invalid_transition'],
    ['backward transition', 'driver_arrived', 'accepted', 'driver', 'invalid_transition'],
    ['repeated transition', 'accepted', 'accepted', 'driver', 'invalid_transition'],
    ['transition after completion', 'completed', 'cancelled', 'driver', 'invalid_transition'],
    ['transition after cancellation', 'cancelled', 'driver_arriving', 'driver', 'invalid_transition'],
    ['passenger accepting an offer', 'requested', 'accepted', 'passenger', 'unauthorized_actor'],
    [
      'passenger progressing the driver lifecycle',
      'accepted',
      'driver_arriving',
      'passenger',
      'unauthorized_actor',
    ],
  ] as const)(
    'rejects %s',
    (_label, current, next, actor, error) => {
      expect(
        tripTransition(
          current as TripStatus,
          { type: 'transition', next: next as TripStatus },
          actor as TripActor,
        ),
      ).toEqual({ allowed: false, error });
    },
  );

  it('allows a passenger to cancel a requested trip with a valid reason', () => {
    expect(
      tripTransition(
        'requested',
        { type: 'cancel', reason: 'passenger_changed_mind' },
        'passenger',
      ),
    ).toEqual({ allowed: true, next: 'cancelled' });
  });

  it('allows a driver to cancel an accepted trip with a valid reason', () => {
    expect(
      tripTransition(
        'accepted',
        { type: 'cancel', reason: 'vehicle_issue' },
        'driver',
      ),
    ).toEqual({ allowed: true, next: 'cancelled' });
  });

  it('rejects cancellation when the actor cannot cancel at that state', () => {
    expect(
      tripTransition(
        'in_progress',
        { type: 'cancel', reason: 'safety_concern' },
        'passenger',
      ),
    ).toEqual({ allowed: false, error: 'cannot_cancel' });
  });

  it('requires one of the contract cancellation reason codes', () => {
    expect(tripTransition('accepted', { type: 'cancel' }, 'passenger')).toEqual({
      allowed: false,
      error: 'invalid_cancel_reason',
    });
    expect(
      tripTransition(
        'accepted',
        { type: 'cancel', reason: 'changed my mind' },
        'passenger',
      ),
    ).toEqual({ allowed: false, error: 'invalid_cancel_reason' });
  });
});

describe('canCancel and getCancelReasons', () => {
  it('allows only the passenger to cancel before a driver accepts', () => {
    expect(canCancel('requested', 'passenger')).toEqual({
      allowed: true,
      requiredReason: true,
    });
    expect(canCancel('requested', 'driver')).toEqual({
      allowed: false,
      requiredReason: true,
    });
  });

  it('allows passenger and driver cancellation before the trip starts', () => {
    expect(canCancel('driver_arrived', 'passenger').allowed).toBe(true);
    expect(canCancel('driver_arrived', 'driver').allowed).toBe(true);
  });

  it('does not allow cancellation after the trip starts or from an admin role', () => {
    expect(canCancel('in_progress', 'driver').allowed).toBe(false);
    expect(canCancel('accepted', 'admin').allowed).toBe(false);
  });

  it('returns the complete, stable reason set only when cancellation is allowed', () => {
    expect(getCancelReasons('accepted', 'passenger')).toEqual([
      'passenger_changed_mind',
      'driver_unavailable',
      'unable_to_locate_passenger',
      'vehicle_issue',
      'safety_concern',
      'other',
    ]);
    expect(getCancelReasons('completed', 'passenger')).toEqual([]);
  });
});
