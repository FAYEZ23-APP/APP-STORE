import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Dimensions,
  StyleSheet,
  FlatList,
  Platform,
  I18nManager,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { getActiveCampaigns } from '../../api/campaignsApi';
import AnimatedPressable from '../common/AnimatedPressable';
import PremiumButton from '../common/PremiumButton';
import { colors } from '../../theme/colors';
import { shadows } from '../../theme/shadows';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// Aspect ratio between 1.15 and 1.25 for luxury fashion editorial presence
const BANNER_HEIGHT = Math.min(Math.round(SCREEN_WIDTH * 1.18), 460);

// Curated default editorial campaigns (Zara & H&M style) as resilient instant fallback
const FALLBACK_CAMPAIGNS = [
  {
    id: 1,
    titleAr: 'مجموعة الموسم الجديد',
    titleEn: 'NEW SEASON COLLECTION',
    subtitleAr: 'تصاميم راقية وخامات مختارة بعناية تعكس تميزك وتلبي طموحك',
    subtitleEn: 'Refined silhouettes and modern craftsmanship for every moment',
    ctaAr: 'اكتشف التشكيلة',
    ctaEn: 'EXPLORE COLLECTION',
    badgeAr: 'الموسم الجديد',
    badgeEn: 'NEW ARRIVALS',
    imageUrlMobile: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=900&auto=format&fit=crop&q=85',
    targetUrl: 'category:clothing',
    priority: 1,
    textAlignment: 'center',
    overlayOpacity: 0.35,
  },
  {
    id: 2,
    titleAr: 'أناقة هادئة وبساطة عصرية',
    titleEn: 'THE QUIET LUXURY EDIT',
    subtitleAr: 'قصات كلاسيكية راقية تمنحك إطلالة متجددة طوال اليوم',
    subtitleEn: 'Timeless tailoring and effortless neutral aesthetics',
    ctaAr: 'تسوق الإطلالة',
    ctaEn: 'SHOP THE EDIT',
    badgeAr: 'تشكيلة حصرية',
    badgeEn: 'EXCLUSIVE',
    imageUrlMobile: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=900&auto=format&fit=crop&q=85',
    targetUrl: 'category:clothing',
    priority: 2,
    textAlignment: 'center',
    overlayOpacity: 0.30,
  },
  {
    id: 3,
    titleAr: 'أزياء الشارع العصرية',
    titleEn: 'URBAN STREETWEAR CAPSULE',
    subtitleAr: 'أحدث تصاميم السنيكرز والملابس الرياضية اليومية بأفضل الأسعار',
    subtitleEn: 'Bold contemporary streetwear and essential statement pieces',
    ctaAr: 'تصفح العروض',
    ctaEn: 'VIEW CAPSULE',
    badgeAr: 'الأكثر طلباً',
    badgeEn: 'TRENDING',
    imageUrlMobile: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=900&auto=format&fit=crop&q=85',
    targetUrl: 'category:shoes',
    priority: 3,
    textAlignment: 'center',
    overlayOpacity: 0.35,
  },
];

