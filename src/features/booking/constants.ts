import type { Place } from '@pakyaw/shared/types/place';

export const ORMOC_LANDMARKS: readonly Place[] = [
  {
    label: 'Robinsons Place Ormoc',
    address: 'Brgy. Cogon, Ormoc City, Leyte',
    coords: { lat: 11.025467127451368, lng: 124.60509243084043 },
  },
  {
    label: 'Ormoc Superdome',
    address: 'Larrazabal Blvd, Ormoc City, Leyte',
    coords: { lat: 11.004196339986503, lng: 124.60958545198201 },
  },
  {
    label: 'SM Center Ormoc',
    address: 'Real St, Brgy. District 14, Ormoc City, Leyte',
    coords: { lat: 11.010894765109262, lng: 124.60771518229937 },
  },
  {
    label: 'Ormoc City Hall',
    address: 'Avelino St, Ormoc City, Leyte',
    coords: { lat: 11.01338557648569, lng: 124.60477265161069 },
  },
];

export const SAVED_PICKUP_PLACES: readonly Place[] = [];
export const SAVED_DESTINATION_PLACES: readonly Place[] = [];
