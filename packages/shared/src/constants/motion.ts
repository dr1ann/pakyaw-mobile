import { Easing } from 'react-native';

export const motion = {
  duration: {
    instant: 100,
    fast: 180,
    normal: 260,
    moderate: 340,
    slow: 450,
  },
  easing: {
    standard: Easing.bezier(0.2, 0.0, 0, 1.0),
    decelerate: Easing.bezier(0.0, 0.0, 0.2, 1.0),
    accelerate: Easing.bezier(0.4, 0.0, 1.0, 1.0),
    smooth: Easing.inOut(Easing.ease),
  },
  spring: {
    subtle: { damping: 22, stiffness: 240, mass: 0.8 },
    sheet: { damping: 26, stiffness: 280, mass: 0.9 },
    button: { damping: 18, stiffness: 300, mass: 0.6 },
  },
} as const;
