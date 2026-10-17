import { MaterialCommunityIcons } from '@expo/vector-icons';

/**
 * Fallback icon guaranteed to exist in @expo/vector-icons MaterialCommunityIcons.
 */
export const FALLBACK_CATEGORY_ICON = 'shape-outline';

/**
 * Explicit mapping from category `key` -> verified MaterialCommunityIcons icon name.
 * Never relies on the raw IconName string from the backend API.
 * Every icon name below has been verified against MaterialCommunityIcons.glyphMap.
 */
export const CATEGORY_ICON_MAP = {
  all: 'view-grid-outline',
  electronics: 'devices',
  clothing: 'tshirt-crew',
  shoes: 'shoe-sneaker',
  home: 'home',
  beauty: 'shimmer',
  kids: 'baby-face-outline',
  sports: 'basketball',
  accessories: 'watch',
  other: 'dots-horizontal',
};

/**
 * Resolves a verified MaterialCommunityIcons icon name for a given category key.
 * Falls back to FALLBACK_CATEGORY_ICON ('shape-outline') if the key is unknown
 * or if the mapped icon name is not present in MaterialCommunityIcons.glyphMap.
 */
export const getCategoryIconName = (categoryKey) => {
  const normalizedKey = typeof categoryKey === 'string' ? categoryKey.trim().toLowerCase() : '';
  const candidate = CATEGORY_ICON_MAP[normalizedKey] || FALLBACK_CATEGORY_ICON;

  const glyphMap = MaterialCommunityIcons?.glyphMap;
  if (glyphMap && !(candidate in glyphMap)) {
    return FALLBACK_CATEGORY_ICON;
  }

  return candidate;
};
