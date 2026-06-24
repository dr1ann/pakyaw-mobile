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

  // Semantic
  success: '#27AE60',
  warning: '#F2A93B',
  danger: '#EB5757',
  info: '#2F80ED',

  // Neutrals / Ink
  ink: {
    900: '#0E1726',
    700: '#33415C',
    500: '#6B7689',
    400: '#9AA4B2',
  },

  // Surfaces
  surface: {
    card: '#FFFFFF',
    muted: '#F4F7FB',
    bgPassenger: '#EAF1FB',
    bgLight: '#F7FAFE',
  },

  // Border
  border: {
    subtle: '#E6EBF2',
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
  sm: 10,
  md: 14,
  lg: 20,
  pill: 999,
} as const;

export const shadow = {
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
  size: {
    label: 11,
    bodySmall: 13,
    body: 15,
    bodyMd: 16,
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
    label: 0.8,
  },
  lineHeight: {
    body: 22,
    bodySmall: 20,
    h1: 36,
    display: 38,
  },
} as const;
