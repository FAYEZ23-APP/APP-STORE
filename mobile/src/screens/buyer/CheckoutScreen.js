import React, { useState, useEffect, useMemo, useContext, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  I18nManager,
  Switch,
  KeyboardAvoidingView,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { Image } from 'expo-image';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CartContext } from '../../context/CartContext';
import { createOrder } from '../../api/ordersApi';
import { getDeliveryCities, getPickupPoints, calculateDeliveryQuote } from '../../api/deliveryApi';
import { getMyAddresses, getMyWallet } from '../../api/usersApi';
import { getAppConfig } from '../../api/configApi';
import { validateCoupon } from '../../api/couponsApi';
import { formatCurrency } from '../../utils/currency';
import { isValidEgyptianPhone, normalizeEgyptianPhone } from '../../utils/egyptianPhone';
import { getImageUrl } from '../../utils/imageUrl';
import AnimatedPressable from '../../components/common/AnimatedPressable';
import { colors } from '../../theme/colors';
import { shadows } from '../../theme/shadows';

export default function CheckoutScreen({ route, navigation }) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { removeItems } = useContext(CartContext);
  const isRTL = i18n.language?.startsWith('ar') || I18nManager.isRTL;

  const buyNowItem = route?.params?.buyNowItem;
  const initialCartItems = route?.params?.cartItems;
  const isBuyNow = Boolean(buyNowItem);

  const [checkoutItems] = useState(
    buyNowItem
      ? [
          {
            productId: buyNowItem.product.id,
            variantId: buyNowItem.selectedVariant?.id || null,
            selectedVariant: buyNowItem.selectedVariant || null,
            quantity: buyNowItem.quantity,
            product: buyNowItem.product,
          },
        ]
      : initialCartItems || []
  );

  // Delivery Method: 'Courier' (Home Delivery) or 'Pickup' (Bosta PVZ Branch)
  const [deliveryMethod, setDeliveryMethod] = useState('Courier');

  // Coupon Engine State
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);

  // Buyer Wallet (Store Credit) State
  const [walletBalance, setWalletBalance] = useState(0);
  const [useWalletBalance, setUseWalletBalance] = useState(false);
  const [walletEnabled, setWalletEnabled] = useState(false);
  const [couponsEnabled, setCouponsEnabled] = useState(false);

  // Saved addresses
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);

  // Customer & Address Fields
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [governorate, setGovernorate] = useState(isRTL ? 'القاهرة' : 'Cairo');
  const [city, setCity] = useState(isRTL ? 'مدينة نصر' : 'Nasr City');
  const [area, setArea] = useState(isRTL ? 'الحي السابع' : '7th District');
  const [streetBuilding, setStreetBuilding] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');

  // Pickup Branch State
  const [availableCities, setAvailableCities] = useState([]);
  const [pickupCity, setPickupCity] = useState(isRTL ? 'القاهرة' : 'Cairo');
  const [pickupPoints, setPickupPoints] = useState([]);
  const [selectedPickupPointId, setSelectedPickupPointId] = useState('');

  // Delivery Quote State
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteData, setQuoteData] = useState(null);

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const idempotencyKeyRef = useRef(null);

  // Group items by Seller (Multi-Vendor Marketplace)
  const groupedBySeller = useMemo(() => {
    const map = {};
    checkoutItems.forEach((entry) => {
      const sellerId = entry.product?.sellerId || 'general';
      const sellerName =
        entry.product?.sellerName || (isRTL ? 'تاجر سوق مصر' : 'Marketplace Merchant');
      const dispatchCity = entry.product?.dispatchCity || (isRTL ? 'القاهرة' : 'Cairo');

      if (!map[sellerId]) {
        map[sellerId] = {
          sellerId,
          sellerName,
          dispatchCity,
          items: [],
        };
      }
      map[sellerId].items.push(entry);
    });
    return Object.values(map);
  }, [checkoutItems, isRTL]);

  // Calculate items total
  const itemsSubtotal = useMemo(() => {
    return checkoutItems.reduce((acc, it) => {
      const price = it?.selectedVariant?.priceOverride != null
        ? Number(it.selectedVariant.priceOverride)
        : (Number(it?.product?.price) || 0);
      const qty = Number(it?.quantity) || 1;
      return acc + price * qty;
    }, 0);
  }, [checkoutItems]);

  const totalCount = useMemo(() => {
    return checkoutItems.reduce((acc, it) => acc + (Number(it?.quantity) || 1), 0);
  }, [checkoutItems]);

  // Load addresses, delivery cities, and buyer wallet on mount
  useEffect(() => {
    const initData = async () => {
      try {
        const addrRes = await getMyAddresses();
        if (Array.isArray(addrRes?.data) && addrRes.data.length > 0) {
          setSavedAddresses(addrRes.data);
          const def = addrRes.data.find((a) => a.isDefault) || addrRes.data[0];
          setSelectedAddressId(def.id);
          setRecipientName(def.recipientName || '');
          setRecipientPhone(def.recipientPhone || '');
          setGovernorate(def.governorate || (isRTL ? 'القاهرة' : 'Cairo'));
          setCity(def.city || (isRTL ? 'مدينة نصر' : 'Nasr City'));
          setArea(def.area || '');
          setStreetBuilding(def.streetBuilding || '');
        }
      } catch (e) {
        console.warn('Failed to load user addresses:', e);
      }

      try {
        const citiesRes = await getDeliveryCities();
        if (Array.isArray(citiesRes?.data) && citiesRes.data.length > 0) {
          setAvailableCities(citiesRes.data);
          const defaultCity = citiesRes.data[0].name;
          setPickupCity(defaultCity);
          loadPickupPoints(defaultCity);
        }
      } catch (e) {
        console.warn('Failed to load delivery cities:', e);
      }

      try {
        const configRes = await getAppConfig();
        if (configRes?.data) {
          setCouponsEnabled(Boolean(configRes.data.couponsEnabled));
          setWalletEnabled(Boolean(configRes.data.walletEnabled));
          if (configRes.data.walletEnabled) {
            const walletRes = await getMyWallet();
            if (walletRes?.data?.balance != null) {
              setWalletBalance(Number(walletRes.data.balance));
            }
          }
        }
      } catch (e) {
        console.warn('Failed to load config/wallet:', e);
      }
    };

    initData();
  }, []);

  const loadPickupPoints = async (cityName) => {
    try {
      const res = await getPickupPoints(cityName);
      if (Array.isArray(res?.data)) {
        setPickupPoints(res.data);
        if (res.data.length > 0) {
          setSelectedPickupPointId(res.data[0].id);
        } else {
          setSelectedPickupPointId('');
        }
      }
    } catch (e) {
      console.warn('Failed to load pickup points:', e);
    }
  };

  // Fetch Delivery Quote whenever destination or items change
  const fetchQuote = useCallback(async () => {
    if (!checkoutItems || checkoutItems.length === 0) return;

    try {
      setQuoteLoading(true);
      const targetCity = deliveryMethod === 'Courier'
        ? (governorate || city || (isRTL ? 'القاهرة' : 'Cairo'))
        : (pickupCity || (isRTL ? 'القاهرة' : 'Cairo'));

      const payload = {
        items: checkoutItems.map((it) => ({
          productId: it.productId,
          variantId: it.variantId || it.selectedVariant?.id || null,
          quantity: it.quantity,
        })),
        deliveryMethod,
        city: targetCity,
        destinationCity: targetCity,
        pickupPointId: deliveryMethod === 'Pickup' && selectedPickupPointId ? selectedPickupPointId : null,
      };

      const res = await calculateDeliveryQuote(payload);
      if (res?.data) {
        setQuoteData(res.data);
      }
    } catch (e) {
      console.warn('Failed to calculate delivery quote:', e);
    } finally {
      setQuoteLoading(false);
    }
  }, [checkoutItems, deliveryMethod, governorate, city, pickupCity, selectedPickupPointId]);

  useEffect(() => {
    fetchQuote();
  }, [fetchQuote]);

  // Handle Coupon Validation
  const handleApplyCoupon = async () => {
    if (!couponCodeInput.trim() || validatingCoupon) return;
    try {
      setValidatingCoupon(true);
      const payload = {
        code: couponCodeInput.trim(),
        items: checkoutItems.map((it) => ({
          productId: it.productId,
          variantId: it.variantId || it.selectedVariant?.id || null,
          quantity: it.quantity,
        })),
      };
      const res = await validateCoupon(payload);
      if (res?.data?.isValid) {
        setAppliedCoupon(res.data);
        Alert.alert(
          isRTL ? 'تم تفعيل الكوبون' : 'Coupon Applied',
          res.data.message || (isRTL ? 'تم احتساب الخصم بنجاح!' : 'Discount applied successfully!')
        );
      } else {
        Alert.alert(
          isRTL ? 'كوبون غير صالح' : 'Invalid Coupon',
          res?.data?.message || (isRTL ? 'كود الكوبون غير صحيح أو منتهي الصلاحية.' : 'Coupon code is invalid or expired.')
        );
      }
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        (isRTL ? 'تعذر التحقق من الكوبون' : 'Failed to validate coupon');
      Alert.alert(isRTL ? 'خطأ بالكوبون' : 'Coupon Error', msg);
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCodeInput('');
  };

  // Handle Saved Address Selection
  const handleSelectSavedAddress = (addr) => {
    setSelectedAddressId(addr.id);
    setRecipientName(addr.recipientName || '');
    setRecipientPhone(addr.recipientPhone || '');
    setGovernorate(addr.governorate || '');
    setCity(addr.city || '');
    setArea(addr.area || '');
    setStreetBuilding(addr.streetBuilding || '');
  };

  const handleCityChangeForPickup = (newCity) => {
    setPickupCity(newCity);
    loadPickupPoints(newCity);
  };

  // Free shipping threshold calculations
  const freeShippingThreshold = quoteData?.freeShippingThreshold || 1000;
  const isFreeShipping =
    quoteData?.isFreeShippingApplied === true || itemsSubtotal >= freeShippingThreshold;
  const freeShippingProgress = Math.min(
    100,
    Math.round((itemsSubtotal / freeShippingThreshold) * 100)
  );
  const neededForFreeShipping = Math.max(0, freeShippingThreshold - itemsSubtotal);

  // Price totals
  const couponDiscount =
    couponsEnabled && appliedCoupon ? Number(appliedCoupon.discountAmount) || 0 : 0;
  const deliveryCostTotal =
    Number(quoteData?.totalDeliveryCost) || (deliveryMethod === 'Pickup' ? 35 : 50);
  const subtotalAfterCoupon = Math.max(0, itemsSubtotal - couponDiscount);
  const totalBeforeWallet = subtotalAfterCoupon + deliveryCostTotal;
  const walletDeduction =
    walletEnabled && useWalletBalance ? Math.min(walletBalance, totalBeforeWallet) : 0;
  const grandTotal = Math.max(0, totalBeforeWallet - walletDeduction);

  const handleConfirmOrder = async () => {
    if (checkoutItems.length === 0 || submitting) return;

    // Validate inputs
    if (!recipientName.trim()) {
      Alert.alert(
        t('common.error'),
        isRTL ? 'يرجى إدخال اسم المستلم بالكامل' : 'Please enter full recipient name'
      );
      return;
    }

    if (!isValidEgyptianPhone(recipientPhone)) {
      Alert.alert(t('common.error'), t('common.invalidPhone'));
      return;
    }

    if (deliveryMethod === 'Courier') {
      if (!governorate.trim() || !city.trim() || !area.trim() || !streetBuilding.trim()) {
        Alert.alert(
          t('common.error'),
          isRTL
            ? 'يرجى استكمال بيانات العنوان (المحافظة، المدينة، الحي، الشارع والعمارة)'
            : 'Please complete all address fields (governorate, city, area, street & building)'
        );
        return;
      }
    } else {
      if (!selectedPickupPointId) {
        Alert.alert(
          t('common.error'),
          isRTL ? 'يرجى اختيار فرع أو نقطة استلام بوسطة' : 'Please select a Bosta branch or pickup point'
        );
        return;
      }
    }

    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current =
        'ord_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);
    }

    setSubmitting(true);

    const payload = {
      items: checkoutItems.map((it) => ({
        productId: it.productId,
        variantId: it.variantId || it.selectedVariant?.id || null,
        quantity: it.quantity,
      })),
      deliveryMethod,
      pickupPointId: deliveryMethod === 'Pickup' ? selectedPickupPointId : null,
      recipientName: recipientName.trim(),
      recipientPhone: normalizeEgyptianPhone(recipientPhone),
      governorate: deliveryMethod === 'Courier' ? governorate.trim() : pickupCity,
      city: deliveryMethod === 'Courier' ? city.trim() : pickupCity,
      area: deliveryMethod === 'Courier' ? area.trim() : (isRTL ? 'نقطة استلام' : 'Pickup Point'),
      streetBuilding:
        deliveryMethod === 'Courier'
          ? streetBuilding.trim()
          : (isRTL ? 'استلام من الفرع' : 'Branch Pickup'),
      deliveryNotes: deliveryNotes.trim() || null,
      landmark: deliveryNotes.trim() || null,
      addressId: selectedAddressId || null,
      paymentMethod: 'OnReceipt',
      idempotencyKey: idempotencyKeyRef.current,
      couponCode: couponsEnabled && appliedCoupon?.code ? appliedCoupon.code : null,
      useWalletBalance: walletEnabled ? useWalletBalance : false,
    };

    try {
      await createOrder(payload, idempotencyKeyRef.current);
      idempotencyKeyRef.current = null;

      // Clean cart
      if (!isBuyNow) {
        const orderedIds = checkoutItems.map((it) => it.productId);
        removeItems(orderedIds);
      }

      Alert.alert(
        t('checkout.orderSuccessTitle'),
        t('checkout.orderSuccessMessage'),
        [
          {
            text: t('nav.orders'),
            onPress: () => {
              navigation.navigate('BuyerRoot', {
                screen: 'MyOrders',
                params: { refreshTimestamp: Date.now() },
              });
            },
          },
        ]
      );
    } catch (err) {
      console.error('Order creation failed', err);
      const serverMsg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        t('common.error');

      // Check if COD blocked
      if (err?.response?.status === 400 && serverMsg.includes('الدفع عند الاستلام')) {
        Alert.alert(
          isRTL ? 'تنبيه الدفع عند الاستلام' : 'Cash on Delivery Notice',
          t('checkout.codBlocked')
        );
      } else {
        Alert.alert(t('common.error'), serverMsg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (checkoutItems.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />
        <MaterialCommunityIcons name="cart-off" size={60} color={colors.textSecondary} />
        <Text style={styles.emptyTitle}>{t('cart.emptyTitle')}</Text>
        <TouchableOpacity
          accessible={true}
          accessibilityRole="button"
          onPress={() => navigation.goBack()}
          style={styles.emptyCancelButton}
        >
          <Text style={styles.emptyCancelText}>{t('common.cancel')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />

      <ScrollView
        style={styles.scrollWrapper}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Page Title & Secure Badge Header */}
        <View style={styles.headerBox}>
          <View style={styles.secureBadge}>
            <MaterialCommunityIcons name="shield-check" size={14} color={colors.primary} />
            <Text style={styles.secureBadgeText}>
              {isRTL ? 'بوابة إتمام الطلب الآمنة' : 'Secure Checkout'}
            </Text>
          </View>
          <Text style={styles.pageTitle}>{t('checkout.title')}</Text>
          <Text style={styles.pageSubtitle}>
            {isRTL
              ? 'أكمل بيانات التوصيل واختر طريقة الاستلام لتأكيد شحنتك بالدفع عند الاستلام'
              : 'Complete your delivery details to confirm your Cash on Delivery order'}
          </Text>
        </View>

        {/* Free Shipping Progress Card */}
        <View style={[styles.card, isFreeShipping ? styles.freeShippingCard : null]}>
          <View style={styles.freeShippingHeader}>
            <View style={styles.freeShippingLeft}>
              <MaterialCommunityIcons
                name={isFreeShipping ? 'truck-check' : 'truck-fast-outline'}
                size={22}
                color={isFreeShipping ? '#059669' : colors.gold}
              />
              <Text
                style={[
                  styles.freeShippingTitle,
                  { color: isFreeShipping ? '#059669' : colors.textPrimary },
                ]}
              >
                {isFreeShipping
                  ? t('checkout.freeShippingQualified')
                  : t('checkout.freeShippingAddMore', {
                      amount: formatCurrency(neededForFreeShipping),
                    })}
              </Text>
            </View>
            <Text
              style={[
                styles.freeShippingPercent,
                { color: isFreeShipping ? '#059669' : colors.gold },
              ]}
            >
              {freeShippingProgress}%
            </Text>
          </View>

          {/* Progress Bar Track */}
          <View style={styles.progressBarTrack}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${freeShippingProgress}%`,
                  backgroundColor: isFreeShipping ? '#059669' : colors.gold,
                },
              ]}
            />
          </View>
          <Text style={styles.freeShippingFootnote}>
            {t('checkout.freeShippingMin', { amount: formatCurrency(freeShippingThreshold) })}
          </Text>
        </View>

        {/* 1. Delivery Method Selection (Courier vs Pickup) */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconBadge}>
              <MaterialCommunityIcons name="truck-delivery-outline" size={18} color={colors.primary} />
            </View>
            <Text style={styles.sectionTitle}>{t('checkout.deliveryMethod')}</Text>
          </View>

          <View style={styles.deliveryOptionsContainer}>
            {/* Courier Home Delivery Card */}
            <TouchableOpacity
              accessible={true}
              accessibilityRole="button"
              activeOpacity={0.85}
              onPress={() => setDeliveryMethod('Courier')}
              style={[
                styles.deliveryOptionCard,
                deliveryMethod === 'Courier' && styles.deliveryOptionActive,
              ]}
            >
              <View style={styles.deliveryOptionTop}>
                <View style={styles.deliveryOptionTitleRow}>
                  <MaterialCommunityIcons
                    name="truck-fast-outline"
                    size={18}
                    color={deliveryMethod === 'Courier' ? colors.primary : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.deliveryOptionName,
                      deliveryMethod === 'Courier' && styles.deliveryOptionNameActive,
                    ]}
                  >
                    {t('checkout.homeDelivery', 'شحن للمنزل')}
                  </Text>
                </View>
                <View
                  style={[
                    styles.radioCircle,
                    deliveryMethod === 'Courier' && styles.radioCircleActive,
                  ]}
                >
                  {deliveryMethod === 'Courier' && <View style={styles.radioInnerDot} />}
                </View>
              </View>
              <Text style={styles.deliveryOptionDesc}>
                {isRTL
                  ? 'توصيل لباب بيتك أو عنوان عملك في محافظتك عبر مندوب بوسطة'
                  : 'Doorstep delivery to your home or workplace via Bosta courier'}
              </Text>
            </TouchableOpacity>

            {/* Bosta Branch Pickup Card */}
            <TouchableOpacity
              accessible={true}
              accessibilityRole="button"
              activeOpacity={0.85}
              onPress={() => setDeliveryMethod('Pickup')}
              style={[
                styles.deliveryOptionCard,
                deliveryMethod === 'Pickup' && styles.deliveryOptionActive,
              ]}
            >
              <View style={styles.deliveryOptionTop}>
                <View style={styles.deliveryOptionTitleRow}>
                  <MaterialCommunityIcons
                    name="storefront-outline"
                    size={18}
                    color={deliveryMethod === 'Pickup' ? colors.primary : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.deliveryOptionName,
                      deliveryMethod === 'Pickup' && styles.deliveryOptionNameActive,
                    ]}
                  >
                    {t('checkout.branchPickup', 'فرع بوسطة')}
                  </Text>
                </View>
                <View
                  style={[
                    styles.radioCircle,
                    deliveryMethod === 'Pickup' && styles.radioCircleActive,
                  ]}
                >
                  {deliveryMethod === 'Pickup' && <View style={styles.radioInnerDot} />}
                </View>
              </View>
              <Text style={styles.deliveryOptionDesc}>
                {isRTL
                  ? 'استلام ذاتي من أقرب فرع بوسطة (PVZ) بأسعار شحن مخفضة'
                  : 'Pickup yourself from a Bosta branch (PVZ) with discounted shipping'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 2. Recipient Information Card */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconBadge}>
              <MaterialCommunityIcons name="account-outline" size={18} color={colors.primary} />
            </View>
            <Text style={styles.sectionTitle}>{t('checkout.recipientInfo')}</Text>
          </View>

          {/* Full Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              {t('checkout.recipientName')} <Text style={styles.requiredAsterisk}>*</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              value={recipientName}
              onChangeText={setRecipientName}
              placeholder={isRTL ? 'الاسم ثلاثي للمستلم' : 'Full Name of Recipient'}
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          {/* Egyptian Phone with Prefix */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              {t('checkout.recipientPhone')} <Text style={styles.requiredAsterisk}>*</Text>
            </Text>
            <View style={styles.phoneInputRow}>
              <View style={styles.phonePrefixBox}>
                <Text style={styles.flagEmoji}>🇪🇬</Text>
                <Text style={styles.prefixNumber}>+20</Text>
              </View>
              <TextInput
                style={styles.phoneTextInput}
                keyboardType="phone-pad"
                value={recipientPhone}
                onChangeText={setRecipientPhone}
                placeholder="010XXXXXXXX"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
            <Text style={styles.fieldHelperText}>
              {isRTL
                ? 'رقم موبايل مصري صالح للتواصل عند وصول مندوب الشحن'
                : 'Valid Egyptian mobile number for carrier contact'}
            </Text>
          </View>
        </View>

        {/* 3. Delivery Address or Pickup Branch Selection */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconBadge}>
              <MaterialCommunityIcons name="map-marker-outline" size={18} color={colors.primary} />
            </View>
            <Text style={styles.sectionTitle}>
              {deliveryMethod === 'Courier'
                ? t('checkout.deliveryAddress')
                : t('checkout.pickupPoint')}
            </Text>
          </View>

          {deliveryMethod === 'Courier' ? (
            <View style={{ gap: 12 }}>
              {/* Saved Address Quick Select */}
              {savedAddresses.length > 0 && (
                <View style={styles.savedAddressesBox}>
                  <Text style={styles.savedAddressesLabel}>
                    {t('checkout.selectSavedAddress')}:
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ gap: 8 }}>
                    {savedAddresses.map((addr) => {
                      const isSelected = selectedAddressId === addr.id;
                      return (
                        <TouchableOpacity
                          accessible={true}
                          accessibilityRole="button"
                          key={`checkout-addr-${addr.id}`}
                          onPress={() => handleSelectSavedAddress(addr)}
                          style={[
                            styles.savedAddressCard,
                            isSelected && styles.savedAddressCardActive,
                          ]}
                        >
                          <View style={styles.savedAddressTopRow}>
                            <Text style={styles.savedAddressLabelText}>
                              {addr.label || addr.recipientName || (isRTL ? 'عنوان' : 'Address')}
                            </Text>
                            {isSelected && (
                              <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                            )}
                          </View>
                          <Text style={styles.savedAddressSubText} numberOfLines={1}>
                            {addr.governorate}، {addr.city}
                          </Text>
                          <Text style={styles.savedAddressStreetText} numberOfLines={1}>
                            {addr.streetBuilding}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                  {(() => {
                    const currentSelected = savedAddresses.find((a) => a.id === selectedAddressId);
                    if (currentSelected && (!currentSelected.latitude || !currentSelected.longitude)) {
                      return (
                        <TouchableOpacity
                          accessible={true}
                          accessibilityRole="button"
                          onPress={() => {
                            navigation.navigate('LocationPicker', {
                              onConfirmLocation: (loc) => {
                                if (loc?.latitude && loc?.longitude) {
                                  currentSelected.latitude = loc.latitude;
                                  currentSelected.longitude = loc.longitude;
                                  if (loc.governorate) setGovernorate(loc.governorate);
                                  if (loc.city) setCity(loc.city);
                                  if (loc.area) setArea(loc.area);
                                  if (loc.streetBuilding) setStreetBuilding(loc.streetBuilding);
                                }
                              },
                            });
                          }}
                          style={styles.pinLocationNudgeBanner}
                        >
                          <Ionicons name="location-outline" size={16} color={colors.accent || '#D97706'} />
                          <Text style={styles.pinLocationNudgeText}>
                            {t('checkout.pinLocationNudge')}
                          </Text>
                        </TouchableOpacity>
                      );
                    }
                    return null;
                  })()}
                </View>
              )}

              {/* Row 1: Governorate & City */}
              <View style={styles.twoColRow}>
                <View style={styles.colHalf}>
                  <Text style={styles.inputLabel}>
                    {t('checkout.governorate')} <Text style={styles.requiredAsterisk}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.textInput}
                    value={governorate}
                    onChangeText={(val) => {
                      setGovernorate(val);
                      setSelectedAddressId(null);
                    }}
                    placeholder={isRTL ? 'القاهرة' : 'Cairo'}
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>

                <View style={styles.colHalf}>
                  <Text style={styles.inputLabel}>
                    {t('checkout.city')} <Text style={styles.requiredAsterisk}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.textInput}
                    value={city}
                    onChangeText={(val) => {
                      setCity(val);
                      setSelectedAddressId(null);
                    }}
                    placeholder={isRTL ? 'مدينة نصر' : 'Nasr City'}
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
              </View>

              {/* Row 2: District / Area */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  {t('checkout.area')} <Text style={styles.requiredAsterisk}>*</Text>
                </Text>
                <TextInput
                  style={styles.textInput}
                  value={area}
                  onChangeText={(val) => {
                    setArea(val);
                    setSelectedAddressId(null);
                  }}
                  placeholder={isRTL ? 'الحي / المنطقة (مثال: الحي السابع)' : 'Area / Neighborhood'}
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              {/* Row 3: Street & Building */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  {t('checkout.streetBuilding')} <Text style={styles.requiredAsterisk}>*</Text>
                </Text>
                <TextInput
                  style={styles.textInput}
                  value={streetBuilding}
                  onChangeText={(val) => {
                    setStreetBuilding(val);
                    setSelectedAddressId(null);
                  }}
                  placeholder={
                    isRTL
                      ? 'الشارع ورقم العمارة والدور والشقة'
                      : 'Street, building, floor & apt'
                  }
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              {/* Row 4: Optional Delivery Notes */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  {isRTL ? 'ملاحظات إضافية للتوصيل (اختياري)' : 'Delivery Notes / Landmark (Optional)'}
                </Text>
                <TextInput
                  style={styles.textInput}
                  value={deliveryNotes}
                  onChangeText={setDeliveryNotes}
                  placeholder={
                    isRTL
                      ? 'علامة مميزة بجوار العنوان، مواعيد التواجد...'
                      : 'Landmark or preferred delivery notes...'
                  }
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
            </View>
          ) : (
            /* Bosta PVZ Branch Selector */
            <View style={{ gap: 12 }}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  {isRTL ? 'اختر المدينة للبحث عن فروع بوسطة:' : 'Select City for Bosta Branches:'}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ gap: 8 }}>
                  {(availableCities.length > 0
                    ? availableCities
                    : [
                        { name: isRTL ? 'القاهرة' : 'Cairo' },
                        { name: isRTL ? 'الجيزة' : 'Giza' },
                        { name: isRTL ? 'الإسكندرية' : 'Alexandria' },
                      ]
                  ).map((c) => {
                    const isSelected = pickupCity === c.name;
                    return (
                      <TouchableOpacity
                        accessible={true}
                        accessibilityRole="button"
                        key={`pickup-city-${c.name}`}
                        onPress={() => handleCityChangeForPickup(c.name)}
                        style={[
                          styles.cityPill,
                          isSelected && styles.cityPillActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.cityPillText,
                            isSelected && styles.cityPillTextActive,
                          ]}
                        >
                          {c.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('checkout.choosePickupPoint')}:</Text>
                {pickupPoints.length > 0 ? (
                  pickupPoints.map((point) => {
                    const isSelected = selectedPickupPointId === point.id;
                    return (
                      <TouchableOpacity
                        accessible={true}
                        accessibilityRole="button"
                        key={`point-${point.id}`}
                        onPress={() => setSelectedPickupPointId(point.id)}
                        style={[
                          styles.pickupPointCard,
                          isSelected && styles.pickupPointCardActive,
                        ]}
                      >
                        <View style={styles.pickupPointTop}>
                          <Text style={styles.pickupPointName}>{point.name}</Text>
                          <Text style={styles.pickupPointCity}>{point.city}</Text>
                        </View>
                        <Text style={styles.pickupPointAddress}>{point.address}</Text>
                        {point.workHours && (
                          <Text style={styles.pickupPointHours}>
                            {isRTL ? 'مواعيد العمل:' : 'Hours:'} {point.workHours}
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <View style={styles.noPickupBox}>
                    <Text style={styles.noPickupText}>
                      {isRTL
                        ? 'لا توجد نقاط استلام متاحة حالياً في هذه المدينة'
                        : 'No pickup branches available in this city'}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>

        {/* 4. Payment Method Section */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconBadge}>
              <MaterialCommunityIcons name="cash-multiple" size={18} color={colors.primary} />
            </View>
            <Text style={styles.sectionTitle}>{t('checkout.paymentMethod')}</Text>
          </View>

          {/* COD Option Card */}
          <View style={styles.codCard}>
            <View style={styles.codHeaderRow}>
              <View style={styles.codIconCircle}>
                <Ionicons name="checkmark" size={14} color="#FFFFFF" />
              </View>
              <View style={styles.codTitleBox}>
                <View style={styles.codBadgeRow}>
                  <Text style={styles.codTitle}>{t('checkout.cashOnDelivery')}</Text>
                  <View style={styles.guaranteedBadge}>
                    <Text style={styles.guaranteedBadgeText}>
                      {isRTL ? 'مفعل ومضمون' : 'Active & Guaranteed'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.codDesc}>
                  {isRTL
                    ? 'عاين طلبك وتأكد من سلامة جميع المنتجات، ثم ادفع نقداً لمندوب التوصيل عند باب منزلك بكل أمان وثقة.'
                    : 'Inspect your order and verify items upon arrival, then pay cash to the courier at your door with complete confidence.'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* 5. Per-Seller Parcels Breakdown */}
        {groupedBySeller.length > 0 && (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconBadge}>
                <MaterialCommunityIcons name="package-variant-closed" size={18} color={colors.primary} />
              </View>
              <Text style={styles.sectionTitle}>
                {t('checkout.parcelsBreakdown')} ({groupedBySeller.length}):
              </Text>
            </View>

            <View style={{ gap: 10 }}>
              {groupedBySeller.map((group, idx) => {
                const groupSubtotal = group.items.reduce((sum, it) => {
                  const p = it?.selectedVariant?.priceOverride != null
                    ? Number(it.selectedVariant.priceOverride)
                    : (Number(it?.product?.price) || 0);
                  const q = Number(it?.quantity) || 1;
                  return sum + p * q;
                }, 0);

                return (
                  <View key={`checkout-vendor-${group.sellerId || idx}`} style={styles.vendorParcelBox}>
                    <View style={styles.vendorParcelHeader}>
                      <View style={styles.vendorTitleRow}>
                        <MaterialCommunityIcons
                          name="storefront-outline"
                          size={15}
                          color={colors.primary}
                        />
                        <Text style={styles.vendorParcelName} numberOfLines={1}>
                          {t('checkout.sellerParcel', { seller: group.sellerName })}
                        </Text>
                      </View>
                      <View style={styles.fromCityBadge}>
                        <MaterialCommunityIcons name="truck-outline" size={12} color={colors.gold} />
                        <Text style={styles.fromCityText}>
                          {t('checkout.fromCity', { city: group.dispatchCity })}
                        </Text>
                      </View>
                    </View>

                    {/* Items List in this Parcel */}
                    <View style={styles.vendorItemsList}>
                      {group.items.map((it, itemIdx) => {
                        const price = it?.selectedVariant?.priceOverride != null
                          ? Number(it.selectedVariant.priceOverride)
                          : (Number(it?.product?.price) || 0);
                        const lineTotal = price * (Number(it?.quantity) || 1);

                        return (
                          <View
                            key={`checkout-it-${it.productId}-${itemIdx}`}
                            style={[
                              styles.vendorItemRow,
                              itemIdx < group.items.length - 1 && styles.vendorItemBorder,
                            ]}
                          >
                            <Text style={styles.vendorItemName} numberOfLines={1}>
                              {it.product?.name}{' '}
                              <Text style={styles.vendorItemQty}>× {it.quantity}</Text>
                            </Text>
                            <Text style={styles.vendorItemPrice}>{formatCurrency(lineTotal)}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* 6. Order Items Preview */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('cart.orderSummary')}</Text>
            <Text style={styles.itemsCountLabel}>
              {totalCount}{' '}
              {totalCount === 1
                ? isRTL ? 'منتج' : 'item'
                : isRTL ? 'منتجات' : 'items'}
            </Text>
          </View>

          <View style={{ gap: 10 }}>
            {checkoutItems.map((item, index) => {
              const product = item?.product || {};
              const unitPrice = item?.selectedVariant?.priceOverride != null
                ? item.selectedVariant.priceOverride
                : (Number(product.price) || 0);
              const imageUrl = getImageUrl(
                item?.selectedVariant?.imageUrl || product?.imageUrls?.[0]
              );
              const linePrice = unitPrice * (Number(item.quantity) || 1);

              return (
                <View
                  key={`checkout-summary-it-${item.productId}-${index}`}
                  style={[
                    styles.summaryItemRow,
                    index < checkoutItems.length - 1 && styles.summaryItemBorder,
                  ]}
                >
                  <View style={styles.summaryThumbBox}>
                    {imageUrl ? (
                      <Image source={{ uri: imageUrl }} style={styles.summaryThumb} contentFit="contain" />
                    ) : (
                      <MaterialCommunityIcons name="cube-outline" size={20} color="#94A3B8" />
                    )}
                  </View>

                  <View style={styles.summaryItemInfo}>
                    <Text numberOfLines={1} style={styles.summaryItemTitle}>
                      {product.name}
                    </Text>
                    {item.selectedVariant ? (
                      <Text style={styles.summaryItemVariant}>
                        {[
                          item.selectedVariant.size ? `${t('product.size', 'المقاس')}: ${item.selectedVariant.size}` : null,
                          item.selectedVariant.color ? item.selectedVariant.color : null,
                        ].filter(Boolean).join(' • ') || (isRTL ? 'خيار محدد' : 'Selected option')}
                      </Text>
                    ) : null}
                    <Text style={styles.summaryItemUnitPrice}>
                      {`${formatCurrency(unitPrice)} × ${item.quantity}`}
                    </Text>
                  </View>

                  <Text style={styles.summaryItemLineTotal}>
                    {formatCurrency(linePrice)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* 7. Promo Code / Coupon Engine Card */}
        {couponsEnabled && (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconBadge}>
                <MaterialCommunityIcons name="ticket-percent-outline" size={18} color={colors.primary} />
              </View>
              <Text style={styles.sectionTitle}>{t('checkout.promoCode')}</Text>
            </View>

            {appliedCoupon ? (
              <View style={styles.appliedCouponBox}>
                <View style={styles.appliedCouponLeft}>
                  <Text style={styles.appliedCouponCode}>{appliedCoupon.code}</Text>
                  <Text style={styles.appliedCouponDiscount}>
                    {isRTL ? 'قيمة الخصم:' : 'Discount:'} {formatCurrency(appliedCoupon.discountAmount)}
                  </Text>
                </View>
                <TouchableOpacity
                  accessible={true}
                  accessibilityRole="button"
                  onPress={handleRemoveCoupon}
                  style={styles.removeCouponBtn}
                >
                  <Text style={styles.removeCouponText}>{isRTL ? 'إلغاء' : 'Remove'}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.couponInputRow}>
                <TextInput
                  accessibilityLabel="Coupon"
                  accessible={true}
                  style={styles.couponInput}
                  value={couponCodeInput}
                  onChangeText={(txt) => setCouponCodeInput(txt.toUpperCase())}
                  placeholder={t('checkout.promoPlaceholder')}
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="characters"
                />
                <AnimatedPressable
                  accessible={true}
                  accessibilityRole="button"
                  disabled={validatingCoupon || !couponCodeInput.trim()}
                  onPress={handleApplyCoupon}
                  scaleTo={0.96}
                  style={[
                    styles.applyCouponBtn,
                    (!couponCodeInput.trim() || validatingCoupon) && styles.applyCouponBtnDisabled,
                  ]}
                >
                  {validatingCoupon ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.applyCouponText}>{t('checkout.applyPromo')}</Text>
                  )}
                </AnimatedPressable>
              </View>
            )}
          </View>
        )}

        {/* 8. Buyer Wallet Balance Card (Rule 10 Feature Gating) */}
        {walletEnabled && (
          <View style={styles.card}>
            <View style={styles.walletHeaderRow}>
              <View style={styles.walletTitleCol}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionIconBadge}>
                    <MaterialCommunityIcons name="wallet-outline" size={18} color={colors.gold} />
                  </View>
                  <Text style={styles.sectionTitle}>{t('checkout.useWallet')}</Text>
                </View>
                <Text style={styles.walletBalanceText}>
                  {isRTL ? 'الرصيد المتاح:' : 'Available balance:'} {formatCurrency(walletBalance)}
                </Text>
              </View>

              <Switch
                value={useWalletBalance && walletBalance > 0}
                onValueChange={(val) => {
                  if (walletBalance <= 0 && val) {
                    Alert.alert(t('checkout.walletTitle'), t('checkout.walletEmptyNotice'));
                    return;
                  }
                  setUseWalletBalance(val);
                }}
                trackColor={{ false: colors.border, true: colors.primarySoft }}
                thumbColor={useWalletBalance && walletBalance > 0 ? colors.primary : '#94A3B8'}
                disabled={walletBalance <= 0}
              />
            </View>

            {useWalletBalance && walletDeduction > 0 && (
              <View style={styles.walletDeductionBox}>
                <Text style={styles.walletDeductionText}>{t('checkout.walletDeducted')}</Text>
                <Text style={styles.walletDeductionAmount}>-{formatCurrency(walletDeduction)}</Text>
              </View>
            )}
          </View>
        )}

        {/* 9. Financial Pricing Breakdown */}
        <View style={styles.card}>
          <Text style={styles.summaryCardTitle}>{isRTL ? 'تفاصيل السعر' : 'Price Details'}</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('checkout.itemsTotal')}</Text>
            <Text style={styles.summaryValue}>{formatCurrency(itemsSubtotal)}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('checkout.deliveryTotal')}</Text>
            <Text style={styles.summaryValueBold}>
              {quoteLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : isFreeShipping ? (
                t('checkout.free')
              ) : (
                formatCurrency(deliveryCostTotal)
              )}
            </Text>
          </View>

          {couponsEnabled && couponDiscount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabelDiscount}>
                {isRTL ? `خصم الكوبون (${appliedCoupon?.code})` : `Coupon Discount (${appliedCoupon?.code})`}
              </Text>
              <Text style={styles.summaryValueDiscount}>-{formatCurrency(couponDiscount)}</Text>
            </View>
          )}

          {walletEnabled && walletDeduction > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabelDiscount}>{t('checkout.walletDeduction')}</Text>
              <Text style={styles.summaryValueDiscount}>-{formatCurrency(walletDeduction)}</Text>
            </View>
          )}

          <View style={styles.grandTotalContainer}>
            <Text style={styles.grandTotalLabel}>{t('checkout.grandTotal')}</Text>
            <Text style={styles.grandTotalAmount}>
              {grandTotal === 0 ? t('checkout.paidInFullWallet') : formatCurrency(grandTotal)}
            </Text>
          </View>

          {/* Consumer Protection Notice */}
          <View style={styles.trustFooterBox}>
            <MaterialCommunityIcons name="shield-check" size={16} color="#059669" />
            <Text style={styles.trustFooterText}>
              {isRTL
                ? 'دفع آمن 100% نقداً عند الاستلام مع حق المعاينة وفقاً لقانون حماية المستهلك'
                : '100% Secure Cash on Delivery with full inspection right'}
            </Text>
          </View>

          {/* Inspection Badge (GAP-BUY-01) */}
          <View style={[styles.trustFooterBox, { marginTop: 6, backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
            <MaterialCommunityIcons name="check-decagram" size={16} color="#059669" />
            <Text style={[styles.trustFooterText, { color: '#065F46', fontWeight: 'bold' }]}>
              {t('product.allowInspectionTitle', isRTL ? 'معاينة الطرد عند الاستلام أمام المندوب' : 'Open-box inspection upon delivery permitted')}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Sticky Bottom Order Confirmation Bar */}
      <View style={[styles.stickyFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.stickyPriceCol}>
          <Text style={styles.stickyPriceLabel}>{t('checkout.grandTotal')}</Text>
          <Text style={styles.stickyPriceValue}>{formatCurrency(grandTotal)}</Text>
        </View>

        <AnimatedPressable
          accessible={true}
          accessibilityRole="button"
          disabled={submitting || checkoutItems.length === 0}
          onPress={handleConfirmOrder}
          scaleTo={0.96}
          style={[
            styles.confirmOrderBtn,
            (submitting || checkoutItems.length === 0) && styles.confirmOrderBtnDisabled,
          ]}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <View style={styles.confirmBtnInner}>
              <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
              <Text style={styles.confirmBtnText}>{t('checkout.confirmOrder')}</Text>
              <Ionicons
                name={isRTL ? 'arrow-back' : 'arrow-forward'}
                size={16}
                color="#FFFFFF"
              />
            </View>
          )}
        </AnimatedPressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.screenBg,
  },
  scrollWrapper: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 12,
  },
  headerBox: {
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    gap: 4,
    marginBottom: 6,
  },
  secureBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  pageSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(236, 233, 230, 0.95)',
    padding: 16,
    ...shadows.cardElevated,
  },
  freeShippingCard: {
    backgroundColor: '#F0FDF4',
    borderColor: '#A7F3D0',
  },
  freeShippingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  freeShippingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  freeShippingTitle: {
    fontSize: 12,
    fontWeight: '800',
    flex: 1,
  },
  freeShippingPercent: {
    fontSize: 12,
    fontWeight: '900',
  },
  progressBarTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  freeShippingFootnote: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 6,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  deliveryOptionsContainer: {
    gap: 10,
  },
  deliveryOptionCard: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 12,
    backgroundColor: colors.cardBg,
  },
  deliveryOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  deliveryOptionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  deliveryOptionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deliveryOptionName: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  deliveryOptionNameActive: {
    color: colors.primary,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    borderColor: colors.primary,
  },
  radioInnerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  deliveryOptionDesc: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  inputGroup: {
    marginBottom: 10,
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  colHalf: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  requiredAsterisk: {
    color: colors.primary,
  },
  textInput: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    fontSize: 13,
    color: colors.textPrimary,
  },
  phoneInputRow: {
    flexDirection: 'row',
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  phonePrefixBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    backgroundColor: '#FAF8F5',
    borderRightWidth: 1,
    borderRightColor: colors.border,
    gap: 4,
  },
  flagEmoji: {
    fontSize: 14,
  },
  prefixNumber: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  phoneTextInput: {
    flex: 1,
    paddingHorizontal: 12,
    fontSize: 13,
    color: colors.textPrimary,
    textAlign: 'left',
  },
  fieldHelperText: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 4,
  },
  savedAddressesBox: {
    marginBottom: 8,
  },
  savedAddressesLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: 6,
  },
  savedAddressCard: {
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    width: 160,
  },
  savedAddressCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  savedAddressTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  savedAddressLabelText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  savedAddressSubText: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  savedAddressStreetText: {
    fontSize: 9,
    color: '#94A3B8',
    marginTop: 2,
  },
  pinLocationNudgeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  pinLocationNudgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
  },
  cityPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
  },
  cityPillActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  cityPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  cityPillTextActive: {
    color: '#FFFFFF',
  },
  pickupPointCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
  },
  pickupPointCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  pickupPointTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  pickupPointName: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  pickupPointCity: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
  pickupPointAddress: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  pickupPointHours: {
    fontSize: 10,
    color: colors.primary,
    marginTop: 3,
    fontWeight: '600',
  },
  noPickupBox: {
    padding: 12,
    backgroundColor: '#FAF8F5',
    borderRadius: 12,
    alignItems: 'center',
  },
  noPickupText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  codCard: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    borderRadius: 14,
    padding: 12,
  },
  codHeaderRow: {
    flexDirection: 'row',
    gap: 10,
  },
  codIconCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  codTitleBox: {
    flex: 1,
    gap: 4,
  },
  codBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  codTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  guaranteedBadge: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  guaranteedBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#059669',
  },
  codDesc: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  vendorParcelBox: {
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 10,
  },
  vendorParcelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  vendorTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  vendorParcelName: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  fromCityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 4,
  },
  fromCityText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  vendorItemsList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ECE9E6',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  vendorItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  vendorItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  vendorItemName: {
    fontSize: 12,
    color: colors.textPrimary,
    flex: 1,
  },
  vendorItemQty: {
    fontWeight: '800',
    color: colors.primary,
  },
  vendorItemPrice: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  itemsCountLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  summaryItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
  },
  summaryItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryThumbBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  summaryThumb: {
    width: '100%',
    height: '100%',
  },
  summaryItemInfo: {
    flex: 1,
  },
  summaryItemTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  summaryItemVariant: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 1,
  },
  summaryItemUnitPrice: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  summaryItemLineTotal: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  couponInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  couponInput: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    fontSize: 12,
    fontWeight: '800',
    backgroundColor: '#FFFFFF',
    letterSpacing: 0.5,
  },
  applyCouponBtn: {
    backgroundColor: colors.secondary,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#0E1114',
    ...shadows.tactile,
  },
  applyCouponBtnDisabled: {
    opacity: 0.4,
  },
  applyCouponText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  appliedCouponBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    padding: 12,
  },
  appliedCouponLeft: {
    gap: 2,
  },
  appliedCouponCode: {
    fontSize: 13,
    fontWeight: '900',
    color: '#065F46',
  },
  appliedCouponDiscount: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },
  removeCouponBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  removeCouponText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
  walletHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  walletTitleCol: {
    flex: 1,
  },
  walletBalanceText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textSecondary,
    marginTop: 2,
  },
  walletDeductionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 10,
    padding: 8,
    marginTop: 8,
  },
  walletDeductionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  walletDeductionAmount: {
    fontSize: 12,
    fontWeight: '900',
    color: '#059669',
  },
  summaryCardTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.textPrimary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 8,
    marginBottom: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  summaryValueBold: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
  },
  summaryLabelDiscount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
  summaryValueDiscount: {
    fontSize: 13,
    fontWeight: '800',
    color: '#059669',
  },
  grandTotalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    marginTop: 4,
  },
  grandTotalLabel: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  grandTotalAmount: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.primary,
  },
  trustFooterBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    marginTop: 10,
  },
  trustFooterText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '600',
    textAlign: 'center',
  },
  stickyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.cardBg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(236, 233, 230, 0.8)',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 14,
    ...shadows.floating,
  },
  stickyPriceCol: {
    justifyContent: 'center',
  },
  stickyPriceLabel: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  stickyPriceValue: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.primary,
  },
  confirmOrderBtn: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    height: 50,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 3,
    borderBottomColor: '#960B21',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.28)',
    ...shadows.tactilePrimary,
  },
  confirmOrderBtnDisabled: {
    backgroundColor: colors.disabledBg,
    borderBottomWidth: 0,
    borderTopWidth: 0,
    elevation: 0,
    shadowOpacity: 0,
  },
  confirmBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: colors.screenBg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.textPrimary,
    marginTop: 12,
    marginBottom: 16,
  },
  emptyCancelButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  emptyCancelText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
