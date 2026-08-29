import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { firestore } from '@/services/firebase/firebase';
import type { SharedRideDoc } from '@pakyaw/shared/features/trip/types';
import type { BookingDraft } from '@/stores/bookingDraftStore';
import { isRouteCompatible } from '@pakyaw/shared/lib/routeMatching';
import { LEGACY_SHARED_RIDES_COLLECTION } from '@pakyaw/shared/transport/contract';

export function useNearbySharedRides(draft: BookingDraft) {
  const [rides, setRides] = useState<SharedRideDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const enabled = draft.rideMode === 'hopon' && !!draft.pickup?.coords && !!draft.destination?.coords;

  useEffect(() => {
    if (!enabled) return;

    // We will listen to all active shared rides. If it scales we would use geohashes.
    // For now, let's query all active shared rides and filter client side.
    const q = query(
      collection(firestore, LEGACY_SHARED_RIDES_COLLECTION),
      where('status', '==', 'active')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const activeRides = snapshot.docs.map(doc => doc.data() as SharedRideDoc);
      
      const compatibleRides = activeRides.filter(ride => {
        if (!draft.pickup || !draft.destination) return false;
        
        // Use a dummy driver location (start of route) if we don't know exactly where the driver is yet,
        // or better, if the sharedRide has a `driverLocation` we would use that.
        // Assuming driver is at the most recent passenger pickup for now as a rough estimate.
        const driverLocation = ride.routeOrigin; 

        const result = isRouteCompatible(
          ride,
          draft.pickup,
          draft.destination,
          draft.passengerCount,
          driverLocation
        );

        return result.compatible;
      });

      setRides(compatibleRides);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching nearby shared rides', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [draft.pickup, draft.destination, draft.passengerCount, enabled]);

  return { rides: enabled ? rides : [], loading: enabled ? loading : false };
}
