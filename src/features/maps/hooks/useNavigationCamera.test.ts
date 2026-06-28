import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useNavigationCamera } from './useNavigationCamera';

let mockNavCameraMode = 'overview';
const mockSetNavCameraMode = vi.fn();

vi.mock('@/stores/activeTripStore', () => ({
  useActiveTripStore: (selector: any) => selector({
    navCameraMode: mockNavCameraMode,
    setNavCameraMode: mockSetNavCameraMode,
  }),
}));

const mockCapturedEffects: any[] = [];
vi.mock('react', async (importOriginal) => {
  const original = await importOriginal<typeof import('react')>();
  return {
    ...original,
    useEffect: (eff: any, deps: any) => {
      mockCapturedEffects.push(eff);
    },
    useRef: (init: any) => ({ current: init }),
  };
});

describe('useNavigationCamera', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavCameraMode = 'overview';
    mockCapturedEffects.length = 0;
  });

  it('sets follow mode on active nav status', () => {
    useNavigationCamera('accepted');
    mockCapturedEffects.forEach((eff) => eff());

    expect(mockSetNavCameraMode).toHaveBeenCalledWith('follow');
  });
});
