import tw from 'twrnc';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { getCategories } from '../../api/categoriesApi';
import { getCategoryIconName } from '../../utils/categoryIcons';
import { colors } from '../../theme/colors';

const cardShadow = Platform.select({
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
});

const CATEGORY_ACCENT_COLORS = {
  all: { bg: '#FFF7ED', iconBg: colors.accent, iconColor: '#FFF' },
  electronics: { bg: '#EFF6FF', iconBg: '#3B82F6', iconColor: '#FFF' },
  clothing: { bg: '#FDF2F8', iconBg: '#EC4899', iconColor: '#FFF' },
  shoes: { bg: '#F5F3FF', iconBg: '#8B5CF6', iconColor: '#FFF' },
  home: { bg: '#F0FDF4', iconBg: '#10B981', iconColor: '#FFF' },
  beauty: { bg: '#FFF1F2', iconBg: '#F43F5E', iconColor: '#FFF' },
  kids: { bg: '#FEFCE8', iconBg: '#EAB308', iconColor: '#FFF' },
  sports: { bg: '#ECFEFF', iconBg: '#06B6D4', iconColor: '#FFF' },
  accessories: { bg: '#FAF5FF', iconBg: '#A855F7', iconColor: '#FFF' },
  other: { bg: '#F1F5F9', iconBg: '#64748B', iconColor: '#FFF' },
};

export default function CategoriesScreen({ navigation }) {
  const { t } = useTranslation();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
      <View style={[tw`flex-1 justify-center items-center`, { backgroundColor: colors.screenBg }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const renderHeader = () => (
    <View style={styles.bannerContainer}>
      <LinearGradient
        colors={['#0F172A', '#1E3A5F']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.bannerGradient}
      >
        <View style={tw`flex-1`}>
          <Text style={styles.bannerTitle}>
            {t('buyer.allCategories')}
          </Text>
          <Text style={styles.bannerSubtitle}>
            {t('buyer.browseCategories')}
          </Text>
        </View>
        <View style={styles.bannerIconCircle}>
          <MaterialCommunityIcons name="shape-outline" size={28} color={colors.accent} />
        </View>
      </LinearGradient>
    </View>
  );

  return (
    <View style={[tw`flex-1`, { backgroundColor: colors.screenBg }]}>
      <FlatList
        data={allCategoryItems}
        numColumns={2}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={tw`justify-between`}
        ListHeaderComponent={renderHeader}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadCategories(true)}
            colors={[colors.accent]}
          />
        }
        renderItem={({ item }) => {
          const styleConfig = CATEGORY_ACCENT_COLORS[item.key] || CATEGORY_ACCENT_COLORS.other;
          const isAll = item.key === 'all';

          return (
            <TouchableOpacity
              activeOpacity={0.82}
              onPress={() => handleSelectCategory(item.key)}
              style={[
                styles.categoryCard,
                cardShadow,
                isAll && styles.allCategoryCard,
              ]}
            >
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: styleConfig.iconBg },
                ]}
              >
                <MaterialCommunityIcons
                  name={getCategoryIconName(item.key)}
                  size={26}
                  color={styleConfig.iconColor}
                />
              </View>
              <Text
                style={[
                  styles.categoryName,
                  isAll && { color: colors.accent, fontWeight: '800' },
                ]}
                numberOfLines={2}
              >
                {t(`categories.${item.key}`, { defaultValue: item.key })}
              </Text>
              <View style={styles.arrowWrap}>
                <MaterialCommunityIcons
                  name="chevron-left"
                  size={18}
                  color={isAll ? colors.accent : colors.textSecondary}
                />
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  listContent: {
    padding: 12,
    paddingBottom: 28,
  },
  bannerContainer: {
    marginBottom: 16,
    borderRadius: 18,
    overflow: 'hidden',
    ...cardShadow,
  },
  bannerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 18,
  },
  bannerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.white,
    marginBottom: 4,
  },
  bannerSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 18,
  },
  bannerIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  categoryCard: {
    width: '48.5%',
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative',
  },
  allCategoryCard: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
  },
  arrowWrap: {
    marginTop: 4,
  },
});
