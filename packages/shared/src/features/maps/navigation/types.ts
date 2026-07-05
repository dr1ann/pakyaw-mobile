import type { LatLng } from '@pakyaw/shared/lib/geo';

export type NavPhase = 'idle' | 'to_pickup' | 'at_pickup' | 'to_destination' | 'ended';

export type CameraMode = 'follow' | 'overview';

export type Maneuver =
  | 'turn-left'
  | 'turn-right'
  | 'turn-slight-left'
  | 'turn-slight-right'
  | 'turn-sharp-left'
  | 'turn-sharp-right'
  | 'uturn-left'
  | 'uturn-right'
  | 'straight'
  | 'ramp-left'
  | 'ramp-right'
  | 'merge'
  | 'fork-left'
  | 'fork-right'
  | 'keep-left'
  | 'keep-right'
  | 'roundabout-left'
  | 'roundabout-right'
  | 'ferry'
  | 'depart'
  | 'arrive';

export interface NavStep {
  readonly maneuver: Maneuver | null;
  readonly instruction: string;           // HTML-stripped instruction
  readonly roadName: string | null;       // extracted road name
  readonly distanceMeters: number;
  readonly startLocation: LatLng;
  readonly endLocation: LatLng;
  readonly polyline: LatLng[];             // decoded step geometry
}

export interface NavRoute {
  readonly steps: readonly NavStep[];
  readonly overviewPolyline: string;
  readonly distanceMeters: number;
  readonly durationSeconds: number;
  readonly fetchedAt: number;              // epoch ms (client clock)
}
