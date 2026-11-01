import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import { useTranslation } from 'react-i18next';
import {
  MapPin,
  Crosshair,
  Loader2,
  Truck,
  Clock,
  Navigation,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { calculateShippingFee } from '../api/shippingApi';

// Default central warehouse / city center: Cairo, Egypt
const DEFAULT_CENTER = {
  lat: 30.0444,
  lng: 31.2357,
};

const DEFAULT_ZOOM = 15;
const MAP_LIBRARIES = ['places', 'geometry'];

const MAP_CONTAINER_STYLE = {
  width: '100%',
  height: '100%',
};

// Map options removing clutter to give a clean Uber/Talabat feel
const MAP_OPTIONS = {
  disableDefaultUI: true,
  zoomControl: true,
  fullscreenControl: false,
  mapTypeControl: false,
  streetViewControl: false,
  gestureHandling: 'greedy',
  clickableIcons: false,
};

/**
 * Robust parser for Google Geocoding response in Arabic/English.
 * Cleans typical administrative prefixes like "محافظة القاهرة" -> "القاهرة".
 */
export function parseGeocodeAddress(geocodeResult) {
  if (!geocodeResult || !geocodeResult.address_components) {
    return {
      formattedAddress: geocodeResult?.formatted_address || '',
      governorate: '',
      city: '',
      area: '',
      street: '',
      buildingNumber: '',
    };
  }

  const components = geocodeResult.address_components;

  const getComponent = (types) => {
    const found = components.find((c) =>
      types.some((t) => c.types.includes(t))
    );
    return found ? found.long_name : '';
  };

  const governorate = getComponent(['administrative_area_level_1'])
    .replace(/^محافظة\s+/i, '')
    .replace(/\s+Governorate$/i, '')
    .trim();

  const city =
    getComponent(['locality', 'administrative_area_level_2', 'sublocality_level_1'])
      .replace(/^مركز\s+/i, '')
      .replace(/^مدينة\s+/i, '')
      .trim() || governorate;

  const area = getComponent(['sublocality_level_1', 'sublocality', 'neighborhood']);
  const street = getComponent(['route']);
  const buildingNumber = getComponent(['street_number']);
  const formattedAddress = geocodeResult.formatted_address || '';

  return {
    governorate,
    city,
    area,
    street,
    buildingNumber,
    formattedAddress,
  };
}

/**
 * Reusable Google Maps Address & Location Picker Component
 *
 * Props:
 * - apiKey: Google Maps JavaScript API key (defaults to VITE_GOOGLE_MAPS_API_KEY)
 * - initialLat: Initial center latitude (optional)
 * - initialLng: Initial center longitude (optional)
 * - height: Height of the map component (e.g. "420px")
 * - onAddressSelect: Callback returning parsed address and shipping details
 * - className: Custom container classes
 */
export default function MapAddressPicker({
  apiKey,
  initialLat,
  initialLng,
  height = '420px',
  onAddressSelect,
  className = '',
}) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const mapApiKey = apiKey || import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

  // Load Google Maps JavaScript API
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: mapApiKey,
    language: isRTL ? 'ar' : 'en',
    libraries: MAP_LIBRARIES,
  });

  const mapRef = useRef(null);
  const geocoderRef = useRef(null);
  const idleTimerRef = useRef(null);
  const lastGeocodedCoordsRef = useRef({ lat: 0, lng: 0 });

  // Map state
  const [center, setCenter] = useState({
    lat: typeof initialLat === 'number' ? initialLat : DEFAULT_CENTER.lat,
    lng: typeof initialLng === 'number' ? initialLng : DEFAULT_CENTER.lng,
  });

  const [isDragging, setIsDragging] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState(null);

  // Address geocoding state
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [currentAddress, setCurrentAddress] = useState(null);

  // Live Shipping fee state
  const [isCalculatingShipping, setIsCalculatingShipping] = useState(false);
  const [shippingResult, setShippingResult] = useState(null);
  const [shippingError, setShippingError] = useState(null);

  // Initialize Geocoder once loaded
  useEffect(() => {
    if (isLoaded && window.google?.maps?.Geocoder && !geocoderRef.current) {
      geocoderRef.current = new window.google.maps.Geocoder();
    }
  }, [isLoaded]);

  // Clean up idle timer on unmount
  useEffect(() => {
    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
    };
  }, []);

  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
  }, []);

  const onMapUnmount = useCallback(() => {
    mapRef.current = null;
  }, []);

  /**
   * Performs Reverse Geocoding with language=ar/en
   */
  const performReverseGeocode = useCallback(
    async (lat, lng) => {
      if (!geocoderRef.current && window.google?.maps?.Geocoder) {
        geocoderRef.current = new window.google.maps.Geocoder();
      }

      if (!geocoderRef.current) return;

      setIsGeocoding(true);

      try {
        const response = await new Promise((resolve, reject) => {
          geocoderRef.current.geocode(
            {
              location: { lat, lng },
              language: isRTL ? 'ar' : 'en',
            },
            (results, status) => {
              if (status === 'OK' && results && results.length > 0) {
                resolve(results[0]);
              } else {
                reject(new Error(`Geocoding status: ${status}`));
              }
            }
          );
        });

        const parsed = parseGeocodeAddress(response);
        setCurrentAddress(parsed);

        return parsed;
      } catch (err) {
        console.warn('Reverse geocoding error:', err.message);
        const fallback = {
          formattedAddress: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
          governorate: '',
          city: '',
          area: '',
          street: '',
          buildingNumber: '',
        };
        setCurrentAddress(fallback);
        return fallback;
      } finally {
        setIsGeocoding(false);
      }
    },
    [isRTL]
  );

  /**
   * Fetches real-time shipping calculation from backend
   */
  const performShippingCalculation = useCallback(
    async (lat, lng, addressInfo) => {
      setIsCalculatingShipping(true);
      setShippingError(null);

      try {
        const response = await calculateShippingFee({
          latitude: lat,
          longitude: lng,
        });

        const calculation = response.data;
        setShippingResult(calculation);

        // Notify parent checkout form with consolidated payload
        if (onAddressSelect) {
          onAddressSelect({
            latitude: lat,
            longitude: lng,
            formattedAddress: addressInfo?.formattedAddress || '',
            governorate: addressInfo?.governorate || '',
            city: addressInfo?.city || '',
            area: addressInfo?.area || '',
            street: addressInfo?.street || '',
            buildingNumber: addressInfo?.buildingNumber || '',
            googleMapsLink: `https://www.google.com/maps?q=${lat},${lng}`,
            shippingFee: calculation.totalShippingCost,
            distanceKm: calculation.distanceKm,
            estimatedTime: calculation.estimatedTime,
            isRoadDistance: calculation.isRoadDistance,
            source: calculation.source,
          });
        }
      } catch (err) {
        console.error('Shipping calculation error:', err);
        setShippingError(
          err.response?.data?.message ||
            t('map.shippingCalculationFailed', 'تعذر حساب تكلفة الشحن لهذا الموقع')
        );

        if (onAddressSelect) {
          onAddressSelect({
            latitude: lat,
            longitude: lng,
            formattedAddress: addressInfo?.formattedAddress || '',
            governorate: addressInfo?.governorate || '',
            city: addressInfo?.city || '',
            area: addressInfo?.area || '',
            street: addressInfo?.street || '',
            buildingNumber: addressInfo?.buildingNumber || '',
            googleMapsLink: `https://www.google.com/maps?q=${lat},${lng}`,
            shippingFee: null,
            distanceKm: null,
            estimatedTime: null,
            isRoadDistance: false,
            source: 'Error',
          });
        }
      } finally {
        setIsCalculatingShipping(false);
      }
    },
    [onAddressSelect, t]
  );

  /**
   * COST OPTIMIZATION: Trigger reverse geocode & fee calculation ONLY on idle with 500ms debounce.
   * Also skips duplicate API calls if the center barely changed (< 5 meters).
   */
  const handleMapIdle = useCallback(() => {
    setIsDragging(false);

    if (!mapRef.current) return;

    const newCenter = mapRef.current.getCenter();
    if (!newCenter) return;

    const lat = Number(newCenter.lat().toFixed(6));
    const lng = Number(newCenter.lng().toFixed(6));

    // Distance threshold: check if movement is less than ~5 meters (~0.00005 degrees)
    const latDiff = Math.abs(lat - lastGeocodedCoordsRef.current.lat);
    const lngDiff = Math.abs(lng - lastGeocodedCoordsRef.current.lng);

    if (latDiff < 0.00005 && lngDiff < 0.00005 && currentAddress) {
      return; // Skip expensive API calls if coordinates barely moved
    }

    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }

    // 500ms debounce before firing Google Geocoding & Backend Shipping Calculation
    idleTimerRef.current = setTimeout(async () => {
      lastGeocodedCoordsRef.current = { lat, lng };
      setCenter({ lat, lng });

      const addressInfo = await performReverseGeocode(lat, lng);
      await performShippingCalculation(lat, lng, addressInfo);
    }, 500);
  }, [performReverseGeocode, performShippingCalculation, currentAddress]);

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }
  }, []);

  /**
   * "Locate Me" (حدد موقعي الحالي) Button Handler
   */
  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError(
        t('map.geolocationNotSupported', 'خاصية تحديد الموقع غير مدعومة في متصفحك')
      );
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
        const { latitude, longitude } = position.coords;
        const newCoords = { lat: latitude, lng: longitude };

        setCenter(newCoords);

        if (mapRef.current) {
          mapRef.current.panTo(newCoords);
          mapRef.current.setZoom(16);
        }
      },
      (error) => {
        setIsLocating(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError(
              t(
                'map.permissionDenied',
                'يرجى السماح بالوصول إلى الموقع الجغرافي لتحديد مكانك تلقائياً'
              )
            );
            break;
          case error.POSITION_UNAVAILABLE:
            setLocationError(
              t('map.positionUnavailable', 'معلومات الموقع غير متوفرة حالياً')
            );
            break;
          case error.TIMEOUT:
            setLocationError(
              t('map.timeout', 'استغرق تحديد الموقع وقتاً طويلاً. يرجى المحاولة ثانية')
            );
            break;
          default:
            setLocationError(
              t('map.unknownError', 'حدث خطأ أثناء محاولة تحديد موقعك')
            );
            break;
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, [t]);

  // Fallback UI when Google Maps API key is missing or failed to load
  if (!mapApiKey || loadError) {
    return (
      <div
        className={`w-full rounded-2xl border border-amber-200 bg-amber-50/70 p-6 text-start ${className}`}
        style={{ minHeight: height }}
      >
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-amber-100 text-amber-700 shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="space-y-2 flex-1">
            <h4 className="text-base font-bold text-amber-900">
              {t('map.apiKeyRequiredTitle', 'تفعيل خريطة تحديد العنوان')}
            </h4>
            <p className="text-sm text-amber-800 leading-relaxed">
              {loadError
                ? t(
                    'map.loadErrorMessage',
                    'تعذر تحميل خرائط Google. يرجى التحقق من اتصال الإنترنت أو مفتاح API.'
                  )
                : t(
                    'map.missingApiKeyMessage',
                    'يرجى ضبط مفتاح VITE_GOOGLE_MAPS_API_KEY في ملف البيئة لتفعيل الخريطة التفاعلية.'
                  )}
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => performShippingCalculation(center.lat, center.lng, null)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
              >
                <Truck className="w-4 h-4" />
                <span>{t('map.testWithDefaultCoords', 'حساب الشحن للموقع الافتراضي (القاهرة)')}</span>
              </button>
            </div>

            {shippingResult && (
              <div className="mt-3 p-3 bg-white rounded-xl border border-amber-200 text-xs text-gray-700 space-y-1">
                <div className="font-semibold text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {t('map.shippingCostLive', 'تكلفة الشحن')}: {shippingResult.totalShippingCost} {t('currency', 'ج.م')}
                  </span>
                </div>
                <div>{t('map.distance', 'المسافة')}: {shippingResult.distanceKm} {t('map.km', 'كم')}</div>
                <div>{t('map.estTime', 'الوقت التقديري')}: {shippingResult.estimatedTime}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative w-full rounded-2xl overflow-hidden border border-gray-200 shadow-sm bg-gray-100 flex flex-col ${className}`}>
      {/* ─── Map Viewport with Fixed Center Pin ──────────────── */}
      <div className="relative w-full" style={{ height }}>
        {!isLoaded ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 text-gray-500 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
            <span className="text-xs font-medium">{t('map.loadingMap', 'جاري تحميل الخريطة...')}</span>
          </div>
        ) : (
          <>
            <GoogleMap
              mapContainerStyle={MAP_CONTAINER_STYLE}
              center={center}
              zoom={DEFAULT_ZOOM}
              options={MAP_OPTIONS}
              onLoad={onMapLoad}
              onUnmount={onMapUnmount}
              onDragStart={handleDragStart}
              onIdle={handleMapIdle}
            />

            {/* ─── Uber/Talabat Fixed Center Pin Overlay ────── */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-10">
              <div
                className={`relative flex flex-col items-center transition-all duration-200 select-none ${
                  isDragging
                    ? '-translate-y-4 scale-110'
                    : '-translate-y-0 scale-100'
                }`}
              >
                {/* Floating pill badge above pin */}
                <div className="mb-1.5 px-3 py-1 bg-gray-900/90 text-white text-[11px] font-semibold rounded-full shadow-lg backdrop-blur-xs flex items-center gap-1.5 whitespace-nowrap animate-fade-in border border-white/10">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>
                    {isDragging
                      ? t('map.releaseToPick', 'اترك لتحديد الموقع')
                      : t('map.deliveryTarget', 'موقع التوصيل')}
                  </span>
                </div>

                {/* Custom Uber-style Center Marker SVG */}
                <div className="relative flex flex-col items-center filter drop-shadow-md">
                  <div className="w-9 h-9 rounded-full bg-red-600 border-2 border-white flex items-center justify-center shadow-lg text-white">
                    <MapPin className="w-5 h-5 fill-white stroke-red-600 stroke-1" />
                  </div>
                  {/* Pin Point Pointer */}
                  <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-red-600 -mt-[1px]" />
                </div>

                {/* Ground Shadow underneath the Pin Tip */}
                <div
                  className={`w-4 h-1.5 bg-black/40 rounded-full blur-[1px] mt-1 transition-all duration-200 ${
                    isDragging ? 'scale-50 opacity-20' : 'scale-100 opacity-80'
                  }`}
                />
              </div>
            </div>

            {/* ─── Floating "Locate Me" Button ─────────────── */}
            <div className="absolute bottom-4 end-4 z-20">
              <button
                type="button"
                onClick={handleLocateMe}
                disabled={isLocating}
                aria-label={t('map.locateMe', 'حدد موقعي الحالي')}
                title={t('map.locateMe', 'حدد موقعي الحالي')}
                className="flex items-center gap-2 px-3.5 py-2.5 bg-white/95 hover:bg-white text-gray-800 text-xs font-bold rounded-xl shadow-md border border-gray-200 backdrop-blur-xs active:scale-95 transition-all hover:shadow-lg disabled:opacity-70 cursor-pointer"
              >
                {isLocating ? (
                  <Loader2 className="w-4 h-4 animate-spin text-primary-600" />
                ) : (
                  <Crosshair className="w-4 h-4 text-primary-600" />
                )}
                <span className="hidden sm:inline">
                  {isLocating
                    ? t('map.locating', 'جاري تحديد موقعك...')
                    : t('map.locateMe', 'حدد موقعي الحالي')}
                </span>
              </button>
            </div>

            {/* ─── Instruction Pill (Top) ──────────────────── */}
            <div className="absolute top-3 inset-x-0 flex justify-center pointer-events-none z-20">
              <div className="px-3.5 py-1.5 bg-white/90 text-gray-700 text-xs font-medium rounded-full shadow-sm border border-gray-200 backdrop-blur-xs flex items-center gap-1.5 pointer-events-auto">
                <Navigation className="w-3.5 h-3.5 text-primary-600 shrink-0" />
                <span>
                  {t(
                    'map.panInstruction',
                    'حرّك الخريطة وضع العلامة عند مكان التوصيل'
                  )}
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ─── Geolocation Error Toast ─────────────────────────── */}
      {locationError && (
        <div className="px-4 py-2 bg-rose-50 border-t border-rose-200 text-rose-700 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{locationError}</span>
          </div>
          <button
            type="button"
            onClick={() => setLocationError(null)}
            className="text-rose-500 hover:text-rose-700 text-xs font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* ─── Bottom Live Address & Shipping Cost Card ────────── */}
      <div className="p-4 bg-white border-t border-gray-100 flex flex-col gap-3">
        {/* Row 1: Detected Address Text */}
        <div className="flex items-start gap-2.5">
          <div className="p-2 rounded-lg bg-primary-50 text-primary-600 shrink-0 mt-0.5">
            <MapPin className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-900">
                {t('map.deliveryAddressTitle', 'العنوان المختار')}
              </span>
              {isGeocoding && (
                <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>{t('map.detectingAddress', 'جاري قراءة العنوان...')}</span>
                </span>
              )}
            </div>
            <p className="text-xs text-gray-600 truncate mt-0.5">
              {currentAddress?.formattedAddress ||
                t('map.panToSelect', 'حرّك الخريطة لتحديث العنوان تلقائياً')}
            </p>
            {(currentAddress?.governorate || currentAddress?.city) && (
              <div className="flex items-center gap-2 mt-1">
                {currentAddress.governorate && (
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-md text-[10px] font-semibold">
                    {currentAddress.governorate}
                  </span>
                )}
                {currentAddress.city && (
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-md text-[10px] font-semibold">
                    {currentAddress.city}
                  </span>
                )}
                {currentAddress.area && (
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-md text-[10px] font-semibold">
                    {currentAddress.area}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Live Shipping Calculation Banner */}
        <div className="rounded-xl p-3 bg-gradient-to-r from-emerald-50/80 via-teal-50/60 to-emerald-50/80 border border-emerald-200/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              {isCalculatingShipping ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Truck className="w-4 h-4" />
              )}
            </div>
            <div>
              <div className="text-[11px] font-semibold text-emerald-900">
                {t('map.calculatedShippingFee', 'تكلفة التوصيل المباشرة')}
              </div>
              <div className="text-sm font-extrabold text-emerald-700 flex items-baseline gap-1">
                {isCalculatingShipping ? (
                  <span className="text-xs font-normal text-emerald-600 animate-pulse">
                    {t('map.calculating', 'جاري الحساب...')}
                  </span>
                ) : shippingResult ? (
                  <>
                    <span>{shippingResult.totalShippingCost}</span>
                    <span className="text-xs font-normal">{t('currency', 'ج.م')}</span>
                  </>
                ) : (
                  <span className="text-xs font-normal text-gray-500">--</span>
                )}
              </div>
            </div>
          </div>

          {/* Distance and Estimated Delivery Time */}
          {shippingResult && !isCalculatingShipping && (
            <div className="flex items-center gap-4 text-xs text-gray-700">
              <div className="flex items-center gap-1.5" title={t('map.distance', 'المسافة')}>
                <Navigation className="w-3.5 h-3.5 text-gray-500" />
                <span className="font-semibold text-gray-900">
                  {shippingResult.distanceKm}
                </span>
                <span className="text-gray-500">{t('map.km', 'كم')}</span>
              </div>

              {shippingResult.estimatedTime && (
                <div
                  className="flex items-center gap-1.5"
                  title={t('map.estimatedDuration', 'الوقت التقديري')}
                >
                  <Clock className="w-3.5 h-3.5 text-gray-500" />
                  <span className="font-semibold text-gray-900">
                    {shippingResult.estimatedTime}
                  </span>
                </div>
              )}

              <span
                className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                  shippingResult.isRoadDistance
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-amber-100 text-amber-700'
                }`}
              >
                {shippingResult.isRoadDistance
                  ? t('map.roadDistance', 'مسار طريق معتمد')
                  : t('map.straightLine', 'تقدير هوائي')}
              </span>
            </div>
          )}

          {shippingError && !isCalculatingShipping && (
            <div className="text-xs text-rose-600 font-medium">
              {shippingError}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
