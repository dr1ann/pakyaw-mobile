import type { Maneuver } from './types';

/**
 * Maps a maneuver type to the corresponding SymbolIcon SF Symbol name.
 */
export function getManeuverIconName(maneuver: Maneuver | null): string {
  if (!maneuver) return 'arrow.up';

  switch (maneuver) {
    case 'turn-left':
    case 'turn-sharp-left':
      return 'arrow.turn.up.left';
    case 'turn-right':
    case 'turn-sharp-right':
      return 'arrow.turn.up.right';
    case 'turn-slight-left':
    case 'keep-left':
    case 'fork-left':
    case 'ramp-left':
      return 'arrow.up.left';
    case 'turn-slight-right':
    case 'keep-right':
    case 'fork-right':
    case 'ramp-right':
      return 'arrow.up.right';
    case 'uturn-left':
      return 'arrow.uturn.left';
    case 'uturn-right':
      return 'arrow.uturn.right';
    case 'roundabout-left':
    case 'roundabout-right':
      return 'arrow.triangle.2.circlepath';
    case 'ferry':
      return 'ferry';
    case 'depart':
      return 'navigation';
    case 'arrive':
      return 'mappin';
    case 'straight':
    case 'merge':
    default:
      return 'arrow.up';
  }
}
