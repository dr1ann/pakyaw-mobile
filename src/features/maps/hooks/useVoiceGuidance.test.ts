import { describe, expect, it, vi } from 'vitest';
import type { NavStep } from '@pakyaw/shared/features/maps/navigation/types';
import {
  buildVoiceInstruction,
  formatVoiceDistance,
  getVoiceGuidanceDecision,
  type VoiceGuidanceState,
} from './useVoiceGuidance';

vi.mock('expo-speech', () => ({
  speak: vi.fn(),
  stop: vi.fn(),
}));

const mockStep1: NavStep = {
  maneuver: 'turn-right',
  instruction: 'Turn right onto Rizal Street',
  roadName: 'Rizal Street',
  distanceMeters: 500,
  startLocation: { lat: 11.000, lng: 124.000 },
  endLocation: { lat: 11.001, lng: 124.001 },
  polyline: [
    { lat: 11.000, lng: 124.000 },
    { lat: 11.001, lng: 124.001 },
  ],
};

const mockStep2: NavStep = {
  maneuver: 'turn-left',
  instruction: 'Turn left onto Burgos Avenue',
  roadName: 'Burgos Avenue',
  distanceMeters: 300,
  startLocation: { lat: 11.001, lng: 124.001 },
  endLocation: { lat: 11.003, lng: 124.002 },
  polyline: [
    { lat: 11.001, lng: 124.001 },
    { lat: 11.003, lng: 124.002 },
  ],
};

const emptyState: VoiceGuidanceState = {
  stepKey: null,
  soonStepKey: null,
  nowStepKey: null,
  lastSpokenText: null,
  lastSpokenAt: 0,
};

