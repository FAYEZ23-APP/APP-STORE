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
  accentText: '#7A4F00',        // WCAG AA compliant dark gold/amber for text on light backgrounds (6.72:1)
  accentContrast: '#1F2329',    // High-contrast charcoal text for elements on gold backgrounds (6.88:1)
  gold: '#D6A33A',              // Alias for accent (Calm Gold)
  goldHover: '#C08F2D',         // Alias for accentHover
  goldSoft: '#FBF6EC',          // Alias for accentSoft
  goldBorder: '#EBD6A7',        // Alias for accentBorder
  goldText: '#7A4F00',          // Alias for accentText

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
  textMuted: '#595F69',         // High-contrast muted hints and timestamps (WCAG AA compliant)
  textDark: '#1F2329',          // Alias for primary dark text
  text: '#1F2329',              // Alias for primary text
  textName: '#1F2329',          // Product card titles
  oldPrice: '#595F69',          // High-contrast struck-through previous price (>6.0:1 WCAG AA)

  // Badges & Statuses
  discount: '#C8102E',          // Deep Red: Discount percentage badge, urgent alerts
  star: '#D6A33A',              // Calm Gold: Product rating stars
  newBadge: '#16A34A',          // Green: In-stock / verified badge
  newBadgeSoft: '#DCFCE7',      // Soft green tint for badges
  success: '#16A34A',           // Standard success green
  successSoft: '#DCFCE7',       // Light green pill background
  warning: '#7A4F00',           // High-contrast Amber warning text (>6.5:1)
  warningSoft: '#FBF6EC',       // Amber pill background
  danger: '#C8102E',            // Danger red
  error: '#C8102E',             // Alias for danger/error red
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
  disabledText: '#595F69',      // High-contrast disabled text (>6.0:1 WCAG AA)
};

export default colors;
