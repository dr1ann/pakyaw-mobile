import type { LatLng } from '../lib/geo';

/**
 * A named place the user can pick as pickup or destination.
 * Shared across passenger booking and driver matching.
 */
export type Place = {
  readonly label: string;
  readonly address?: string;
  readonly coords: LatLng | null;
};
