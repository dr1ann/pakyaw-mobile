import type { PipEnterOptions, PipModeChangedEvent } from './ExpoPip.types';

export function isSupported(): boolean {
  return false;
}

export function isActive(): boolean {
  return false;
}

export function emitCurrentState(): void {
  // Picture-in-picture navigation is Android-only.
}

export async function enter(_options: PipEnterOptions = {}): Promise<boolean> {
  return false;
}

export function addPipModeChangedListener(
  _listener: (event: PipModeChangedEvent) => void,
): { remove: () => void } {
  return { remove: () => undefined };
}

export type { PipEnterOptions, PipModeChangedEvent };
