import { useEffect, useRef } from 'react';
import * as Speech from 'expo-speech';
import type { NavStep } from '@pakyaw/shared/features/maps/navigation/types';

export const SOON_DISTANCE_M = 250;
export const NOW_DISTANCE_M = 60;
export const DUPLICATE_SPEECH_COOLDOWN_MS = 10_000;

export type VoiceGuidanceCue = 'initial' | 'soon' | 'now';

export type VoiceGuidanceState = {
  readonly stepKey: string | null;
  readonly soonStepKey: string | null;
  readonly nowStepKey: string | null;
  readonly lastSpokenText: string | null;
  readonly lastSpokenAt: number;
};

export type VoiceGuidanceDecision = {
  readonly cue: VoiceGuidanceCue | null;
  readonly text: string | null;
  readonly state: VoiceGuidanceState;
};

export type VoiceGuidanceParams = {
  readonly enabled: boolean;
  readonly currentStep: NavStep | null;
  readonly stepIndex: number;
  readonly distanceToManeuver: number;
  readonly routeId?: string | null;
  readonly stopId?: string | null;
  readonly routeFetchedAt?: number | null;
  readonly now?: number;
};

export function getVoiceStepKey({
  currentStep,
  stepIndex,
  routeId,
  stopId,
}: {
  readonly currentStep: NavStep;
  readonly stepIndex: number;
  readonly routeId?: string | null;
  readonly stopId?: string | null;
}): string {
  const contextId = stopId ? `stop:${stopId}` : (routeId ?? 'route');
  return [
    contextId,
    stepIndex,
    currentStep.maneuver ?? '',
    currentStep.instruction,
    currentStep.endLocation.lat.toFixed(5),
    currentStep.endLocation.lng.toFixed(5),
  ].join(':');
}

export function formatVoiceDistance(meters: number): string {
  const safeMeters = Math.max(0, meters);

  if (safeMeters < 100) {
    return `${Math.round(safeMeters / 10) * 10} meters`;
  }

  if (safeMeters < 1000) {
    return `${Math.round(safeMeters / 50) * 50} meters`;
  }

  return `${(safeMeters / 1000).toFixed(1)} kilometers`;
}

export function buildVoiceInstruction({
  cue,
  currentStep,
  distanceToManeuver,
}: {
  readonly cue: VoiceGuidanceCue;
  readonly currentStep: NavStep;
  readonly distanceToManeuver: number;
}): string {
  if (cue === 'now') {
    return `Now, ${currentStep.instruction}`;
  }

  return `In ${formatVoiceDistance(distanceToManeuver)}, ${currentStep.instruction}`;
}

export function getVoiceGuidanceDecision({
  enabled,
  currentStep,
  stepIndex,
  distanceToManeuver,
  routeId,
  stopId,
  state,
  now = Date.now(),
}: VoiceGuidanceParams & {
  readonly state: VoiceGuidanceState;
}): VoiceGuidanceDecision {
  if (!enabled || !currentStep) {
    return {
      cue: null,
      text: null,
      state: {
        stepKey: null,
        soonStepKey: null,
        nowStepKey: null,
        lastSpokenText: null,
        lastSpokenAt: 0,
      },
    };
  }

  const stepKey = getVoiceStepKey({ currentStep, stepIndex, routeId, stopId });
  const isNewStep = state.stepKey !== stepKey;

  let cue: VoiceGuidanceCue | null = null;
  let nextSoonStepKey = isNewStep ? null : state.soonStepKey;
  let nextNowStepKey = isNewStep ? null : state.nowStepKey;

  if (isNewStep) {
    // New step / maneuver entered
    if (distanceToManeuver <= NOW_DISTANCE_M) {
      cue = 'now';
      nextSoonStepKey = stepKey;
      nextNowStepKey = stepKey;
    } else if (distanceToManeuver <= SOON_DISTANCE_M) {
      cue = 'soon';
      nextSoonStepKey = stepKey;
    } else {
      cue = 'initial';
    }
  } else {
    // Same maneuver, check distance threshold crossings
    if (distanceToManeuver <= NOW_DISTANCE_M && state.nowStepKey !== stepKey) {
      cue = 'now';
      nextSoonStepKey = stepKey;
      nextNowStepKey = stepKey;
    } else if (distanceToManeuver <= SOON_DISTANCE_M && state.soonStepKey !== stepKey) {
      cue = 'soon';
      nextSoonStepKey = stepKey;
    }
  }

  if (!cue) {
    return {
      cue: null,
      text: null,
      state: {
        ...state,
        stepKey,
        soonStepKey: nextSoonStepKey,
        nowStepKey: nextNowStepKey,
      },
    };
  }

  const instructionText = buildVoiceInstruction({
    cue,
    currentStep,
    distanceToManeuver,
  });

  // Duplicate utterance cooldown check
  const isDuplicateSpoken =
    state.lastSpokenText === instructionText &&
    now - state.lastSpokenAt < DUPLICATE_SPEECH_COOLDOWN_MS;

  if (isDuplicateSpoken) {
    return {
      cue: null,
      text: null,
      state: {
        ...state,
        stepKey,
        soonStepKey: nextSoonStepKey,
        nowStepKey: nextNowStepKey,
      },
    };
  }

  return {
    cue,
    text: instructionText,
    state: {
      stepKey,
      soonStepKey: nextSoonStepKey,
      nowStepKey: nextNowStepKey,
      lastSpokenText: instructionText,
      lastSpokenAt: now,
    },
  };
}

export function useVoiceGuidance({
  enabled,
  currentStep,
  stepIndex,
  distanceToManeuver,
  routeId,
  stopId,
}: VoiceGuidanceParams) {
  const guidanceStateRef = useRef<VoiceGuidanceState>({
    stepKey: null,
    soonStepKey: null,
    nowStepKey: null,
    lastSpokenText: null,
    lastSpokenAt: 0,
  });

  const currentlySpeakingRef = useRef<string | null>(null);

  useEffect(() => {
    const decision = getVoiceGuidanceDecision({
      enabled,
      currentStep,
      stepIndex,
      distanceToManeuver,
      routeId,
      stopId,
      state: guidanceStateRef.current,
      now: Date.now(),
    });

    guidanceStateRef.current = decision.state;

    if (!enabled || !currentStep) {
      if (currentlySpeakingRef.current !== null) {
        Speech.stop();
        currentlySpeakingRef.current = null;
      }
      return;
    }

    if (!decision.text) {
      return;
    }

    // Ignore if identical instruction is currently speaking
    if (currentlySpeakingRef.current === decision.text) {
      return;
    }

    Speech.stop();
    currentlySpeakingRef.current = decision.text;

    Speech.speak(decision.text, {
      rate: 1,
      pitch: 1,
      onDone: () => {
        if (currentlySpeakingRef.current === decision.text) {
          currentlySpeakingRef.current = null;
        }
      },
      onStopped: () => {
        if (currentlySpeakingRef.current === decision.text) {
          currentlySpeakingRef.current = null;
        }
      },
      onError: () => {
        if (currentlySpeakingRef.current === decision.text) {
          currentlySpeakingRef.current = null;
        }
      },
    });
  }, [currentStep, distanceToManeuver, enabled, routeId, stepIndex, stopId]);
}
