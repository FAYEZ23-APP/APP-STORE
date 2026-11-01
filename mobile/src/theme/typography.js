import { Platform } from 'react-native';

/**
 * Shared Typography System for Egypt Shop Mobile
 * Matching Cairo font hierarchy and weight distribution from the Web system.
 */
export const typography = {
  fontFamily: Platform.select({
    ios: 'System',
    android: 'sans-serif',
    default: 'sans-serif',
  }),
  weights: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    black: '800',
    heavy: '900',
  },
  sizes: {
    '2xs': 10,
    xs: 11,
    sm: 13,
    base: 15,
    lg: 17,
    xl: 20,
    '2xl': 24,
    '3xl': 28,
    '4xl': 34,
  },
  lineHeights: {
    tight: 1.15,
    normal: 1.35,
    relaxed: 1.5,
  },
};

export default typography;
