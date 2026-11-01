/**
 * Centralized Design Tokens for Egypt Shop Mobile UI.
 * 100% Synchronized with Web Design System (admin-web/src/index.css)
 * 
 * Brand Colors:
 * - Primary Red:     #C8102E
 * - Charcoal:        #1F2329
 * - Warm White:      #FAF8F5
 * - Gold Accent:     #D6A33A
 * - Light Gray:      #ECE9E6
 */

export const colors = {
  // Brand & Action Palette
  primary: '#C8102E',           // Deep Egyptian Red: Key brand identity, primary actions, highlights
  primaryHover: '#A80D26',      // Darker red for active/pressed states
  primarySoft: '#FDF2F4',       // Soft red tint for badges and selected states
  primaryBorder: '#F8CAD1',     // Soft red border for alert boxes and chips

  // Secondary & Dark Contrast
  secondary: '#1F2329',         // Dark Charcoal Black: Typography, contrast, headers, announcement bar
  secondaryHover: '#14171B',    // Darker charcoal on hover/press
  secondaryLight: '#2D323B',    // Charcoal lighter shade (borders on dark header/hero)
  secondaryBorder: '#3A3F4A',   // Border on charcoal cards

  // High-Conversion CTA & Egyptian Accents
  accent: '#D6A33A',            // Calm Gold: Touches of luxury, ratings, exclusive highlights
  accentHover: '#C08F2D',       // Darker gold on press
  accentSoft: '#FBF6EC',        // Soft warm gold tint
  accentBorder: '#EBD6A7',      // Border for gold highlight banners

  // Surfaces & Backgrounds
  screenBg: '#FAF8F5',          // Warm white dominant surface
  cardBg: '#FFFFFF',            // Clean white card surface
  brandBg: '#FAF8F5',           // Alias for screenBg
  brandCard: '#FFFFFF',         // Alias for cardBg

  // Neutral & Dividers
  neutral: '#ECE9E6',           // Light Gray secondary background / dividers
  neutralDark: '#D8D4CF',       // Medium gray for scrollbars/dividers
  neutralText: '#595F69',       // Balanced dark gray for secondary text
  border: '#ECE9E6',            // Warm light gray subtle border

  // Typography
  textPrimary: '#1F2329',       // Charcoal black for prices, titles, headings
  textSecondary: '#595F69',     // Balanced dark gray for secondary labels and subtitles
  textName: '#1F2329',          // Product card titles
  oldPrice: '#8C929B',          // Struck-through previous price

  // Badges & Statuses
  discount: '#C8102E',          // Deep Red: Discount percentage badge, urgent alerts
  star: '#D6A33A',              // Calm Gold: Product rating stars
  newBadge: '#16A34A',          // Green: In-stock / verified badge
  success: '#16A34A',           // Standard success green
  successSoft: '#DCFCE7',       // Light green pill background
  warning: '#D6A33A',           // Amber warning
  warningSoft: '#FBF6EC',       // Amber pill background
  danger: '#C8102E',            // Danger red
  dangerSoft: '#FDF2F4',        // Danger pill background

  // UI States & Helpers
  white: '#FFFFFF',
  black: '#1F2329',
  shadow: '#1F2329',
  placeholderBg: '#ECE9E6',
  skeletonBg: '#ECE9E6',
  favoriteButtonBg: 'rgba(255, 255, 255, 0.95)',
  counterOverlayBg: 'rgba(31, 35, 41, 0.75)',
  disabledBg: '#ECE9E6',
  disabledText: '#8C929B',
};

export default colors;
