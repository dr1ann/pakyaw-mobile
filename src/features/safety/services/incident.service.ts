import { functions, httpsCallable } from '@/services/firebase/firebase';

export type IncidentLocation = { readonly latitude: number; readonly longitude: number };

export async function createTripIncident(
  tripId: string,
  triggeredBy: string,
  location: IncidentLocation,
  category?: string,
  notes?: string,
): Promise<{ readonly incidentId: string; readonly status: 'active' }> {
  const createIncident = httpsCallable<
    {
      readonly tripId: string;
      readonly triggeredBy: string;
      readonly location: IncidentLocation;
      readonly category?: string;
      readonly notes?: string;
    },
    { readonly incidentId: string; readonly status: 'active' }
  >(functions, 'createIncident');
  return (await createIncident({
    tripId,
    triggeredBy,
    location,
    ...(category ? { category } : {}),
    ...(notes ? { notes } : {}),
  })).data;
}

export async function getSafetyStatus(): Promise<{ readonly sosEnabled: boolean }> {
  const getStatus = httpsCallable<Record<string, never>, { readonly sosEnabled: boolean }>(functions, 'getSafetyStatus');
  return (await getStatus({})).data;
}
