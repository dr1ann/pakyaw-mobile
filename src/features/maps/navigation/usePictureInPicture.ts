import { useEffect, useRef } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';

import { logger } from '@pakyaw/shared/lib/logger';
import { useUiStore } from '@/stores/uiStore';
import * as Pip from '../../../../modules/expo-pip/src/ExpoPipModule';

type UsePictureInPictureParams = {
  readonly isDriving: boolean;
};

export function usePictureInPicture({
  isDriving,
}: UsePictureInPictureParams): void {
  const isDrivingRef = useRef(isDriving);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    isDrivingRef.current = isDriving;
  }, [isDriving]);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      useUiStore.getState().setPipState({
        isInPip: false,
        isSupported: false,
      });
      return;
    }

    const setPipState = useUiStore.getState().setPipState;
    const supported = Pip.isSupported();
    setPipState({
      isSupported: supported,
      isInPip: Pip.isActive(),
    });
    Pip.emitCurrentState();

    const pipSubscription = Pip.addPipModeChangedListener((event) => {
      setPipState({
        isInPip: event.isInPip,
        isSupported: event.isSupported,
      });
      logger.info(event.isInPip ? 'pip.entered' : 'pip.exited');
    });

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'inactive') {
        return;
      }

      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if (previousState === 'active' && nextState === 'background') {
        if (!isDrivingRef.current) {
          return;
        }

        if (!Pip.isSupported()) {
          logger.info('pip.unsupported');
          setPipState({ isInPip: false, isSupported: false });
          return;
        }

        // Do NOT optimistically flip isInPip — Pip.enter() may be denied by
        // the OS (eligibility, OEM policy, screen-off). If we lie about PiP
        // being active, downstream consumers (e.g. useLocationPublisher) keep
        // the foreground GPS stream alive against a dead surface, which
        // surfaces as the Frustum-null NPE in MapView.java:677. Only commit
        // isInPip after Pip.enter() resolves successfully, and let the OS
        // onPipModeChanged event remain the authoritative source.
        void Pip.enter({ aspectRatio: { num: 16, den: 16 } })
          .then((entered) => {
            const actuallyInPip = entered || Pip.isActive();
            setPipState({ isInPip: actuallyInPip, isSupported: true });
            logger.info(actuallyInPip ? 'pip.entered' : 'pip.unsupported');
          })
          .catch((err) => {
            setPipState({ isInPip: false });
            logger.warn('pip.enter_failed', { error: String(err) });
          });
        return;
      }

      if (previousState !== 'active' && nextState === 'active') {
        setPipState({
          isInPip: false,
          isSupported: Pip.isSupported(),
        });
        Pip.emitCurrentState();
      }
    });

    return () => {
      pipSubscription.remove();
      appStateSubscription.remove();
    };
  }, []);
}
