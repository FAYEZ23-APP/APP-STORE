import { Platform } from 'react-native';
import { colors } from './colors';

/**
 * Shared Elevations, Shadows & 3D Tactile Depth for Egypt Shop Mobile
 * Inspired by international luxury fashion e-commerce apps (Zara, H&M, Farfetch).
 */
export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: Platform.select({
    ios: {
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
    },
    android: {
      elevation: 1,
    },
    default: {},
  }),
  card: Platform.select({
    ios: {
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
    },
    android: {
      elevation: 2,
    },
    default: {},
  }),
  cardElevated: Platform.select({
    ios: {
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 10,
    },
    android: {
      elevation: 3,
    },
    default: {},
  }),
  md: Platform.select({
    ios: {
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 10,
    },
    android: {
      elevation: 3,
    },
    default: {},
  }),
  lg: Platform.select({
    ios: {
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 18,
    },
    android: {
      elevation: 6,
    },
    default: {},
  }),
  // Premium Floating Navigation Pill & Dialogs
  floating: Platform.select({
    ios: {
      shadowColor: '#0F1216',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.14,
      shadowRadius: 20,
    },
    android: {
      elevation: 12,
    },
    default: {},
  }),
  // Tactile 3D Button Depth
  tactile: Platform.select({
    ios: {
      shadowColor: '#1F2329',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.18,
      shadowRadius: 5,
    },
    android: {
      elevation: 4,
    },
    default: {},
  }),
  tactilePrimary: Platform.select({
    ios: {
      shadowColor: '#C8102E',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.28,
      shadowRadius: 8,
    },
    android: {
      elevation: 5,
    },
    default: {},
  }),
  glowGold: Platform.select({
    ios: {
      shadowColor: '#D6A33A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.32,
      shadowRadius: 10,
    },
    android: {
      elevation: 5,
    },
    default: {},
  }),
};

export default shadows;
