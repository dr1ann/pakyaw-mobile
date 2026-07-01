import { describe, expect, it, vi } from 'vitest';
import type { NavStep } from '../navigation/types';
import {
  buildVoiceInstruction,
  formatVoiceDistance,
  getVoiceGuidanceDecision,
} from './useVoiceGuidance';

vi.mock('expo-speech', () => ({
  speak: vi.fn(),
  stop: vi.fn(),
}));

const mockStep: NavStep = {
  maneuver: 'turn-right',
  instruction: 'Turn right onto Rizal Street',
  roadName: 'Rizal Street',
  distanceMeters: 500,
  startLocation: { lat: 11, lng: 124 },
  endLocation: { lat: 11.001, lng: 124.001 },
  polyline: [
    { lat: 11, lng: 124 },
    { lat: 11.001, lng: 124.001 },
  ],
};

const emptyState = {
  stepKey: null,
  soonStepKey: null,
  nowStepKey: null,
};

describe('useVoiceGuidance helpers', () => {
  it('formats readable navigation distances', () => {
    expect(formatVoiceDistance(57)).toBe('60 meters');
    expect(formatVoiceDistance(260)).toBe('250 meters');
    expect(formatVoiceDistance(1250)).toBe('1.3 kilometers');
  });

  it('builds initial and immediate voice instructions', () => {
    expect(buildVoiceInstruction({
      cue: 'initial',
      currentStep: mockStep,
      distanceToManeuver: 260,
    })).toBe('In 250 meters, Turn right onto Rizal Street');

    expect(buildVoiceInstruction({
      cue: 'now',
      currentStep: mockStep,
      distanceToManeuver: 30,
    })).toBe('Now, Turn right onto Rizal Street');
  });

  it('announces the step once, then near and now thresholds once each', () => {
    const first = getVoiceGuidanceDecision({
      enabled: true,
      currentStep: mockStep,
      stepIndex: 0,
      routeFetchedAt: 123,
      distanceToManeuver: 500,
      state: emptyState,
    });

    expect(first.cue).toBe('initial');

    const repeated = getVoiceGuidanceDecision({
      enabled: true,
      currentStep: mockStep,
      stepIndex: 0,
      routeFetchedAt: 123,
      distanceToManeuver: 400,
      state: first.state,
    });

    expect(repeated.cue).toBeNull();

    const soon = getVoiceGuidanceDecision({
      enabled: true,
      currentStep: mockStep,
      stepIndex: 0,
      routeFetchedAt: 123,
      distanceToManeuver: 240,
      state: repeated.state,
    });

    expect(soon.cue).toBe('soon');

    const now = getVoiceGuidanceDecision({
      enabled: true,
      currentStep: mockStep,
      stepIndex: 0,
      routeFetchedAt: 123,
      distanceToManeuver: 50,
      state: soon.state,
    });

    expect(now.cue).toBe('now');

    const repeatedNow = getVoiceGuidanceDecision({
      enabled: true,
      currentStep: mockStep,
      stepIndex: 0,
      routeFetchedAt: 123,
      distanceToManeuver: 30,
      state: now.state,
    });

    expect(repeatedNow.cue).toBeNull();
  });

  it('resets speech state when guidance is disabled', () => {
    const decision = getVoiceGuidanceDecision({
      enabled: false,
      currentStep: mockStep,
      stepIndex: 0,
      routeFetchedAt: 123,
      distanceToManeuver: 100,
      state: {
        stepKey: 'old',
        soonStepKey: 'old',
        nowStepKey: 'old',
      },
    });

    expect(decision.cue).toBeNull();
    expect(decision.state).toEqual(emptyState);
  });
});
