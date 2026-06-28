import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDriverHeading } from './useDriverHeading';

let mockGpsHeading: number | null = null;
let mockGpsSpeed: number | null = null;
const mockSetNavHeading = vi.fn();

vi.mock('@/stores/activeTripStore', () => ({
  useActiveTripStore: (selector: any) => selector({
    gpsHeading: mockGpsHeading,
    gpsSpeed: mockGpsSpeed,
    setNavHeading: mockSetNavHeading,
  }),
}));

const mockCapturedEffects: any[] = [];
let headingCallback: any = null;

vi.mock('expo-location', () => ({
  watchHeadingAsync: vi.fn().mockImplementation((cb) => {
    headingCallback = cb;
    return Promise.resolve({ remove: vi.fn() });
  }),
}));

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

describe('useDriverHeading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGpsHeading = null;
    mockGpsSpeed = null;
    mockCapturedEffects.length = 0;
    headingCallback = null;
  });

  it('subscribes to heading when navigation is active', () => {
    useDriverHeading('accepted');
    mockCapturedEffects.forEach((eff) => eff());

    expect(headingCallback).not.toBeNull();
  });
});
