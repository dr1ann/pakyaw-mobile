import { useEffect, useRef } from 'react';
import * as Speech from 'expo-speech';
import type { NavStep } from '@pakyaw/shared/features/maps/navigation/types';

const SOON_DISTANCE_M = 250;
const NOW_DISTANCE_M = 60;

type VoiceGuidanceCue = 'initial' | 'soon' | 'now';

type VoiceGuidanceState = {
  readonly stepKey: string | null;
  readonly soonStepKey: string | null;
  readonly nowStepKey: string | null;
};

type VoiceGuidanceDecision = {
  readonly cue: VoiceGuidanceCue | null;
  readonly state: VoiceGuidanceState;
};

type VoiceGuidanceParams = {
  readonly enabled: boolean;
  readonly currentStep: NavStep | null;
  readonly stepIndex: number;
  readonly routeFetchedAt: number | null;
  readonly distanceToManeuver: number;
};

export function getVoiceStepKey({
  currentStep,
  stepIndex,
  routeFetchedAt,
}: {
  readonly currentStep: NavStep;
  readonly stepIndex: number;
  readonly routeFetchedAt: number | null;
}): string {
  return [
    routeFetchedAt ?? 'route',
    stepIndex,
    currentStep.instruction,
    currentStep.endLocation.lat,
    currentStep.endLocation.lng,
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
  routeFetchedAt,
  distanceToManeuver,
  state,
}: VoiceGuidanceParams & {
  readonly state: VoiceGuidanceState;
}): VoiceGuidanceDecision {
  if (!enabled || !currentStep) {
    return {
      cue: null,
      state: {
        stepKey: null,
        soonStepKey: null,
        nowStepKey: null,
      },
    };
  }

  const stepKey = getVoiceStepKey({ currentStep, stepIndex, routeFetchedAt });
  const nextState = state.stepKey === stepKey
    ? state
    : {
        stepKey,
        soonStepKey: null,
        nowStepKey: null,
      };

  if (nextState.stepKey !== state.stepKey) {
    return {
      cue: 'initial',
      state: {
        ...nextState,
        soonStepKey: distanceToManeuver <= SOON_DISTANCE_M ? stepKey : null,
        nowStepKey: distanceToManeuver <= NOW_DISTANCE_M ? stepKey : null,
      },
    };
  }

  if (distanceToManeuver <= NOW_DISTANCE_M && nextState.nowStepKey !== stepKey) {
    return {
      cue: 'now',
      state: {
        ...nextState,
        soonStepKey: stepKey,
        nowStepKey: stepKey,
      },
    };
  }

  if (distanceToManeuver <= SOON_DISTANCE_M && nextState.soonStepKey !== stepKey) {
    return {
      cue: 'soon',
      state: {
        ...nextState,
        soonStepKey: stepKey,
      },
    };
  }

  return {
    cue: null,
    state: nextState,
  };
}

export function useVoiceGuidance({
  enabled,
  currentStep,
  stepIndex,
  routeFetchedAt,
  distanceToManeuver,
}: VoiceGuidanceParams) {
  const guidanceStateRef = useRef<VoiceGuidanceState>({
    stepKey: null,
    soonStepKey: null,
    nowStepKey: null,
  });

  useEffect(() => {
    const decision = getVoiceGuidanceDecision({
      enabled,
      currentStep,
      stepIndex,
      routeFetchedAt,
      distanceToManeuver,
      state: guidanceStateRef.current,
    });

    guidanceStateRef.current = decision.state;

    if (!enabled || !currentStep) {
      Speech.stop();
      return;
    }

    if (!decision.cue) {
      return;
    }

    Speech.stop();
    Speech.speak(buildVoiceInstruction({
      cue: decision.cue,
      currentStep,
      distanceToManeuver,
    }), {
      rate: 1,
      pitch: 1,
    });
  }, [currentStep, distanceToManeuver, enabled, routeFetchedAt, stepIndex]);
}
