import tw from 'twrnc';
import React, { useState, useEffect, useMemo, useContext, useCallback } from 'react';
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
} from 'react-native';
import { Image } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { CartContext } from '../../context/CartContext';
import { createOrder } from '../../api/ordersApi';
import { getProductById } from '../../api/productsApi';
import { getDeliveryCities, getPickupPoints, calculateDeliveryQuote } from '../../api/deliveryApi';
import { getMyAddresses } from '../../api/usersApi';
import { formatCurrency } from '../../utils/currency';
import { isValidEgyptianPhone, normalizeEgyptianPhone, formatEgyptianPhone } from '../../utils/egyptianPhone';
import { getImageUrl } from '../../utils/imageUrl';
import { colors } from '../../theme/colors';
import { LinearGradient } from 'expo-linear-gradient';

const cardShadow = Platform.select({
  ios: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  android: {
    elevation: 1,
  },
  default: {},
});

export default function CheckoutScreen({ route, navigation }) {
  const { t } = useTranslation();
  const { removeItems, updateCartItem } = useContext(CartContext);
  const isRTL = I18nManager.isRTL;

  const buyNowItem = route?.params?.buyNowItem;
  const initialCartItems = route?.params?.cartItems;
  const isBuyNow = Boolean(buyNowItem);

  const [checkoutItems, setCheckoutItems] = useState(
    buyNowItem
      ? [
          {
            productId: buyNowItem.product.id,
            quantity: buyNowItem.quantity,
            product: buyNowItem.product,
          },
        ]
      : initialCartItems || []
  );

  // Delivery Method: 'Courier' (باب المنزل) or 'Pickup' (نقطة استلام بوسطة)
  const [deliveryMethod, setDeliveryMethod] = useState('Courier');

  // Saved addresses
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);

  // Manual Courier Address Fields
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [governorate, setGovernorate] = useState('القاهرة');
  const [city, setCity] = useState('مدينة نصر');
  const [area, setArea] = useState('الحي السابع');
  const [streetBuilding, setStreetBuilding] = useState('');

  // Pickup Branch State
  const [availableCities, setAvailableCities] = useState([]);
  const [pickupCity, setPickupCity] = useState('القاهرة');
  const [pickupPoints, setPickupPoints] = useState([]);
  const [selectedPickupPointId, setSelectedPickupPointId] = useState('');

  // Delivery Quote State
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteData, setQuoteData] = useState(null);

  // Submission State
  const [submitting, setSubmitting] = useState(false);

  // Calculate items total
  const itemsSubtotal = useMemo(() => {
    return checkoutItems.reduce((acc, it) => {
      const price = Number(it?.product?.price) || 0;
      const qty = Number(it?.quantity) || 1;
      return acc + price * qty;
    }, 0);
  }, [checkoutItems]);

  const totalCount = useMemo(() => {
    return checkoutItems.reduce((acc, it) => acc + (Number(it?.quantity) || 1), 0);
  }, [checkoutItems]);

  // Load addresses & delivery cities on mount
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
          setGovernorate(def.governorate || 'القاهرة');
          setCity(def.city || 'مدينة نصر');
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
        ? (governorate || city || 'القاهرة')
        : (pickupCity || 'القاهرة');

      const payload = {
        items: checkoutItems.map((it) => ({
          productId: it.productId,
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

  const deliveryCostTotal = Number(quoteData?.totalDeliveryCost) || (deliveryMethod === 'Pickup' ? 35 : 50);
  const grandTotal = itemsSubtotal + deliveryCostTotal;

  const handleConfirmOrder = async () => {
    if (checkoutItems.length === 0 || submitting) return;

    // Validate inputs
    if (!recipientName.trim()) {
      Alert.alert(t('common.error'), 'يرجى إدخال اسم المستلم بالكامل');
      return;
    }

    if (!isValidEgyptianPhone(recipientPhone)) {
      Alert.alert(t('common.error'), t('common.invalidPhone'));
      return;
    }

    if (deliveryMethod === 'Courier') {
      if (!governorate.trim() || !city.trim() || !area.trim() || !streetBuilding.trim()) {
        Alert.alert(t('common.error'), 'يرجى استكمال بيانات العنوان (المحافظة، المدينة، الحي، الشارع والعمارة)');
        return;
      }
    } else {
      if (!selectedPickupPointId) {
        Alert.alert(t('common.error'), 'يرجى اختيار فرع أو نقطة استلام بوسطة');
        return;
      }
    }

    setSubmitting(true);

    const payload = {
      items: checkoutItems.map((it) => ({
        productId: it.productId,
        quantity: it.quantity,
      })),
      deliveryMethod,
      pickupPointId: deliveryMethod === 'Pickup' ? selectedPickupPointId : null,
      recipientName: recipientName.trim(),
      recipientPhone: normalizeEgyptianPhone(recipientPhone),
      governorate: deliveryMethod === 'Courier' ? governorate.trim() : pickupCity,
      city: deliveryMethod === 'Courier' ? city.trim() : pickupCity,
      area: deliveryMethod === 'Courier' ? area.trim() : 'نقطة استلام',
      streetBuilding: deliveryMethod === 'Courier' ? streetBuilding.trim() : 'استلام من الفرع',
      paymentMethod: 'CashOnDelivery',
    };

    try {
      const res = await createOrder(payload);
      const createdOrder = res?.data;

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
            text: 'عرض طلباتي',
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
          'تنبيه الدفع عند الاستلام',
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
      <View
        style={[
          tw`flex-1 items-center justify-center p-6`,
          { backgroundColor: colors.screenBg },
        ]}
      >
        <MaterialCommunityIcons name="cart-off" size={56} color={colors.textSecondary} />
        <Text style={[tw`text-lg font-bold mt-4 text-center`, { color: colors.textPrimary }]}>
          {t('cart.emptyTitle')}
        </Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[tw`mt-5 px-6 py-2.5 rounded-xl`, { backgroundColor: colors.primary }]}
        >
          <Text style={tw`text-white font-bold`}>{t('common.cancel')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[tw`flex-1`, { backgroundColor: colors.screenBg }]}>
      <ScrollView
        style={tw`flex-1`}
        contentContainerStyle={{ padding: 14, paddingBottom: 36 }}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Egyptian COD Banner */}
        <View
          style={[
            tw`flex-row items-center p-3.5 rounded-xl mb-3 border`,
            {
              backgroundColor: colors.primarySoft,
              borderColor: colors.primary,
            },
          ]}
        >
          <MaterialCommunityIcons name="cash-multiple" size={24} color={colors.primary} />
          <View style={[tw`flex-1 ${isRTL ? 'mr-2.5' : 'ml-2.5'}`]}>
            <Text style={[tw`text-xs font-bold`, { color: colors.primary }]}>
              {t('checkout.cashOnDelivery')}
            </Text>
            <Text style={[tw`text-[11px] mt-0.5`, { color: colors.textPrimary }]}>
              {t('checkout.codDescription')}
            </Text>
          </View>
        </View>

        {/* 2. Delivery Method Selector (Courier vs Pickup) */}
        <View
          style={[
            cardShadow,
            tw`rounded-2xl p-4 mb-3 border`,
            { backgroundColor: colors.cardBg, borderColor: colors.border },
          ]}
        >
          <Text
            style={[
              tw`font-bold text-base mb-3`,
              { color: colors.textPrimary, textAlign: isRTL ? 'right' : 'left' },
            ]}
          >
            {t('checkout.deliveryMethod')}
          </Text>

          <View style={tw`flex-row items-center justify-between`}>
            {/* Courier Button */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setDeliveryMethod('Courier')}
              style={[
                tw`flex-1 p-3 rounded-xl border ${isRTL ? 'ml-2' : 'mr-2'}`,
                {
                  backgroundColor: deliveryMethod === 'Courier' ? colors.primarySoft : colors.screenBg,
                  borderColor: deliveryMethod === 'Courier' ? colors.primary : colors.border,
                },
              ]}
            >
              <View style={tw`flex-row items-center mb-1`}>
                <MaterialCommunityIcons
                  name="truck-delivery-outline"
                  size={20}
                  color={deliveryMethod === 'Courier' ? colors.primary : colors.textSecondary}
                />
                <Text
                  style={[
                    tw`font-bold text-xs ${isRTL ? 'mr-1.5' : 'ml-1.5'}`,
                    { color: deliveryMethod === 'Courier' ? colors.primary : colors.textPrimary },
                  ]}
                >
                  توصيل للمنزل
                </Text>
              </View>
              <Text style={[tw`text-[10px]`, { color: colors.textSecondary }]}>
                سريع لباب بيتك
              </Text>
            </TouchableOpacity>

            {/* Pickup Button (Bosta branch) */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setDeliveryMethod('Pickup')}
              style={[
                tw`flex-1 p-3 rounded-xl border ${isRTL ? 'mr-2' : 'ml-2'}`,
                {
                  backgroundColor: deliveryMethod === 'Pickup' ? colors.primarySoft : colors.screenBg,
                  borderColor: deliveryMethod === 'Pickup' ? colors.primary : colors.border,
                },
              ]}
            >
              <View style={tw`flex-row items-center mb-1`}>
                <MaterialCommunityIcons
                  name="store-outline"
                  size={20}
                  color={deliveryMethod === 'Pickup' ? colors.primary : colors.textSecondary}
                />
                <Text
                  style={[
                    tw`font-bold text-xs ${isRTL ? 'mr-1.5' : 'ml-1.5'}`,
                    { color: deliveryMethod === 'Pickup' ? colors.primary : colors.textPrimary },
                  ]}
                >
                  فرع بوسطة
                </Text>
              </View>
              <Text style={[tw`text-[10px]`, { color: colors.textSecondary }]}>
                اقتصادي ومناسب
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 3. Recipient & Address Details */}
        <View
          style={[
            cardShadow,
            tw`rounded-2xl p-4 mb-3 border`,
            { backgroundColor: colors.cardBg, borderColor: colors.border },
          ]}
        >
          <Text
            style={[
              tw`font-bold text-base mb-3`,
              { color: colors.textPrimary, textAlign: isRTL ? 'right' : 'left' },
            ]}
          >
            {deliveryMethod === 'Courier' ? t('checkout.deliveryAddress') : t('checkout.pickupPoint')}
          </Text>

          {/* Recipient Full Name */}
          <Text
            style={[
              tw`text-xs font-semibold mb-1`,
              { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' },
            ]}
          >
            {t('checkout.recipientName')} *
          </Text>
          <TextInput
            style={[
              tw`border rounded-xl px-3.5 py-2.5 text-sm mb-2.5`,
              {
                borderColor: colors.border,
                backgroundColor: colors.screenBg,
                color: colors.textPrimary,
                textAlign: isRTL ? 'right' : 'left',
              },
            ]}
            value={recipientName}
            onChangeText={setRecipientName}
            placeholder="مثال: أحمد محمد علي"
            placeholderTextColor={colors.textSecondary}
          />

          {/* Recipient Egyptian Phone */}
          <Text
            style={[
              tw`text-xs font-semibold mb-1`,
              { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' },
            ]}
          >
            {t('checkout.recipientPhone')} *
          </Text>
          <TextInput
            style={[
              tw`border rounded-xl px-3.5 py-2.5 text-sm mb-3`,
              {
                borderColor: colors.border,
                backgroundColor: colors.screenBg,
                color: colors.textPrimary,
                textAlign: isRTL ? 'right' : 'left',
              },
            ]}
            keyboardType="phone-pad"
            value={recipientPhone}
            onChangeText={setRecipientPhone}
            placeholder="010xxxxxxxx"
            placeholderTextColor={colors.textSecondary}
          />

          {deliveryMethod === 'Courier' ? (
            <View>
              {/* Saved Address Quick Select */}
              {savedAddresses.length > 0 && (
                <View style={tw`mb-3`}>
                  <Text
                    style={[
                      tw`text-xs font-bold mb-2`,
                      { color: colors.primary, textAlign: isRTL ? 'right' : 'left' },
                    ]}
                  >
                    {t('checkout.selectSavedAddress')}
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {savedAddresses.map((addr) => (
                      <TouchableOpacity
                        key={`checkout-addr-${addr.id}`}
                        onPress={() => handleSelectSavedAddress(addr)}
                        style={[
                          tw`p-2.5 rounded-xl border mr-2`,
                          {
                            borderColor: selectedAddressId === addr.id ? colors.primary : colors.border,
                            backgroundColor: selectedAddressId === addr.id ? colors.primarySoft : colors.screenBg,
                            minWidth: 140,
                          },
                        ]}
                      >
                        <Text style={[tw`font-bold text-xs`, { color: colors.textPrimary }]}>
                          {addr.label || 'عنوان'}
                        </Text>
                        <Text style={[tw`text-[11px] mt-0.5`, { color: colors.textSecondary }]}>
                          {addr.governorate}، {addr.city}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* 4 Egyptian Address Fields */}
              <View style={tw`flex-row justify-between mb-2.5`}>
                <View style={tw`flex-1 mr-1.5`}>
                  <Text style={[tw`text-xs font-semibold mb-1`, { color: colors.textSecondary }]}>
                    {t('checkout.governorate')} *
                  </Text>
                  <TextInput
                    style={[
                      tw`border rounded-xl px-3 py-2 text-sm`,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.screenBg,
                        color: colors.textPrimary,
                        textAlign: isRTL ? 'right' : 'left',
                      },
                    ]}
                    value={governorate}
                    onChangeText={setGovernorate}
                    placeholder="القاهرة"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>

                <View style={tw`flex-1 ml-1.5`}>
                  <Text style={[tw`text-xs font-semibold mb-1`, { color: colors.textSecondary }]}>
                    {t('checkout.city')} *
                  </Text>
                  <TextInput
                    style={[
                      tw`border rounded-xl px-3 py-2 text-sm`,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.screenBg,
                        color: colors.textPrimary,
                        textAlign: isRTL ? 'right' : 'left',
                      },
                    ]}
                    value={city}
                    onChangeText={setCity}
                    placeholder="مدينة نصر"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
              </View>

              <View style={tw`mb-2.5`}>
                <Text style={[tw`text-xs font-semibold mb-1`, { color: colors.textSecondary }]}>
                  {t('checkout.area')} *
                </Text>
                <TextInput
                  style={[
                    tw`border rounded-xl px-3.5 py-2 text-sm`,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.screenBg,
                      color: colors.textPrimary,
                      textAlign: isRTL ? 'right' : 'left',
                    },
                  ]}
                  value={area}
                  onChangeText={setArea}
                  placeholder="الحي / المنطقة"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              <View style={tw`mb-1`}>
                <Text style={[tw`text-xs font-semibold mb-1`, { color: colors.textSecondary }]}>
                  {t('checkout.streetBuilding')} *
                </Text>
                <TextInput
                  style={[
                    tw`border rounded-xl px-3.5 py-2 text-sm`,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.screenBg,
                      color: colors.textPrimary,
                      textAlign: isRTL ? 'right' : 'left',
                    },
                  ]}
                  value={streetBuilding}
                  onChangeText={setStreetBuilding}
                  placeholder="الشارع ورقم العمارة والدور والشقة"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
            </View>
          ) : (
            /* Pickup Branch Selector */
            <View>
              {/* City Selector */}
              <Text style={[tw`text-xs font-semibold mb-1.5`, { color: colors.textSecondary }]}>
                اختر المحافظة / المدينة:
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={tw`mb-3`}>
                {(availableCities.length > 0 ? availableCities : [{ name: 'القاهرة' }, { name: 'الجيزة' }, { name: 'الإسكندرية' }]).map((c) => (
                  <TouchableOpacity
                    key={`pickup-city-${c.name}`}
                    onPress={() => handleCityChangeForPickup(c.name)}
                    style={[
                      tw`px-3.5 py-1.5 rounded-full border mr-2`,
                      {
                        backgroundColor: pickupCity === c.name ? colors.primary : colors.screenBg,
                        borderColor: pickupCity === c.name ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        tw`text-xs font-bold`,
                        { color: pickupCity === c.name ? colors.white : colors.textPrimary },
                      ]}
                    >
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Pickup Point Cards */}
              <Text style={[tw`text-xs font-semibold mb-2`, { color: colors.textSecondary }]}>
                {t('checkout.choosePickupPoint')}:
              </Text>
              {pickupPoints.map((point) => (
                <TouchableOpacity
                  key={`point-${point.id}`}
                  onPress={() => setSelectedPickupPointId(point.id)}
                  style={[
                    tw`p-3 rounded-xl border mb-2`,
                    {
                      borderColor: selectedPickupPointId === point.id ? colors.primary : colors.border,
                      backgroundColor: selectedPickupPointId === point.id ? colors.primarySoft : colors.screenBg,
                    },
                  ]}
                >
                  <View style={tw`flex-row items-center justify-between mb-1`}>
                    <Text style={[tw`font-bold text-xs`, { color: colors.textPrimary }]}>
                      {point.name}
                    </Text>
                    {selectedPickupPointId === point.id && (
                      <MaterialCommunityIcons name="check-circle" size={16} color={colors.primary} />
                    )}
                  </View>
                  <Text style={[tw`text-[11px]`, { color: colors.textSecondary }]}>
                    {point.address}
                  </Text>
                  {point.workHours && (
                    <Text style={[tw`text-[10px] mt-0.5`, { color: colors.primary }]}>
                      مواعيد العمل: {point.workHours}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* 4. Per-Seller Parcels Breakdown */}
        {quoteData?.parcels && quoteData.parcels.length > 0 && (
          <View
            style={[
              cardShadow,
              tw`rounded-2xl p-4 mb-3 border`,
              { backgroundColor: colors.cardBg, borderColor: colors.border },
            ]}
          >
            <View style={tw`flex-row items-center justify-between mb-3`}>
              <Text style={[tw`font-bold text-base`, { color: colors.textPrimary }]}>
                {t('checkout.parcelsBreakdown')}
              </Text>
              <View style={[tw`px-2.5 py-0.5 rounded-full`, { backgroundColor: colors.primarySoft }]}>
                <Text style={[tw`text-xs font-bold`, { color: colors.primary }]}>
                  {quoteData.parcels.length} {quoteData.parcels.length === 1 ? 'شحنة' : 'شحنات منفصلة'}
                </Text>
              </View>
            </View>

            {quoteData.parcels.map((parcel, idx) => {
              const parcelItemsSubtotal = (parcel.items || []).reduce(
                (sum, it) => sum + (Number(it.unitPrice) || 0) * (it.quantity || 1),
                0
              );
              const parcelCodAmount = parcel.codAmount || (parcelItemsSubtotal + (parcel.deliveryCost || 0));

              return (
                <View
                  key={`quote-parcel-${parcel.sellerId || idx}`}
                  style={[
                    tw`p-3 rounded-xl border mb-2.5`,
                    { borderColor: colors.border, backgroundColor: colors.screenBg },
                  ]}
                >
                  <View style={tw`flex-row items-center justify-between mb-1.5`}>
                    <Text style={[tw`font-bold text-xs`, { color: colors.textPrimary }]}>
                      {t('checkout.sellerParcel', { seller: parcel.sellerName || `تاجر رقم ${parcel.sellerId}` })}
                    </Text>
                    <Text style={[tw`text-xs font-semibold`, { color: colors.primary }]}>
                      الشحن: {formatCurrency(parcel.deliveryCost)}
                    </Text>
                  </View>

                  <Text style={[tw`text-[11px]`, { color: colors.textSecondary }]}>
                    تشحن من: {parcel.dispatchCity || 'القاهرة'} • التوصيل المتوقع خلال {parcel.etaMinDays}–{parcel.etaMaxDays} أيام
                  </Text>

                  {/* Shipment COD Badge */}
                  <View
                    style={[
                      tw`mt-2 pt-2 border-t border-gray-100 flex-row items-center justify-between`,
                    ]}
                  >
                    <Text style={[tw`text-[11px] font-medium`, { color: colors.textSecondary }]}>
                      مبلغ التحصيل لهذه الشحنة (COD):
                    </Text>
                    <Text style={[tw`text-xs font-bold`, { color: colors.accent }]}>
                      {formatCurrency(parcelCodAmount)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* 5. Order Items Summary */}
        <View
          style={[
            cardShadow,
            tw`rounded-2xl p-4 mb-3 border`,
            { backgroundColor: colors.cardBg, borderColor: colors.border },
          ]}
        >
          <View style={tw`flex-row items-center justify-between mb-3`}>
            <Text style={[tw`text-base font-bold`, { color: colors.textPrimary }]}>
              {t('cart.orderSummary')}
            </Text>
            <Text style={[tw`text-xs font-medium`, { color: colors.textSecondary }]}>
              {totalCount} {totalCount === 1 ? 'منتج' : 'منتجات'}
            </Text>
          </View>

          {checkoutItems.map((item, index) => {
            const product = item?.product || {};
            const imageUrl = getImageUrl(product?.imageUrls?.[0]);
            const linePrice = (Number(product.price) || 0) * (Number(item.quantity) || 1);

            return (
              <View
                key={`checkout-it-${item.productId}-${index}`}
                style={[
                  tw`flex-row items-center py-2.5`,
                  index < checkoutItems.length - 1 && tw`border-b border-gray-100`,
                ]}
              >
                <View
                  style={[
                    tw`rounded-lg overflow-hidden ${isRTL ? 'ml-3' : 'mr-3'}`,
                    { width: 50, height: 50, backgroundColor: colors.placeholderBg },
                  ]}
                >
                  {imageUrl ? (
                    <Image source={{ uri: imageUrl }} style={tw`w-full h-full`} contentFit="cover" />
                  ) : (
                    <View style={tw`w-full h-full items-center justify-center`}>
                      <MaterialCommunityIcons name="image-off-outline" size={18} color={colors.textSecondary} />
                    </View>
                  )}
                </View>

                <View style={[tw`flex-1 ${isRTL ? 'ml-2' : 'mr-2'}`]}>
                  <Text numberOfLines={1} style={[tw`font-semibold text-sm`, { color: colors.textPrimary }]}>
                    {product.name}
                  </Text>
                  <Text style={[tw`text-xs mt-0.5`, { color: colors.textSecondary }]}>
                    {`${formatCurrency(product.price)} × ${item.quantity}`}
                  </Text>
                </View>

                <Text style={[tw`font-bold text-sm`, { color: colors.textPrimary }]}>
                  {formatCurrency(linePrice)}
                </Text>
              </View>
            );
          })}
        </View>

        {/* 6. Pricing Breakdown */}
        <View
          style={[
            cardShadow,
            tw`rounded-2xl p-4 mb-3 border`,
            { backgroundColor: colors.cardBg, borderColor: colors.border },
          ]}
        >
          <View style={tw`flex-row items-center justify-between mb-2`}>
            <Text style={[tw`text-sm`, { color: colors.textSecondary }]}>
              {t('checkout.itemsTotal')}
            </Text>
            <Text style={[tw`text-sm font-semibold`, { color: colors.textPrimary }]}>
              {formatCurrency(itemsSubtotal)}
            </Text>
          </View>

          <View style={tw`flex-row items-center justify-between mb-2`}>
            <Text style={[tw`text-sm`, { color: colors.textSecondary }]}>
              {t('checkout.deliveryTotal')}
            </Text>
            <Text style={[tw`text-sm font-semibold`, { color: colors.primary }]}>
              {quoteLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                formatCurrency(deliveryCostTotal)
              )}
            </Text>
          </View>

          <View style={tw`border-t border-gray-100 pt-3 mt-1 flex-row items-center justify-between`}>
            <Text style={[tw`text-base font-bold`, { color: colors.textPrimary }]}>
              {t('checkout.grandTotal')}
            </Text>
            <Text style={[tw`text-xl font-bold`, { color: colors.primary }]}>
              {formatCurrency(grandTotal)}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Sticky Bottom Order Confirmation Bar */}
      <View
        style={[
          cardShadow,
          tw`px-4 pt-3 pb-6 border-t`,
          { backgroundColor: colors.cardBg, borderColor: colors.border },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.85}
          disabled={submitting || checkoutItems.length === 0}
          onPress={handleConfirmOrder}
          style={{ borderRadius: 14, overflow: 'hidden' }}
        >
          <LinearGradient
            colors={
              submitting || checkoutItems.length === 0
                ? [colors.disabledBg, colors.disabledBg]
                : [colors.accent, '#FF8C33']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[
              tw`w-full flex-row items-center justify-center`,
              { minHeight: 52 },
            ]}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <MaterialCommunityIcons name="check-circle-outline" size={22} color={colors.white} />
                <Text style={[tw`font-bold text-base ${isRTL ? 'mr-2' : 'ml-2'}`, { color: colors.white }]}>
                  {t('checkout.confirmOrder')} • {formatCurrency(grandTotal)}
                </Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}
