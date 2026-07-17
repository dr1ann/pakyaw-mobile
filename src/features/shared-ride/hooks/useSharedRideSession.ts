import { useEffect, useState } from 'react';
import { useSessionStore } from '@pakyaw/shared/stores/sessionStore';
import { doc, onSnapshot } from 'firebase/firestore';
import { firestore } from '@/services/firebase/firebase';
import type { SharedRideDoc } from '@pakyaw/shared/features/trip/types';

export function useSharedRideSession() {
  const uid = useSessionStore((s) => s.uid);
  const [sharedRideId, setSharedRideId] = useState<string | null>(null);
  const [sharedRide, setSharedRide] = useState<SharedRideDoc | null>(null);

  useEffect(() => {
    if (!uid) return;

    // Listen to driver doc to get activeSharedRideId
    const unsubDriver = onSnapshot(doc(firestore, 'drivers', uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setSharedRideId(data.activeSharedRideId || null);
      }
    });

    return () => unsubDriver();
  }, [uid]);

  useEffect(() => {
    if (!sharedRideId) {
      setSharedRide(null);
      return;
    }

    const unsubSharedRide = onSnapshot(doc(firestore, 'shared_rides', sharedRideId), (snap) => {
      if (snap.exists()) {
        setSharedRide(snap.data() as SharedRideDoc);
      } else {
        setSharedRide(null);
      }
    });

    return () => unsubSharedRide();
  }, [sharedRideId]);

  return { sharedRide, sharedRideId };
}
