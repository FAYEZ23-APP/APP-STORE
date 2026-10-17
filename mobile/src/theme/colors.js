/**
 * Centralized Design Tokens for the Egyptian Marketplace UI (Option A: Navy & Orange).
 * Inspired by modern Egyptian e-commerce platforms (Amazon Egypt, Jumia, Noon).
 */
export const colors = {
  // Brand & Action Palette
  primary: '#0F172A',         // Deep Navy/Slate: Headings, brand accents, primary buttons
  primaryHover: '#1E293B',    // Hover/press dark navy
  primarySoft: '#F1F5F9',     // Soft slate background

  // High-Conversion CTA & Accents
  accent: '#FF6B00',          // Vibrant Orange: Add to cart, Buy Now, important CTAs
  accentHover: '#EA580C',     // Darker orange on press
  accentSoft: '#FFF7ED',      // Very light warm orange tint

  // Badges & Statuses
  discount: '#DC2626',        // Red: Discount percentage badge, low stock warning
  newBadge: '#16A34A',        // Green: "جديد" / "Новинка" badge & In-stock status
  star: '#F59E0B',            // Amber Gold: Product ratings star

  // Surfaces & Backgrounds
  screenBg: '#F8FAFC',        // Modern light slate background
  cardBg: '#FFFFFF',          // Crisp white card surface
  border: '#E2E8F0',          // Subtle border

  // Typography
  textPrimary: '#0F172A',     // Dominant dark text for prices, titles, headings
  textSecondary: '#64748B',   // Muted secondary text
  textName: '#1E293B',        // Product card titles
  oldPrice: '#94A3B8',        // Struck-through previous price

  // UI States & Helpers
  white: '#FFFFFF',
  shadow: '#0F172A',
  placeholderBg: '#F1F5F9',
  skeletonBg: '#E2E8F0',
  favoriteButtonBg: 'rgba(255, 255, 255, 0.95)',
  counterOverlayBg: 'rgba(15, 23, 42, 0.70)',
  successSoft: '#DCFCE7',
  dangerSoft: '#FEE2E2',
  disabledBg: '#E2E8F0',
  disabledText: '#94A3B8',
};

export default colors;
