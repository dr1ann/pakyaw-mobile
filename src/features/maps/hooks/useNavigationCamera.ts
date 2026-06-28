import { useEffect, useRef } from 'react';
import { useActiveTripStore } from '@/stores/activeTripStore';
import { NAV_RECENTER_IDLE_MS } from '../navigation/constants';
import { isNavActiveStatus } from '../navigation/navigationHelper';

/**
 * Hook to manage camera state between follow mode and manual overview mode.
 * Auto-recenters back to follow mode after 8 seconds of idle time.
 */
export function useNavigationCamera(status: string | null) {
  const navCameraMode = useActiveTripStore((s) => s.navCameraMode);
  const setNavCameraMode = useActiveTripStore((s) => s.setNavCameraMode);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isNavActive = isNavActiveStatus(status);

  const resetRecenterTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      setNavCameraMode('follow');
    }, NAV_RECENTER_IDLE_MS);
  };

  // Automatically default to follow mode when entering a navigation phase,
  // and return to overview when navigation ends.
  useEffect(() => {
    if (isNavActive) {
      setNavCameraMode('follow');
    } else {
      setNavCameraMode('overview');
    }
  }, [status, isNavActive, setNavCameraMode]);

  // Handle auto-recenter 8-second idle timer when driver panned/gestured the map
  useEffect(() => {
    if (!isNavActive || navCameraMode !== 'overview') {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    resetRecenterTimer();

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navCameraMode, isNavActive]);

  const handleUserPan = () => {
    if (isNavActive) {
      setNavCameraMode('overview');
      resetRecenterTimer();
    }
  };

  return {
    handleUserPan,
  };
}
