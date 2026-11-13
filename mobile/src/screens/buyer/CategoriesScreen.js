import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { getCategories } from '../../api/categoriesApi';
import { getCategoryIconName } from '../../utils/categoryIcons';
import AnimatedPressable from '../../components/common/AnimatedPressable';
import { colors } from '../../theme/colors';
import { shadows } from '../../theme/shadows';

const CATEGORY_ACCENT_COLORS = {
  all: { bg: colors.primarySoft, iconBg: colors.primary, iconColor: '#FFF', border: '#F8CAD1' },
  electronics: { bg: '#EFF6FF', iconBg: '#2563EB', iconColor: '#FFF', border: '#BFDBFE' },
  clothing: { bg: '#FDF2F8', iconBg: '#DB2777', iconColor: '#FFF', border: '#FBCFE8' },
  shoes: { bg: '#FBF6EC', iconBg: '#D6A33A', iconColor: '#FFF', border: '#EBD6A7' },
  home: { bg: '#ECFDF5', iconBg: '#059669', iconColor: '#FFF', border: '#A7F3D0' },
  beauty: { bg: '#FFF1F2', iconBg: '#F43F5E', iconColor: '#FFF', border: '#FECDD3' },
  kids: { bg: '#FFF7ED', iconBg: '#F97316', iconColor: '#FFF', border: '#FED7AA' },
  sports: { bg: '#F0FDFA', iconBg: '#0D9488', iconColor: '#FFF', border: '#99F6E4' },
  accessories: { bg: '#EEF2FF', iconBg: '#4F46E5', iconColor: '#FFF', border: '#C7D2FE' },
  other: { bg: '#FAF8F5', iconBg: '#1F2329', iconColor: '#FFF', border: '#ECE9E6' },
};

export default function CategoriesScreen({ navigation }) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const isRTL = i18n?.language?.startsWith('ar');
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Dynamic clearance for the floating navigation pill
  const floatingNavClearance = 64 + Math.max(insets.bottom, Platform.OS === 'android' ? 14 : 10) + 16;

  const loadCategories = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const res = await getCategories();
      setCategories(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load categories', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadCategories(false);
  }, [loadCategories]);

  const handleSelectCategory = (categoryKey) => {
    navigation.navigate('Catalog', { categoryKey });
  };

  const allCategoryItems = [
    { key: 'all' },
    ...categories.map((c) => ({ id: c.id, key: c.key })),
  ];

  if (loading && !refreshing) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.screenBg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const renderHeader = () => (
    <View style={styles.bannerContainer}>
      <LinearGradient
        colors={['#14171B', '#1F2329', '#2B1318']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.bannerGradient}
      >
        <View style={styles.bannerTextCol}>
          <View style={styles.headerBadge}>
            <MaterialCommunityIcons name="creation" size={12} color={colors.accent} />
            <Text style={styles.headerBadgeText}>
              {isRTL ? 'سوق مصر • الأقسام والتصنيفات' : 'EGYPT SHOP • CATEGORIES'}
            </Text>
          </View>
          <Text style={styles.bannerTitle}>
            {t('buyer.allCategories')}
          </Text>
          <Text style={styles.bannerSubtitle}>
            {t('buyer.browseCategories')}
          </Text>
        </View>
        <View style={styles.bannerIconCircle}>
          <MaterialCommunityIcons name="shape-outline" size={30} color={colors.accent} />
        </View>
      </LinearGradient>
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.screenBg }]}>
      <FlatList
        data={allCategoryItems}
        numColumns={2}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        keyExtractor={(item) => item.key}
        contentContainerStyle={[styles.listContent, { paddingBottom: floatingNavClearance }]}
        columnWrapperStyle={styles.columnWrapper}
        ListHeaderComponent={renderHeader}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadCategories(true)}
            colors={[colors.primary]}
          />
        }
        renderItem={({ item }) => {
          const styleConfig = CATEGORY_ACCENT_COLORS[item.key] || CATEGORY_ACCENT_COLORS.other;
          const isAll = item.key === 'all';

          return (
            <View style={styles.cardWrapper}>
              <AnimatedPressable
                accessible={true}
                accessibilityRole="button"
                scaleTo={0.96}
                onPress={() => handleSelectCategory(item.key)}
                style={[
                  styles.categoryCard,
                  isAll ? styles.allCategoryCard : styles.regularCategoryCard,
                ]}
              >
                {/* Category Icon Medallion with Subtle 3D Depth */}
                <View
                  style={[
                    styles.iconWrap,
                    {
                      backgroundColor: styleConfig.iconBg,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={getCategoryIconName(item.key)}
                    size={26}
                    color={styleConfig.iconColor}
                  />
                </View>

                {/* Title */}
                <Text
                  style={[
                    styles.categoryName,
                    isAll && styles.allCategoryText,
                  ]}
                  numberOfLines={2}
                >
                  {t(`categories.${item.key}`, { defaultValue: item.key })}
                </Text>

                {/* Minimalist Explore Action Pill */}
                <View style={[styles.arrowPill, isAll && styles.arrowPillAll]}>
                  <MaterialCommunityIcons
                    name={isRTL ? 'chevron-left' : 'chevron-right'}
                    size={16}
                    color={isAll ? colors.primary : colors.textSecondary}
                  />
                </View>
              </AnimatedPressable>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 14,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },

  // Premium Header Banner
  bannerContainer: {
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
    ...shadows.cardElevated,
  },
  bannerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 20,
    paddingHorizontal: 18,
  },
  bannerTextCol: {
    flex: 1,
    marginRight: 10,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  headerBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  bannerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.white,
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  bannerSubtitle: {
    fontSize: 12.5,
    color: 'rgba(255, 255, 255, 0.82)',
    lineHeight: 18,
  },
  bannerIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Luxury 3D Category Card
  cardWrapper: {
    width: '48.5%',
    marginBottom: 14,
  },
  categoryCard: {
    width: '100%',
    borderRadius: 18,
    paddingVertical: 20,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1,
    ...shadows.cardElevated,
  },
  regularCategoryCard: {
    backgroundColor: colors.cardBg,
    borderColor: 'rgba(236, 233, 230, 0.95)',
    borderBottomWidth: 2.5,
    borderBottomColor: '#D8D4CF',
  },
  allCategoryCard: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primaryBorder,
    borderBottomWidth: 2.5,
    borderBottomColor: '#F8CAD1',
  },

  iconWrap: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    ...shadows.tactile,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: 0.1,
  },
  allCategoryText: {
    color: colors.primary,
    fontWeight: '900',
  },
  arrowPill: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  arrowPillAll: {
    backgroundColor: 'rgba(200, 16, 46, 0.08)',
  },
});
