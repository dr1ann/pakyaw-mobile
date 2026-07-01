import { NativeModule, requireNativeModule } from 'expo';

import type {
  ExpoPipModuleEvents,
  PipEnterOptions,
  PipModeChangedEvent,
} from './ExpoPip.types';

declare class ExpoPipNativeModule extends NativeModule<ExpoPipModuleEvents> {
  isSupported(): boolean;
  isActive(): boolean;
  emitCurrentState(): void;
  enter(options: PipEnterOptions): Promise<boolean>;
}

let nativeModule: ExpoPipNativeModule | null = null;

function getNativeModule(): ExpoPipNativeModule | null {
  if (nativeModule) {
    return nativeModule;
  }

  try {
    nativeModule = requireNativeModule<ExpoPipNativeModule>('ExpoPip');
  } catch {
    nativeModule = null;
  }

  return nativeModule;
}

export function isSupported(): boolean {
  return getNativeModule()?.isSupported() ?? false;
}

export function isActive(): boolean {
  return getNativeModule()?.isActive() ?? false;
}

export function emitCurrentState(): void {
  getNativeModule()?.emitCurrentState();
}

export async function enter(options: PipEnterOptions = {}): Promise<boolean> {
  return getNativeModule()?.enter(options) ?? false;
}

export function addPipModeChangedListener(
  listener: (event: PipModeChangedEvent) => void,
): { remove: () => void } {
  return (
    getNativeModule()?.addListener('onPipModeChanged', listener) ?? {
      remove: () => undefined,
    }
  );
}

export type { PipEnterOptions, PipModeChangedEvent };