describe('useVoiceGuidance helpers and decisions', () => {
  it('formats readable navigation distances', () => {
    expect(formatVoiceDistance(57)).toBe('60 meters');
    expect(formatVoiceDistance(200)).toBe('200 meters');
    expect(formatVoiceDistance(260)).toBe('250 meters');
    expect(formatVoiceDistance(1250)).toBe('1.3 kilometers');
  });

  it('builds initial, soon, and immediate voice instructions without generic optimization noise', () => {
    expect(buildVoiceInstruction({
      cue: 'initial',
      currentStep: mockStep1,
      distanceToManeuver: 500,
    })).toBe('In 500 meters, Turn right onto Rizal Street');

    expect(buildVoiceInstruction({
      cue: 'soon',
      currentStep: mockStep1,
      distanceToManeuver: 240,
    })).toBe('In 250 meters, Turn right onto Rizal Street');

    expect(buildVoiceInstruction({
      cue: 'now',
      currentStep: mockStep1,
      distanceToManeuver: 30,
    })).toBe('Now, Turn right onto Rizal Street');
  });

  // Test 1: same GPS update does not repeat same voice instruction
  it('1. same GPS update does not repeat same voice instruction', () => {
    const first = getVoiceGuidanceDecision({
      enabled: true,
      currentStep: mockStep1,
      stepIndex: 0,
      routeId: 'trip123:dest',
      distanceToManeuver: 500,
      state: emptyState,
      now: 1000,
    });
    expect(first.cue).toBe('initial');
    expect(first.text).toBe('In 500 meters, Turn right onto Rizal Street');

    // Repeated GPS tick at same location/distance
    const second = getVoiceGuidanceDecision({
      enabled: true,
      currentStep: mockStep1,
      stepIndex: 0,
      routeId: 'trip123:dest',
      distanceToManeuver: 500,
      state: first.state,
      now: 1500,
    });
    expect(second.cue).toBeNull();
    expect(second.text).toBeNull();
  });

  // Test 2: GPS jitter around 200m does not repeatedly speak "200 meters"
  it('2. GPS jitter around 200m does not repeatedly speak "200 meters"', () => {
    // Initial start at 400m
    const initial = getVoiceGuidanceDecision({
      enabled: true,
      currentStep: mockStep1,
      stepIndex: 0,
      routeId: 'trip123:dest',
      distanceToManeuver: 400,
      state: emptyState,
      now: 1000,
    });
    expect(initial.cue).toBe('initial');

    // Cross into soon threshold at 200m
    const cross200 = getVoiceGuidanceDecision({
      enabled: true,
      currentStep: mockStep1,
      stepIndex: 0,
      routeId: 'trip123:dest',
      distanceToManeuver: 200,
      state: initial.state,
      now: 3000,
    });
    expect(cross200.cue).toBe('soon');
    expect(cross200.text).toBe('In 200 meters, Turn right onto Rizal Street');

    // GPS jitter fluctuating: 198m, 203m, 195m, 200m
    const jitter1 = getVoiceGuidanceDecision({
      enabled: true,
      currentStep: mockStep1,
      stepIndex: 0,
      routeId: 'trip123:dest',
      distanceToManeuver: 198,
      state: cross200.state,
      now: 4000,
    });
    expect(jitter1.cue).toBeNull();

    const jitter2 = getVoiceGuidanceDecision({
      enabled: true,
      currentStep: mockStep1,
      stepIndex: 0,
      routeId: 'trip123:dest',
      distanceToManeuver: 203,
      state: jitter1.state,
      now: 5000,
    });
    expect(jitter2.cue).toBeNull();

    const jitter3 = getVoiceGuidanceDecision({
      enabled: true,
      currentStep: mockStep1,
      stepIndex: 0,
      routeId: 'trip123:dest',
      distanceToManeuver: 195,
      state: jitter2.state,
      now: 6000,
    });
    expect(jitter3.cue).toBeNull();

    const jitter4 = getVoiceGuidanceDecision({
      enabled: true,
      currentStep: mockStep1,
      stepIndex: 0,
      routeId: 'trip123:dest',
      distanceToManeuver: 200,
      state: jitter3.state,
      now: 7000,
    });
    expect(jitter4.cue).toBeNull();
  });

  // Test 3: threshold stage fires only once
  it('3. threshold stage fires only once per maneuver', () => {
    const initial = getVoiceGuidanceDecision({
      enabled: true,
      currentStep: mockStep1,
      stepIndex: 0,
      routeId: 'trip123:dest',
      distanceToManeuver: 500,
      state: emptyState,
      now: 1000,
    });
    expect(initial.cue).toBe('initial');

    const soon = getVoiceGuidanceDecision({
      enabled: true,
      currentStep: mockStep1,
      stepIndex: 0,
      routeId: 'trip123:dest',
      distanceToManeuver: 240,
      state: initial.state,
      now: 5000,
    });
    expect(soon.cue).toBe('soon');

    const soonAgain = getVoiceGuidanceDecision({
      enabled: true,
      currentStep: mockStep1,
      stepIndex: 0,
      routeId: 'trip123:dest',
      distanceToManeuver: 220,
      state: soon.state,
      now: 6000,
    });
    expect(soonAgain.cue).toBeNull();

    const now = getVoiceGuidanceDecision({
      enabled: true,
      currentStep: mockStep1,
      stepIndex: 0,
      routeId: 'trip123:dest',
      distanceToManeuver: 50,
      state: soonAgain.state,
      now: 10000,
    });
    expect(now.cue).toBe('now');
    expect(now.text).toBe('Now, Turn right onto Rizal Street');

    const nowAgain = getVoiceGuidanceDecision({
      enabled: true,
      currentStep: mockStep1,
      stepIndex: 0,
      routeId: 'trip123:dest',
      distanceToManeuver: 30,
      state: now.state,
      now: 11000,
    });
    expect(nowAgain.cue).toBeNull();
  });

  // Test 4: new maneuver can speak
  it('4. new maneuver can speak immediately upon step transition', () => {
    const step1Initial = getVoiceGuidanceDecision({
      enabled: true,
      currentStep: mockStep1,
      stepIndex: 0,
      routeId: 'trip123:dest',
      distanceToManeuver: 500,
      state: emptyState,
      now: 1000,
    });
    expect(step1Initial.cue).toBe('initial');

    // Transition to step 2 (new maneuver)
    const step2Initial = getVoiceGuidanceDecision({
      enabled: true,
      currentStep: mockStep2,
      stepIndex: 1,
      routeId: 'trip123:dest',
      distanceToManeuver: 300,
      state: step1Initial.state,
      now: 2000,
    });
    expect(step2Initial.cue).toBe('initial');
    expect(step2Initial.text).toBe('In 300 meters, Turn left onto Burgos Avenue');
  });

  // Test 5: legitimate reroute resets instructions appropriately
  it('5. legitimate reroute resets instructions appropriately when new route/step identity is assigned', () => {
    const firstRoute = getVoiceGuidanceDecision({
      enabled: true,
      currentStep: mockStep1,
      stepIndex: 0,
      routeId: 'trip123:routeA',
      distanceToManeuver: 500,
      state: emptyState,
      now: 1000,
    });
    expect(firstRoute.cue).toBe('initial');

    // A legitimate reroute produces a new routeId and step
    const rerouted = getVoiceGuidanceDecision({
      enabled: true,
      currentStep: mockStep2,
      stepIndex: 0,
      routeId: 'trip123:routeB',
      distanceToManeuver: 300,
      state: firstRoute.state,
      now: 15000,
    });
    expect(rerouted.cue).toBe('initial');
    expect(rerouted.text).toBe('In 300 meters, Turn left onto Burgos Avenue');
  });

  // Test 6: component rerender does not reset spoken history
  it('6. component rerender does not reset spoken history when preserving state ref', () => {
    const first = getVoiceGuidanceDecision({
      enabled: true,
      currentStep: mockStep1,
      stepIndex: 0,
      routeId: 'trip123:dest',
      distanceToManeuver: 500,
      state: emptyState,
      now: 1000,
    });
    expect(first.cue).toBe('initial');

    // Simulate React component re-rendering without GPS/step change
    const rerender = getVoiceGuidanceDecision({
      enabled: true,
      currentStep: { ...mockStep1 },
      stepIndex: 0,
      routeId: 'trip123:dest',
      distanceToManeuver: 500,
      state: first.state,
      now: 1200,
    });
    expect(rerender.cue).toBeNull();
    expect(rerender.text).toBeNull();
  });

  // Test 7: repeated identical route response does not replay speech
  it('7. repeated identical route response (route query refetch) does not replay speech', () => {
    const first = getVoiceGuidanceDecision({
      enabled: true,
      currentStep: mockStep1,
      stepIndex: 0,
      routeId: 'trip123:dest',
      distanceToManeuver: 500,
      state: emptyState,
      now: 1000,
    });
    expect(first.cue).toBe('initial');

    // Query refetches in background (new timestamp or object reference), but same canonical route & step
    const refetch = getVoiceGuidanceDecision({
      enabled: true,
      currentStep: { ...mockStep1 },
      stepIndex: 0,
      routeId: 'trip123:dest',
      distanceToManeuver: 490,
      state: first.state,
      now: 3000,
    });
    expect(refetch.cue).toBeNull();
  });

  // Test 8: Shared current-stop change starts navigation for the new canonical stop
  it('8. Shared current-stop change starts navigation for the new canonical stop', () => {
    const pickupStopDecision = getVoiceGuidanceDecision({
      enabled: true,
      currentStep: mockStep1,
      stepIndex: 0,
      stopId: 'stop_pickup_1',
      routeId: 'shared123:stop_pickup_1',
      distanceToManeuver: 500,
      state: emptyState,
      now: 1000,
    });
    expect(pickupStopDecision.cue).toBe('initial');
    expect(pickupStopDecision.text).toBe('In 500 meters, Turn right onto Rizal Street');

    // Stop 1 completed, backend advances to dropoff stop 2
    const dropoffStopDecision = getVoiceGuidanceDecision({
      enabled: true,
      currentStep: mockStep1, // Same maneuver text, but for the new canonical stop
      stepIndex: 0,
      stopId: 'stop_dropoff_2',
      routeId: 'shared123:stop_dropoff_2',
      distanceToManeuver: 500,
      state: pickupStopDecision.state,
      now: 20000,
    });
    expect(dropoffStopDecision.cue).toBe('initial');
    expect(dropoffStopDecision.text).toBe('In 500 meters, Turn right onto Rizal Street');
  });

  // Test 9: "route optimized" is not repeatedly spoken
  it('9. "route optimized" or internal recomputation states are never returned as voice instructions', () => {
    const decision = getVoiceGuidanceDecision({
      enabled: true,
      currentStep: mockStep1,
      stepIndex: 0,
      routeId: 'trip123:dest',
      distanceToManeuver: 500,
      state: emptyState,
      now: 1000,
    });

    expect(decision.text).not.toContain('optimized');
    expect(decision.text).not.toContain('Optimizing');
    expect(decision.text).toBe('In 500 meters, Turn right onto Rizal Street');
  });

  // Test 10: Solo navigation remains unchanged
  it('10. Solo navigation works predictably through entire maneuver sequence', () => {
    let state = emptyState;

    // Far away (>250m)
    const d1 = getVoiceGuidanceDecision({
      enabled: true,
      currentStep: mockStep1,
      stepIndex: 0,
      routeId: 'solo_trip_777:dest',
      distanceToManeuver: 600,
      state,
      now: 1000,
    });
    expect(d1.cue).toBe('initial');
    state = d1.state;

    // Moving closer (300m) - no announcement
    const d2 = getVoiceGuidanceDecision({
      enabled: true,
      currentStep: mockStep1,
      stepIndex: 0,
      routeId: 'solo_trip_777:dest',
      distanceToManeuver: 300,
      state,
      now: 5000,
    });
    expect(d2.cue).toBeNull();
    state = d2.state;

    // Approaching soon (240m)
    const d3 = getVoiceGuidanceDecision({
      enabled: true,
      currentStep: mockStep1,
      stepIndex: 0,
      routeId: 'solo_trip_777:dest',
      distanceToManeuver: 240,
      state,
      now: 8000,
    });
    expect(d3.cue).toBe('soon');
    expect(d3.text).toBe('In 250 meters, Turn right onto Rizal Street');
    state = d3.state;

    // Immediate (45m)
    const d4 = getVoiceGuidanceDecision({
      enabled: true,
      currentStep: mockStep1,
      stepIndex: 0,
      routeId: 'solo_trip_777:dest',
      distanceToManeuver: 45,
      state,
      now: 12000,
    });
    expect(d4.cue).toBe('now');
    expect(d4.text).toBe('Now, Turn right onto Rizal Street');
    state = d4.state;

    // Next step (turn completed)
    const d5 = getVoiceGuidanceDecision({
      enabled: true,
      currentStep: mockStep2,
      stepIndex: 1,
      routeId: 'solo_trip_777:dest',
      distanceToManeuver: 300,
      state,
      now: 15000,
    });
    expect(d5.cue).toBe('initial');
    expect(d5.text).toBe('In 300 meters, Turn left onto Burgos Avenue');
  });

  it('resets speech state when guidance is disabled', () => {
    const decision = getVoiceGuidanceDecision({
      enabled: false,
      currentStep: mockStep1,
      stepIndex: 0,
      distanceToManeuver: 100,
      state: {
        stepKey: 'old',
        soonStepKey: 'old',
        nowStepKey: 'old',
        lastSpokenText: 'old text',
        lastSpokenAt: 1000,
      },
    });

    expect(decision.cue).toBeNull();
    expect(decision.text).toBeNull();
    expect(decision.state).toEqual(emptyState);
  });
});
