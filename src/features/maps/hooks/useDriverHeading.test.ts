import { beforeEach, describe, expect, it, vi } from 'vitest';
import { selectHeadingSource, useDriverHeading } from './useDriverHeading';

let mockGpsHeading: number | null = null;
let mockGpsSpeed: number | null = null;
let mockCompassEnabled = false;
let mockArrowRotation: number | null = null;
const mockSetNavHeading = vi.fn();
const mockSetArrowRotation = vi.fn();

vi.mock('@/stores/activeTripStore', () => ({
  useActiveTripStore: (selector: any) => selector({
    gpsHeading: mockGpsHeading,
    gpsSpeed: mockGpsSpeed,
    compassEnabled: mockCompassEnabled,
    arrowRotation: mockArrowRotation,
    setNavHeading: mockSetNavHeading,
    setArrowRotation: mockSetArrowRotation,
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

const mockDeviceMotion = {
  isAvailableAsync: vi.fn().mockResolvedValue(false),
  setUpdateInterval: vi.fn(),
  addListener: vi.fn(() => ({ remove: vi.fn() })),
};

vi.mock('expo-modules-core', () => ({
  requireOptionalNativeModule: vi.fn((name: string) => {
    if (name === 'ExponentDeviceMotion') return {};
    return null;
  }),
}));

vi.mock('expo-sensors', () => ({
  DeviceMotion: mockDeviceMotion,
}));

vi.mock('react', async (importOriginal) => {
  const original = await importOriginal<typeof import('react')>();
  return {
    ...original,
    useEffect: (eff: any, _deps: any) => {
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
    mockCompassEnabled = false;
    mockArrowRotation = null;
    mockCapturedEffects.length = 0;
    headingCallback = null;
  });

  it('does not subscribe to the magnetometer when compass mode is off (default)', () => {
    useDriverHeading('accepted');
    mockCapturedEffects.forEach((eff) => eff());

    expect(headingCallback).toBeNull();
  });

  it('subscribes to the magnetometer when compass mode is explicitly enabled', () => {
    mockCompassEnabled = true;
    useDriverHeading('accepted');
    mockCapturedEffects.forEach((eff) => eff());

    expect(headingCallback).not.toBeNull();
  });

  it('keeps compass heading until GPS course reaches the enter threshold (compass mode)', () => {
    expect(selectHeadingSource({
      previousSource: 'compass',
      gpsHeading: 90,
      gpsSpeed: 1.4,
      hasCompassHeading: true,
      compassEnabled: true,
      hasRouteBearing: false,
      hasGyro: false,
    })).toBe('compass');

    expect(selectHeadingSource({
      previousSource: 'compass',
      gpsHeading: 90,
      gpsSpeed: 1.5,
      hasCompassHeading: true,
      compassEnabled: true,
      hasRouteBearing: false,
      hasGyro: false,
    })).toBe('gps');
  });

  it('keeps GPS course until speed drops below the lower release threshold', () => {
    expect(selectHeadingSource({
      previousSource: 'gps',
      gpsHeading: 90,
      gpsSpeed: 1.1,
      hasCompassHeading: true,
      compassEnabled: true,
      hasRouteBearing: false,
      hasGyro: false,
    })).toBe('gps');

    expect(selectHeadingSource({
      previousSource: 'gps',
      gpsHeading: 90,
      gpsSpeed: 0.9,
      hasCompassHeading: true,
      compassEnabled: true,
      hasRouteBearing: false,
      hasGyro: false,
    })).toBe('compass');
  });

  it('falls back to route bearing (not compass) when stationary and compass is disabled', () => {
    expect(selectHeadingSource({
      previousSource: 'gps',
      gpsHeading: 90,
      gpsSpeed: 0.5,
      hasCompassHeading: true,
      compassEnabled: false,
      hasRouteBearing: true,
      hasGyro: false,
    })).toBe('route');
  });

  it('returns null when stationary, compass disabled, and no route bearing is available', () => {
    expect(selectHeadingSource({
      previousSource: null,
      gpsHeading: null,
      gpsSpeed: null,
      hasCompassHeading: false,
      compassEnabled: false,
      hasRouteBearing: false,
      hasGyro: false,
    })).toBeNull();
  });
});
