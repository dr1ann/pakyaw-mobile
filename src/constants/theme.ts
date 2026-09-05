export const colors = {
  // Brand / Primary (Blue)
  blue: {
    primary: '#2F80ED',
    gradientStart: '#3D8BFF',
    gradientEnd: '#1E6FE0',
    tint: '#E8F1FE',
    deep: '#0B1B3F',
  },

  // Secondary (Amber / Orange)
  amber: {
    primary: '#F5A623',
    tint: '#FDEFD8',
    deep: '#E07B00',
  },

  // Driver accent (Green)
  green: {
    primary: '#27AE60',
    tint: '#E3F6EC',
  },

  // Fleet accent (Violet)
  violet: {
    primary: '#7B61FF',
    gradientStart: '#8E7BFF',
    gradientEnd: '#6C4FE0',
    tint: '#EFEAFE',
  },

  // Pakyaw cyan accent
  cyan: {
    primary: '#00C6D7',
    tint: '#E0F9FB',
    deep: '#008B97',
  },

  // Semantic states
  success: '#27AE60',
  warning: '#F2A93B',
  danger: '#EB5757',
  dangerSubtle: '#FDECEC',
  info: '#2F80ED',

  // Neutrals / Ink
  ink: {
    900: '#0E1726',
    700: '#33415C',
    500: '#6B7689',
    400: '#9AA4B2',
  },

  // Semantic text roles
  text: {
    primary: '#0E1726',
    secondary: '#33415C',
    muted: '#6B7689',
    subtle: '#9AA4B2',
    inverse: '#FFFFFF',
    danger: '#EB5757',
    success: '#27AE60',
    warning: '#F2A93B',
    info: '#2F80ED',
  },

  // Surfaces
  surface: {
    card: '#FFFFFF',
    muted: '#F4F7FB',
    bgPassenger: '#EAF1FB',
    bgLight: '#F7FAFE',
  },

  // Overlay / backdrop
  overlay: 'rgba(14, 23, 38, 0.5)',

  // Border
  border: {
    subtle: '#E6EBF2',
    default: '#CBD5E1',
    focus: '#2F80ED',
    danger: '#EB5757',
  },

  // Utility
  white: '#FFFFFF',
} as const;

export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  15: 60,
  20: 80,
} as const;

export const radius = {
  xs: 4,
  sm: 10,
  md: 14,
  lg: 20,
  pill: 999,
} as const;

export const shadow = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  float: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 8,
  },
} as const;

export const typography = {
  family: {
    regular: 'Montserrat_400Regular',
    medium: 'Montserrat_500Medium',
    semibold: 'Montserrat_600SemiBold',
    bold: 'Montserrat_700Bold',
    extraBold: 'Montserrat_800ExtraBold',
  },
  size: {
    caption: 12,
    label: 11,
    bodySmall: 13,
    body: 15,
    bodyMd: 16,
    button: 15,
    h3: 18,
    h2: 24,
    h1: 30,
    display: 32,
    hero: 38,
  },
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extraBold: '800' as const,
  },
  letterSpacing: {
    tight: -0.4,
    normal: 0,
    wide: 0.2,
    label: 0.8,
  },
  lineHeight: {
    caption: 16,
    bodySmall: 20,
    body: 22,
    bodyMd: 24,
    h3: 26,
    h2: 32,
    h1: 36,
    display: 38,
    hero: 46,
  },
} as const;

export { motion } from '@pakyaw/shared/constants/motion';
