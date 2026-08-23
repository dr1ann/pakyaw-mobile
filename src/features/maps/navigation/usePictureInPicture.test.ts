import { AppState } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as Pip from '../../../../modules/expo-pip/src/ExpoPipModule';
import { useUiStore } from '@/stores/uiStore';
import { usePictureInPicture } from './usePictureInPicture';

vi.mock('react', async (importOriginal) => {
  const original = await importOriginal<typeof import('react')>();
  return {
    ...original,
    useEffect: (effect: () => void | (() => void)) => effect(),
    useRef: (initialValue: unknown) => ({ current: initialValue }),
  };
});

let appStateListener: ((nextState: string) => void) | null = null;

vi.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: vi.fn((_event, listener) => {
      appStateListener = listener;
      return { remove: vi.fn() };
    }),
  },
  Platform: {
    OS: 'android',
  },
}));

vi.mock('../../../../modules/expo-pip/src/ExpoPipModule', () => ({
  isSupported: vi.fn(() => true),
  isActive: vi.fn(() => false),
  emitCurrentState: vi.fn(),
  enter: vi.fn(async () => true),
  addPipModeChangedListener: vi.fn(() => ({ remove: vi.fn() })),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('usePictureInPicture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appStateListener = null;
    useUiStore.getState().resetPip();
  });

  it('enters PiP when the app backgrounds during driving', async () => {
    usePictureInPicture({ isDriving: true });

    expect(AppState.addEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function),
    );
    expect(useUiStore.getState().pip.isSupported).toBe(true);

    appStateListener?.('background');
    await Promise.resolve();

    expect(Pip.enter).toHaveBeenCalledWith({
      aspectRatio: { num: 16, den: 16 },
    });
    expect(useUiStore.getState().pip.isInPip).toBe(true);
  });

  it('does not enter PiP when not driving', async () => {
    usePictureInPicture({ isDriving: false });

    appStateListener?.('background');
    await Promise.resolve();

    expect(Pip.enter).not.toHaveBeenCalled();
  });
});
