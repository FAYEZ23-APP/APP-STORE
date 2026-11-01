import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Animated,
  Alert,
} from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import tw from 'twrnc';
import { colors } from '../theme/colors';
import { calculateShippingFee } from '../api/shippingApi';

// Default center: Cairo, Egypt
const DEFAULT_COORDS = {
  latitude: 30.0444,
  longitude: 31.2357,
  latitudeDelta: 0.012,
  longitudeDelta: 0.012,
};

const cardShadow = Platform?.select
  ? Platform.select({
      ios: {
        shadowColor: colors.shadow || '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
      },
      android: {
        elevation: 6,
      },
      default: {},
    })
  : { elevation: 6 };

/**
 * Robust parser for native reverseGeocodeAsync results (Zero Google API Cost).
 * Strips Egyptian administrative prefixes ("محافظة القاهرة" -> "القاهرة").
 */
export function parseNativeGeocode(firstResult, lat, lng) {
  if (!firstResult) {
    return {
      governorate: '',
      city: '',
      area: '',
      streetBuilding: '',
      buildingNumber: '',
      formattedAddress: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    };
  }

  const governorate = (firstResult.region || firstResult.subregion || '')
    .replace(/^محافظة\s+/i, '')
    .replace(/\s+Governorate$/i, '')
    .trim();

  const city = (firstResult.city || firstResult.subregion || governorate)
    .replace(/^مركز\s+/i, '')
    .replace(/^مدينة\s+/i, '')
    .trim();

  const area = firstResult.district || firstResult.subregion || '';
  const street = firstResult.street || '';
  const buildingNumber = firstResult.streetNumber || '';

  const addressParts = [
    buildingNumber ? `${buildingNumber} ` : '',
    street,
    area,
    city,
    governorate,
  ].filter(Boolean);

  const formattedAddress =
    firstResult.formattedAddress ||
    addressParts.join('، ') ||
    `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

  return {
    governorate: governorate || city,
    city: city || governorate,
    area,
    streetBuilding: [buildingNumber ? `${buildingNumber} ` : '', street].filter(Boolean).join(' ') || area,
    buildingNumber,
    formattedAddress,
  };
}

/**
 * MobileLocationPicker Component / Screen
 *
 * Props:
 * - initialLocation: { latitude, longitude }
 * - onConfirmLocation: Callback returning { latitude, longitude, formattedAddress, governorate, city, area, streetBuilding, buildingNumber, shippingFee, distanceKm, estimatedTime }
 * - onClose: Close callback (if modal)
 * - navigation: React Navigation prop (if mounted as screen)
 * - route: React Navigation route prop (if mounted as screen)
 */
export default function MobileLocationPicker({
  initialLocation,
  onConfirmLocation,
  onClose,
  navigation,
  route,
}) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  // Support both component props and navigation params
  const passedInitial = initialLocation || route?.params?.initialLocation;
  const passedOnConfirm = onConfirmLocation || route?.params?.onConfirmLocation;
  const passedOnClose = onClose || route?.params?.onClose;

  const mapRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const lastGeocodedCoordsRef = useRef({ lat: 0, lng: 0 });

  // Pin bounce animation states
  const pinTranslateY = useRef(new Animated.Value(0)).current;
  const shadowScale = useRef(new Animated.Value(1)).current;

  const [currentCoords, setCurrentCoords] = useState({
    latitude: passedInitial?.latitude || DEFAULT_COORDS.latitude,
    longitude: passedInitial?.longitude || DEFAULT_COORDS.longitude,
  });

  const [isDragging, setIsDragging] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isCalculatingShipping, setIsCalculatingShipping] = useState(false);

  const [addressDetails, setAddressDetails] = useState(null);
  const [shippingResult, setShippingResult] = useState(null);
  const [shippingError, setShippingError] = useState(null);

  /**
   * Request Foreground Location Permission cleanly on mount
   */
  useEffect(() => {
    let isMounted = true;

    async function requestLocationPermission() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          // If no initial location was provided, auto-center on current user GPS
          if (!passedInitial) {
            handleLocateMe();
          } else {
            triggerGeocodeAndShipping(currentCoords.latitude, currentCoords.longitude);
          }
        } else {
          Alert.alert(
            t('map.permissionTitle', 'السماح بالوصول إلى الموقع'),
            t(
              'map.permissionDenied',
              'تم رفض إذن الوصول إلى الموقع. يمكنك تحريك الخريطة يدوياً لتحديد موقعك.'
            )
          );
          triggerGeocodeAndShipping(currentCoords.latitude, currentCoords.longitude);
        }
      } catch (err) {
        console.warn('Location permission request error:', err);
        if (isMounted) {
          triggerGeocodeAndShipping(currentCoords.latitude, currentCoords.longitude);
        }
      }
    }

    requestLocationPermission();

    return () => {
      isMounted = false;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  /**
   * Zero-Cost Native Reverse Geocoding via expo-location
   */
  const geocodeAddress = useCallback(
    async (lat, lng) => {
      setIsGeocoding(true);
      try {
        const results = await Location.reverseGeocodeAsync({
          latitude: lat,
          longitude: lng,
        });

        if (results && results.length > 0) {
          const parsed = parseNativeGeocode(results[0], lat, lng);
          setAddressDetails(parsed);
          return parsed;
        }
      } catch (err) {
        console.warn('Native reverse geocode error:', err.message);
      } finally {
        setIsGeocoding(false);
      }

      const fallback = {
        governorate: '',
        city: '',
        area: '',
        streetBuilding: '',
        buildingNumber: '',
        formattedAddress: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      };
      setAddressDetails(fallback);
      return fallback;
    },
    []
  );

  /**
   * Real-time shipping calculation from backend
   */
  const calculateShipping = useCallback(
    async (lat, lng) => {
      setIsCalculatingShipping(true);
      setShippingError(null);

      try {
        const response = await calculateShippingFee({
          latitude: lat,
          longitude: lng,
        });
        setShippingResult(response.data);
      } catch (err) {
        console.error('Mobile shipping calculation error:', err);
        setShippingError(
          err.response?.data?.message ||
            t('map.shippingCalculationFailed', 'تعذر حساب تكلفة الشحن لهذا الموقع')
        );
      } finally {
        setIsCalculatingShipping(false);
      }
    },
    [t]
  );

  const triggerGeocodeAndShipping = useCallback(
    async (lat, lng) => {
      lastGeocodedCoordsRef.current = { lat, lng };
      setCurrentCoords({ latitude: lat, longitude: lng });
      await geocodeAddress(lat, lng);
      await calculateShipping(lat, lng);
    },
    [geocodeAddress, calculateShipping]
  );

  /**
   * Floating "My Location" Button Handler
   */
  const handleLocateMe = useCallback(async () => {
    setIsLocating(true);
    try {
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = position.coords;
      const newRegion = {
        latitude,
        longitude,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      };

      if (mapRef.current) {
        mapRef.current.animateToRegion(newRegion, 800);
      }

      triggerGeocodeAndShipping(latitude, longitude);
    } catch (err) {
      console.warn('Locate Me error:', err.message);
      Alert.alert(
        t('common.error', 'خطأ'),
        t('map.permissionDenied', 'تعذر تحديد موقعك الحالي. يرجى التأكد من تشغيل GPS.')
      );
    } finally {
      setIsLocating(false);
    }
  }, [t, triggerGeocodeAndShipping]);

  /**
   * Region change event handlers for Uber/Talabat pin animation
   */
  const handleRegionChange = useCallback(() => {
    if (!isDragging) {
      setIsDragging(true);
      Animated.parallel([
        Animated.timing(pinTranslateY, {
          toValue: -14,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(shadowScale, {
          toValue: 0.6,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  }, [isDragging, pinTranslateY, shadowScale]);

  /**
   * Cost Optimization & Debounce on Region Change Complete
   */
  const handleRegionChangeComplete = useCallback(
    (newRegion) => {
      setIsDragging(false);

      Animated.parallel([
        Animated.spring(pinTranslateY, {
          toValue: 0,
          friction: 4,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.spring(shadowScale, {
          toValue: 1,
          friction: 4,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();

      const lat = Number(newRegion.latitude.toFixed(6));
      const lng = Number(newRegion.longitude.toFixed(6));

      // Movement threshold check: skip if barely moved (< 5 meters)
      const latDiff = Math.abs(lat - lastGeocodedCoordsRef.current.lat);
      const lngDiff = Math.abs(lng - lastGeocodedCoordsRef.current.lng);

      if (latDiff < 0.00005 && lngDiff < 0.00005 && addressDetails) {
        return;
      }

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // 500ms debounce
      debounceTimerRef.current = setTimeout(() => {
        triggerGeocodeAndShipping(lat, lng);
      }, 500);
    },
    [pinTranslateY, shadowScale, addressDetails, triggerGeocodeAndShipping]
  );

  /**
   * Confirm Selected Location Handler
   */
  const handleConfirm = () => {
    const payload = {
      latitude: currentCoords.latitude,
      longitude: currentCoords.longitude,
      formattedAddress: addressDetails?.formattedAddress || '',
      governorate: addressDetails?.governorate || '',
      city: addressDetails?.city || '',
      area: addressDetails?.area || '',
      streetBuilding: addressDetails?.streetBuilding || '',
      buildingNumber: addressDetails?.buildingNumber || '',
      googleMapsLink: `https://www.google.com/maps?q=${currentCoords.latitude},${currentCoords.longitude}`,
      shippingFee: shippingResult?.totalShippingCost ?? null,
      distanceKm: shippingResult?.distanceKm ?? null,
      estimatedTime: shippingResult?.estimatedTime ?? '',
      isRoadDistance: shippingResult?.isRoadDistance ?? false,
      source: shippingResult?.source ?? '',
    };

    if (passedOnConfirm) {
      passedOnConfirm(payload);
    }

    if (passedOnClose) {
      passedOnClose();
    } else if (navigation?.canGoBack()) {
      navigation.goBack();
    }
  };

  const handleClose = () => {
    if (passedOnClose) {
      passedOnClose();
    } else if (navigation?.canGoBack()) {
      navigation.goBack();
    }
  };

  return (
    <View style={tw`flex-1 bg-white relative`}>
      {/* ─── MapView with Google Maps Provider ────────────────── */}
      <MapView
        ref={mapRef}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        style={StyleSheet.absoluteFillObject}
        initialRegion={{
          latitude: currentCoords.latitude,
          longitude: currentCoords.longitude,
          latitudeDelta: DEFAULT_COORDS.latitudeDelta,
          longitudeDelta: DEFAULT_COORDS.longitudeDelta,
        }}
        onRegionChange={handleRegionChange}
        onRegionChangeComplete={handleRegionChangeComplete}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
      />

      {/* ─── Fixed Custom Center Pin (pointerEvents="none") ──── */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          tw`items-center justify-center`,
          { zIndex: 10 },
        ]}
      >
        {/* Floating Instruction Badge above the Pin */}
        <View
          style={tw`mb-2 px-3 py-1 bg-gray-900/90 rounded-full flex-row items-center border border-white/20 shadow-md`}
        >
          <View style={tw`w-2 h-2 rounded-full bg-emerald-400 mr-1.5`} />
          <Text style={tw`text-white text-xs font-bold`}>
            {isDragging
              ? t('map.releaseToPick', 'حرّك الخريطة وضع الدبوس عند موقعك')
              : t('map.deliveryTarget', 'موقع التوصيل المحدد')}
          </Text>
        </View>

        {/* Center Pin Marker with Spring Bounce Animation */}
        <Animated.View
          style={{
            transform: [{ translateY: pinTranslateY }],
            alignItems: 'center',
          }}
        >
          <MaterialCommunityIcons name="map-marker" size={48} color="#EF4444" />
        </Animated.View>

        {/* Pin Ground Shadow */}
        <Animated.View
          style={[
            tw`w-4 h-1.5 bg-black/35 rounded-full mt-[-6px]`,
            { transform: [{ scale: shadowScale }] },
          ]}
        />
      </View>

      {/* ─── Top Floating Header with Close Button ────────────── */}
      <View
        style={[
          tw`absolute top-12 inset-x-4 flex-row items-center justify-between`,
          { zIndex: 20 },
        ]}
      >
        <TouchableOpacity
          onPress={handleClose}
          style={[
            tw`w-10 h-10 rounded-full bg-white items-center justify-center shadow-md border border-gray-100`,
            cardShadow,
          ]}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="close" size={22} color={colors.text || '#1E293B'} />
        </TouchableOpacity>

        <View
          style={[
            tw`px-4 py-2 bg-white/95 rounded-full shadow-md border border-gray-100 flex-row items-center`,
            cardShadow,
          ]}
        >
          <MaterialCommunityIcons name="map-search-outline" size={18} color={colors.primary} style={tw`mr-1.5`} />
          <Text style={tw`text-xs font-bold text-gray-800`}>
            {t('map.title', 'تحديد عنوان التوصيل')}
          </Text>
        </View>

        {/* Spacer for symmetrical header */}
        <View style={tw`w-10`} />
      </View>

      {/* ─── Floating "My Location" Button ───────────────────── */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={handleLocateMe}
        disabled={isLocating}
        style={[
          tw`absolute bottom-64 end-4 bg-white rounded-full p-3.5 shadow-lg flex-row items-center border border-gray-100`,
          cardShadow,
          { zIndex: 20 },
        ]}
      >
        {isLocating ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <MaterialCommunityIcons
            name="crosshairs-gps"
            size={24}
            color={colors.primary}
          />
        )}
      </TouchableOpacity>

      {/* ─── Bottom Floating Address & Shipping Fee Sheet ────── */}
      <View
        style={[
          tw`absolute bottom-0 inset-x-0 bg-white rounded-t-3xl p-5 border-t border-gray-100`,
          cardShadow,
          { zIndex: 20 },
        ]}
      >
        {/* Drag Handle Indicator */}
        <View style={tw`w-12 h-1.5 bg-gray-200 rounded-full self-center mb-4`} />

        {/* Detected Address Details */}
        <View style={tw`flex-row items-start mb-3`}>
          <View style={tw`p-2.5 rounded-xl bg-orange-50 text-orange-600 mr-3 mt-0.5`}>
            <MaterialCommunityIcons name="map-marker-radius" size={22} color={colors.primary} />
          </View>
          <View style={tw`flex-1`}>
            <View style={tw`flex-row items-center justify-between`}>
              <Text style={tw`text-xs font-bold text-gray-900`}>
                {t('map.deliveryAddressTitle', 'العنوان التقريبي')}
              </Text>
              {isGeocoding && (
                <View style={tw`flex-row items-center`}>
                  <ActivityIndicator size="small" color={colors.primary} style={tw`mr-1`} />
                  <Text style={tw`text-[11px] text-gray-400`}>
                    {t('map.detectingAddress', 'جاري قراءة العنوان...')}
                  </Text>
                </View>
              )}
            </View>

            <Text style={tw`text-xs text-gray-600 mt-1 leading-5`} numberOfLines={2}>
              {addressDetails?.formattedAddress || `${currentCoords.latitude}, ${currentCoords.longitude}`}
            </Text>

            {/* Governorate and City Badges */}
            {(addressDetails?.governorate || addressDetails?.city) && (
              <View style={tw`flex-row items-center flex-wrap gap-1.5 mt-2`}>
                {addressDetails.governorate ? (
                  <View style={tw`px-2.5 py-0.5 rounded-md bg-gray-100`}>
                    <Text style={tw`text-[10px] font-bold text-gray-700`}>
                      {addressDetails.governorate}
                    </Text>
                  </View>
                ) : null}
                {addressDetails.city ? (
                  <View style={tw`px-2.5 py-0.5 rounded-md bg-gray-100`}>
                    <Text style={tw`text-[10px] font-bold text-gray-700`}>
                      {addressDetails.city}
                    </Text>
                  </View>
                ) : null}
                {addressDetails.area ? (
                  <View style={tw`px-2.5 py-0.5 rounded-md bg-gray-100`}>
                    <Text style={tw`text-[10px] font-bold text-gray-700`}>
                      {addressDetails.area}
                    </Text>
                  </View>
                ) : null}
              </View>
            )}
          </View>
        </View>

        {/* Live Shipping Fee Banner */}
        <View style={tw`rounded-2xl p-3.5 bg-emerald-50 border border-emerald-200/80 flex-row items-center justify-between mb-4`}>
          <View style={tw`flex-row items-center flex-1 mr-2`}>
            <View style={tw`w-9 h-9 rounded-xl bg-emerald-600 items-center justify-center mr-2.5 shadow-sm`}>
              {isCalculatingShipping ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <MaterialCommunityIcons name="truck-delivery-outline" size={20} color="#FFFFFF" />
              )}
            </View>
            <View>
              <Text style={tw`text-[11px] font-semibold text-emerald-900`}>
                {t('map.calculatedShippingFee', 'تكلفة التوصيل المباشرة')}
              </Text>
              <Text style={tw`text-sm font-extrabold text-emerald-700`}>
                {isCalculatingShipping ? (
                  t('map.calculating', 'جاري الحساب...')
                ) : shippingResult ? (
                  `${shippingResult.totalShippingCost} ${t('currency', 'ج.م')}`
                ) : (
                  '--'
                )}
              </Text>
            </View>
          </View>

          {shippingResult && !isCalculatingShipping && (
            <View style={tw`items-end`}>
              <View style={tw`flex-row items-center mb-0.5`}>
                <MaterialCommunityIcons name="navigation-variant-outline" size={14} color="#047857" style={tw`mr-1`} />
                <Text style={tw`text-xs font-bold text-emerald-900`}>
                  {shippingResult.distanceKm} {t('map.km', 'كم')}
                </Text>
              </View>
              {shippingResult.estimatedTime ? (
                <Text style={tw`text-[10px] text-emerald-700`}>
                  {shippingResult.estimatedTime}
                </Text>
              ) : null}
            </View>
          )}

          {shippingError && !isCalculatingShipping && (
            <Text style={tw`text-[11px] text-rose-600 font-medium flex-1`} numberOfLines={1}>
              {shippingError}
            </Text>
          )}
        </View>

        {/* Confirm Location Button */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleConfirm}
          disabled={isGeocoding}
          style={tw`w-full py-3.5 bg-orange-500 rounded-xl items-center justify-center shadow-md flex-row`}
        >
          <MaterialCommunityIcons name="check-circle-outline" size={20} color="#FFFFFF" style={tw`mr-2`} />
          <Text style={tw`text-white font-bold text-sm`}>
            {t('map.confirmLocation', 'تأكيد هذا العنوان')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
