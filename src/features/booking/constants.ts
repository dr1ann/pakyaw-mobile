import type { Place } from '@pakyaw/shared/types/place';

export const SAVED_PICKUP_PLACES: readonly Place[] = [
  { label: 'Home', address: 'Your saved home address', coords: { lat: 14.599512, lng: 120.984222 } },
  { label: 'Work', address: 'Your saved work address', coords: { lat: 14.601931, lng: 120.988019 } },
];

export const SAVED_DESTINATION_PLACES: readonly Place[] = [
  { label: 'Home', address: 'Your saved home address', coords: { lat: 14.599512, lng: 120.984222 } },
  { label: 'Work', address: 'Your saved work address', coords: { lat: 14.601931, lng: 120.988019 } },
  { label: 'School', address: 'Your saved school address', coords: { lat: 14.596201, lng: 120.981105 } },
];