export default function HeroCampaignBanner({ onNavigateTarget }) {
  const { i18n } = useTranslation();
  const navigation = useNavigation();
  const isRTL = i18n.language === 'ar';

  const [campaigns, setCampaigns] = useState(FALLBACK_CAMPAIGNS);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isInteracting, setIsInteracting] = useState(false);

  const flatListRef = useRef(null);
  const autoPlayTimerRef = useRef(null);

  // Fetch campaigns dynamically from backend API
  useEffect(() => {
    let isMounted = true;
    getActiveCampaigns()
      .then((res) => {
        if (isMounted && Array.isArray(res?.data) && res.data.length > 0) {
          setCampaigns(res.data);
        }
      })
      .catch((_err) => {
        // Retain fallback campaigns silently on error
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Auto-play timer rotation (paused during user touch or drag)
  useEffect(() => {
    if (campaigns.length <= 1 || isInteracting) {
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
      return;
    }

    autoPlayTimerRef.current = setInterval(() => {
      setActiveIndex((prev) => {
        const nextIndex = (prev + 1) % campaigns.length;
        if (flatListRef.current) {
          try {
            flatListRef.current.scrollToIndex({
              index: nextIndex,
              animated: true,
            });
          } catch (_e) {
            // Safe fallback
          }
        }
        return nextIndex;
      });
    }, 5500);

    return () => {
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current);
      }
    };
  }, [campaigns.length, isInteracting]);

  const handleScroll = useCallback(
    (e) => {
      const offsetX = e.nativeEvent.contentOffset.x;
      const index = Math.round(offsetX / SCREEN_WIDTH);
      if (index >= 0 && index < campaigns.length && index !== activeIndex) {
        setActiveIndex(index);
      }
    },
    [campaigns.length, activeIndex]
  );

  const handleActionPress = (campaign) => {
    if (onNavigateTarget) {
      onNavigateTarget(campaign.targetUrl);
      return;
    }

    const target = campaign.targetUrl || '';
    if (target.startsWith('category:')) {
      const catKey = target.replace('category:', '').trim();
      navigation.navigate('Catalog', { categoryKey: catKey });
    } else if (target === 'deals') {
      navigation.navigate('Catalog', { onlyDiscounted: true });
    } else {
      navigation.navigate('Categories');
    }
  };

  const renderItem = ({ item }) => {
    const title = isRTL ? item.titleAr : item.titleEn;
    const subtitle = isRTL ? item.subtitleAr : item.subtitleEn;
    const cta = isRTL ? item.ctaAr : item.ctaEn;
    const badge = isRTL ? item.badgeAr : item.badgeEn;
    const opacity = typeof item.overlayOpacity === 'number' ? item.overlayOpacity : 0.35;

    return (
      <View style={styles.slideContainer}>
        {/* Campaign Editorial Cover Photography */}
        <Image
          source={{ uri: item.imageUrlMobile }}
          style={styles.bannerImage}
          contentFit="cover"
          transition={300}
          cachePolicy="memory-disk"
        />

        {/* Ambient Tint Overlay */}
        <View
          style={[
            styles.tintOverlay,
            { backgroundColor: `rgba(15, 18, 22, ${opacity})` },
          ]}
        />

        {/* Top Vignette Gradient for Identity Contrast */}
        <LinearGradient
          colors={['rgba(15, 18, 22, 0.45)', 'transparent']}
          style={styles.topGradient}
          pointerEvents="none"
        />

        {/* Bottom Editorial Content Gradient */}
        <LinearGradient
          colors={['transparent', 'rgba(15, 18, 22, 0.88)', '#0F1216']}
          locations={[0.15, 0.65, 1.0]}
          style={styles.bottomGradient}
          pointerEvents="none"
        />

        {/* Editorial Text & CTA Content Layer */}
        <View style={styles.contentOverlay}>
          {/* Subtle Fashion Identifier / Badge */}
          {badge ? (
            <View style={styles.badgePill}>
              <MaterialCommunityIcons name="creation" size={12} color={colors.accent} />
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          ) : (
            <View style={styles.badgePill}>
              <Text style={styles.badgeFlag}>🇪🇬</Text>
              <Text style={styles.badgeText}>
                {isRTL ? 'سوق مصر • تشكيلة راقية' : 'EGYPT SHOP • EDITORIAL'}
              </Text>
            </View>
          )}

          {/* Campaign Headline */}
          <Text
            style={[
              styles.campaignTitle,
              { textAlign: isRTL ? 'center' : 'center' },
            ]}
            numberOfLines={2}
          >
            {title}
          </Text>

          {/* Campaign Subtitle */}
          {subtitle ? (
            <Text
              style={[
                styles.campaignSubtitle,
                { textAlign: isRTL ? 'center' : 'center' },
              ]}
              numberOfLines={2}
            >
              {subtitle}
            </Text>
          ) : null}

          {/* 3D-Inspired Luxury CTA Button */}
          <View style={styles.ctaRow}>
            <PremiumButton
              title={cta || (isRTL ? 'اكتشف التشكيلة' : 'EXPLORE COLLECTION')}
              variant="accent"
              size="md"
              depth3D={true}
              onPress={() => handleActionPress(item)}
              style={styles.ctaButton}
              textStyle={styles.ctaButtonText}
              icon={isRTL ? 'arrow-left' : 'arrow-right'}
              iconPosition="end"
              iconSize={16}
            />
          </View>
        </View>
      </View>
    );
  };

  return (
    <View
      style={styles.wrapper}
      onTouchStart={() => setIsInteracting(true)}
      onTouchEnd={() => setIsInteracting(false)}
      onTouchCancel={() => setIsInteracting(false)}
    >
      <FlatList
        ref={flatListRef}
        data={campaigns}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => `hero-${item.id}`}
        renderItem={renderItem}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => setIsInteracting(true)}
        onScrollEndDrag={() => setIsInteracting(false)}
        initialNumToRender={1}
        maxToRenderPerBatch={2}
        windowSize={3}
      />

      {/* Sleek Minimalist Luxury Pagination Indicator */}
      {campaigns.length > 1 && (
        <View style={styles.paginationRow} pointerEvents="none">
          {campaigns.map((c, idx) => {
            const isCurrent = activeIndex === idx;
            return (
              <View
                key={`dot-${c.id}`}
                style={[
                  styles.paginationBar,
                  isCurrent ? styles.paginationBarActive : styles.paginationBarInactive,
                ]}
              />
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: SCREEN_WIDTH,
    height: BANNER_HEIGHT,
    position: 'relative',
    backgroundColor: '#14171B',
    overflow: 'hidden',
  },
  slideContainer: {
    width: SCREEN_WIDTH,
    height: BANNER_HEIGHT,
    position: 'relative',
    justifyContent: 'flex-end',
  },
  bannerImage: {
    ...StyleSheet.absoluteFillObject,
    width: SCREEN_WIDTH,
    height: BANNER_HEIGHT,
  },
  tintOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 90,
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: BANNER_HEIGHT * 0.72,
  },
  contentOverlay: {
    paddingHorizontal: 20,
    paddingBottom: 36,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },

  // Subtle Pill Identifier
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 10,
  },
  badgeFlag: {
    fontSize: 12,
  },
  badgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  // Editorial Typography
  campaignTitle: {
    color: colors.white,
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 30,
    letterSpacing: 0.3,
    marginBottom: 6,
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  campaignSubtitle: {
    color: 'rgba(250, 248, 245, 0.88)',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    maxWidth: SCREEN_WIDTH - 60,
    marginBottom: 14,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  ctaRow: {
    marginTop: 4,
  },
  ctaButton: {
    paddingHorizontal: 22,
    height: 44,
    borderRadius: 22,
  },
  ctaButtonText: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  // Minimalist Luxury Pagination
  paginationRow: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    zIndex: 10,
  },
  paginationBar: {
    height: 3.5,
    borderRadius: 2,
  },
  paginationBarActive: {
    width: 22,
    backgroundColor: colors.accent, // Gold highlight for active slide
  },
  paginationBarInactive: {
    width: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
});
