import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { firestore } from '@/services/firebase/firebase';
import type { SharedRideDoc } from '@pakyaw/shared/features/trip/types';
import type { BookingDraft } from '@/stores/bookingDraftStore';
import { geohashNeighbors } from '@pakyaw/shared/lib/geo';
import { isRouteCompatible } from '@pakyaw/shared/lib/routeMatching';

export function useNearbySharedRides(draft: BookingDraft) {
  const [rides, setRides] = useState<SharedRideDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (draft.rideMode !== 'hopon' || !draft.pickup?.coords || !draft.destination?.coords) {
      setRides([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // We will listen to all active shared rides. If it scales we would use geohashes.
    // For now, let's query all active shared rides and filter client side.
    const q = query(
      collection(firestore, 'shared_rides'),
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
  }, [draft.rideMode, draft.pickup, draft.destination, draft.passengerCount]);

  return { rides, loading };
}
