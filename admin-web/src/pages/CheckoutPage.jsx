import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  MapPin,
  Truck,
  CheckCircle,
  Building,
  Phone,
  User,
  ShieldCheck,
  AlertCircle,
  Store,
  ChevronDown,
  PlusCircle,
  ArrowRight,
  ArrowLeft,
  Package,
  Tag,
  Wallet,
  X,
  Sparkles,
  Banknote,
  FileText,
  Clock,
  Check,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { getMyAddresses, createMyAddress, getMyWallet } from '../api/usersApi';
import { getDeliveryCities, getPickupPoints, calculateDeliveryQuote } from '../api/deliveryApi';
import { createOrder } from '../api/ordersApi';
import { validateCoupon } from '../api/couponsApi';
import { formatCurrency } from '../utils/currency';
import { isValidEgyptianPhone, normalizeEgyptianPhone } from '../utils/egyptianPhone';
import { getImageUrl, handleImageError } from '../utils/imageUrl';

export default function CheckoutPage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const location = useLocation();
  const navigate = useNavigate();

  const { isAuthenticated, userName } = useAuth();
  const { itemsList, removeItems } = useCart();

  // Buy Now single item override or cart items
  const buyNowItem = location.state?.buyNowItem;
  const isBuyNow = Boolean(buyNowItem);

  const checkoutItems = useMemo(() => {
    if (buyNowItem) {
      return [
        {
          productId: buyNowItem.product.id,
          variantId: buyNowItem.selectedVariant?.id || null,
          quantity: buyNowItem.quantity,
          product: buyNowItem.product,
        },
      ];
    }
    return itemsList;
  }, [buyNowItem, itemsList]);

  // Delivery Method: 'Courier' (Home Delivery) or 'Pickup' (Bosta PVZ Branch)
  const [deliveryMethod, setDeliveryMethod] = useState('Courier');

  // Customer & Address state
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [recipientName, setRecipientName] = useState(userName || '');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [governorate, setGovernorate] = useState(isRTL ? 'القاهرة' : 'Cairo');
  const [city, setCity] = useState(isRTL ? 'مدينة نصر' : 'Nasr City');
  const [area, setArea] = useState(isRTL ? 'الحي السابع' : '7th District');
  const [streetBuilding, setStreetBuilding] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [saveToAddressBook, setSaveToAddressBook] = useState(false);

  // Pickup PVZ state
  const [availableCities, setAvailableCities] = useState([]);
  const [pickupCity, setPickupCity] = useState('القاهرة');
  const [pickupPoints, setPickupPoints] = useState([]);
  const [selectedPickupPointId, setSelectedPickupPointId] = useState('');

  // Delivery Quote State
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteData, setQuoteData] = useState(null);

  // Coupon Engine State
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [couponError, setCouponError] = useState(null);

  // Buyer Wallet (Store Credit) State
  const [walletBalance, setWalletBalance] = useState(0);
  const [useWalletBalance, setUseWalletBalance] = useState(false);

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [createdOrder, setCreatedOrder] = useState(null);

  // Stable Idempotency Key Ref (F-024)
  const generateIdempotencyKey = useCallback(() => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `idemp_web_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }, []);
  const idempotencyKeyRef = useRef(generateIdempotencyKey());

  // Group items by Seller (Multi-Vendor Shipment Parcels)
  const groupedBySeller = useMemo(() => {
    const map = {};
    checkoutItems.forEach((item) => {
      const sellerId = item.product?.sellerId || 'general';
      const sellerName = item.product?.sellerName || (isRTL ? 'تاجر سوق مصر' : 'Marketplace Merchant');
      const dispatchCity = item.product?.dispatchCity || (isRTL ? 'القاهرة' : 'Cairo');

      if (!map[sellerId]) {
        map[sellerId] = {
          sellerId,
          sellerName,
          dispatchCity,
          items: [],
        };
      }
      map[sellerId].items.push(item);
    });
    return Object.values(map);
  }, [checkoutItems, isRTL]);

  // Items Subtotal
  const itemsSubtotal = useMemo(() => {
    return checkoutItems.reduce((acc, it) => {
      const price = Number(it?.product?.price) || 0;
      const qty = Number(it?.quantity) || 1;
      return acc + price * qty;
    }, 0);
  }, [checkoutItems]);

  // Load Saved Addresses and Wallet Balance (if logged in)
  useEffect(() => {
    if (isAuthenticated) {
      getMyAddresses()
        .then((res) => {
          const list = Array.isArray(res.data) ? res.data : [];
          setSavedAddresses(list);
          const defaultAddr = list.find((a) => a.isDefault) || list[0];
          if (defaultAddr) {
            handleSelectSavedAddress(defaultAddr);
          }
        })
        .catch((err) => console.warn('Failed to load saved addresses', err));

      getMyWallet()
        .then((res) => {
          const bal = Number(res?.data?.balance) || 0;
          setWalletBalance(bal);
        })
        .catch((err) => console.warn('Failed to load wallet balance', err));
    }
  }, [isAuthenticated]);

  // Load Available Delivery Cities
  useEffect(() => {
    getDeliveryCities()
      .then((res) => {
        if (Array.isArray(res.data)) {
          setAvailableCities(res.data);
        }
      })
      .catch((err) => console.warn('Failed to load cities', err));
  }, []);

  // Load Pickup Points when pickupCity changes
  const loadPickupPoints = useCallback((targetCity) => {
    getPickupPoints(targetCity)
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        setPickupPoints(list);
        if (list.length > 0) {
          setSelectedPickupPointId(list[0].id);
        } else {
          setSelectedPickupPointId('');
        }
      })
      .catch((err) => console.warn('Failed to load pickup points', err));
  }, []);

  useEffect(() => {
    if (deliveryMethod === 'Pickup') {
      loadPickupPoints(pickupCity);
    }
  }, [deliveryMethod, pickupCity, loadPickupPoints]);

  // Fetch Delivery Quote whenever destination or items change
  const fetchQuote = useCallback(async () => {
    if (checkoutItems.length === 0) return;

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

  const handleSelectSavedAddress = (addr) => {
    setSelectedAddressId(addr.id);
    setRecipientName(addr.recipientName || '');
    setRecipientPhone(addr.recipientPhone || '');
    setGovernorate(addr.governorate || '');
    setCity(addr.city || '');
    setArea(addr.area || '');
    setStreetBuilding(addr.streetBuilding || '');
  };

  // Coupon Validation Handler
  const handleApplyCoupon = async (e) => {
    e.preventDefault();
    if (validatingCoupon || !couponCodeInput.trim()) return;

    setCouponError(null);
    setValidatingCoupon(true);

    try {
      const payload = {
        code: couponCodeInput.trim().toUpperCase(),
        items: checkoutItems.map((it) => ({
          productId: it.productId,
          variantId: it.variantId || null,
          quantity: it.quantity,
        })),
      };

      const res = await validateCoupon(payload);
      if (res?.data?.isValid) {
        setAppliedCoupon({
          code: couponCodeInput.trim().toUpperCase(),
          discountAmount: Number(res.data.discountAmount) || 0,
          newSubtotal: Number(res.data.newSubtotal) || 0,
        });
        setCouponCodeInput('');
      } else {
        setCouponError(res?.data?.message || (isRTL ? 'كود الخصم غير صالح أو لا ينطبق على هذه السلة' : 'Invalid coupon code'));
      }
    } catch (err) {
      console.error('Coupon validation error:', err);
      setCouponError(
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        (isRTL ? 'تعذر التحقق من كود الخصم' : 'Failed to validate coupon')
      );
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponError(null);
  };

  // Financial Calculations
  const deliveryCostTotal = Number(quoteData?.totalDeliveryCost) || (deliveryMethod === 'Pickup' ? 35 : 50);
  const couponDiscount = appliedCoupon?.discountAmount || 0;
  const subtotalAfterCoupon = Math.max(0, itemsSubtotal - couponDiscount);
  const preWalletTotal = subtotalAfterCoupon + deliveryCostTotal;

  const walletAmountUsed = useWalletBalance
    ? Math.min(walletBalance, preWalletTotal)
    : 0;

  const grandTotal = Math.max(0, preWalletTotal - walletAmountUsed);

  // Confirm and Submit Order (Cash on Delivery)
  const handleConfirmOrder = async (e) => {
    e.preventDefault();
    setSubmitError(null);

    if (checkoutItems.length === 0 || submitting) return;

    if (!recipientName.trim()) {
      setSubmitError(t('common.fillAllFields'));
      return;
    }

    if (!isValidEgyptianPhone(recipientPhone)) {
      setSubmitError(t('common.invalidPhone'));
      return;
    }

    if (deliveryMethod === 'Courier') {
      if (!governorate.trim() || !city.trim() || !area.trim() || !streetBuilding.trim()) {
        setSubmitError(isRTL ? 'يرجى استكمال بيانات العنوان (المحافظة، المدينة، الحي، والشارع/العمارة)' : 'Please complete full delivery address fields');
        return;
      }
    } else {
      if (!selectedPickupPointId) {
        setSubmitError(isRTL ? 'يرجى اختيار فرع أو نقطة استلام بوسطة' : 'Please select a Bosta pickup branch');
        return;
      }
    }

    setSubmitting(true);

    try {
      // Save address if requested and user is authenticated
      if (isAuthenticated && saveToAddressBook && deliveryMethod === 'Courier' && !selectedAddressId) {
        try {
          await createMyAddress({
            label: isRTL ? 'عنوان التوصيل' : 'Delivery Address',
            recipientName: recipientName.trim(),
            recipientPhone: normalizeEgyptianPhone(recipientPhone),
            governorate: governorate.trim(),
            city: city.trim(),
            area: area.trim(),
            streetBuilding: streetBuilding.trim(),
            isDefault: savedAddresses.length === 0,
          });
        } catch (e) {
          console.warn('Address auto-save skipped:', e);
        }
      }

      const fullStreetBuilding = deliveryNotes.trim()
        ? `${streetBuilding.trim()} (${deliveryNotes.trim()})`
        : streetBuilding.trim();

      const payload = {
        items: checkoutItems.map((it) => ({
          productId: it.productId,
          variantId: it.variantId || null,
          quantity: it.quantity,
        })),
        deliveryMethod,
        pickupPointId: deliveryMethod === 'Pickup' ? selectedPickupPointId : null,
        recipientName: recipientName.trim(),
        recipientPhone: normalizeEgyptianPhone(recipientPhone),
        governorate: deliveryMethod === 'Courier' ? governorate.trim() : pickupCity,
        city: deliveryMethod === 'Courier' ? city.trim() : pickupCity,
        area: deliveryMethod === 'Courier' ? area.trim() : (isRTL ? 'نقطة استلام بوسطة' : 'Bosta Pickup Point'),
        streetBuilding: deliveryMethod === 'Courier' ? fullStreetBuilding : (isRTL ? 'استلام من الفرع' : 'Branch Pickup'),
        addressLine: deliveryNotes.trim() ? deliveryNotes.trim() : null,
        paymentMethod: 'OnReceipt',
        couponCode: appliedCoupon?.code || null,
        useWalletBalance: useWalletBalance,
        idempotencyKey: idempotencyKeyRef.current,
      };

      const res = await createOrder(payload, idempotencyKeyRef.current);
      setCreatedOrder(res.data);
      idempotencyKeyRef.current = generateIdempotencyKey();

      // Clean up ordered items from cart
      if (!isBuyNow) {
        removeItems(checkoutItems.map((it) => it.productId));
      }
    } catch (err) {
      console.error('Order creation failed', err);
      const serverMsg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        t('common.error');
      setSubmitError(serverMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // Order Confirmed View
  if (createdOrder) {
    return (
      <div className="max-w-3xl mx-auto my-12 bg-white rounded-3xl p-6 sm:p-10 border border-[#ECE9E6] shadow-xl text-center space-y-6">
        <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto border border-emerald-200">
          <CheckCircle className="w-10 h-10 stroke-[2.5]" />
        </div>

        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
            <Check className="w-3.5 h-3.5" />
            <span>{isRTL ? 'تم تسجيل وتأكيد طلبك بنجاح' : 'Order Confirmed'}</span>
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-[#1F2329]">
            {t('checkout.orderSuccessTitle')}
          </h1>
          <p className="text-sm text-[#595F69] max-w-md mx-auto leading-relaxed">
            {isRTL
              ? `رقم الطلب الخاص بك هو #${createdOrder.id}. يرجى تجهيز المبلغ المطلوب نقداً عند استلام ومعاينة الشحنة.`
              : `Your Order ID is #${createdOrder.id}. Please have the exact cash amount ready upon delivery inspection.`}
          </p>
        </div>

        {/* Financial Breakdown Summary */}
        <div className="bg-[#FAF8F5] rounded-2xl p-5 border border-[#ECE9E6] text-start space-y-2.5 text-xs">
          <div className="flex justify-between text-[#595F69]">
            <span>{isRTL ? 'إجمالي المنتجات:' : 'Items Subtotal:'}</span>
            <span className="font-bold text-[#1F2329]">{formatCurrency(createdOrder.itemsSubtotal || itemsSubtotal)}</span>
          </div>

          {createdOrder.discountAmount > 0 && (
            <div className="flex justify-between text-emerald-700 font-bold">
              <span>{isRTL ? `خصم الكوبون (${createdOrder.couponCode || ''}):` : `Coupon Discount (${createdOrder.couponCode || ''}):`}</span>
              <span>-{formatCurrency(createdOrder.discountAmount)}</span>
            </div>
          )}

          <div className="flex justify-between text-[#595F69]">
            <span>{isRTL ? 'مصاريف الشحن والتوصيل:' : 'Delivery Fee:'}</span>
            <span className="font-bold text-[#1F2329]">{formatCurrency(createdOrder.deliveryCost || deliveryCostTotal)}</span>
          </div>

          {createdOrder.walletAmountUsed > 0 && (
            <div className="flex justify-between text-blue-700 font-bold">
              <span>{isRTL ? 'الخصم من رصيد المحفظة:' : 'Wallet Store Credit Applied:'}</span>
              <span>-{formatCurrency(createdOrder.walletAmountUsed)}</span>
            </div>
          )}

          <div className="pt-2.5 border-t border-[#ECE9E6] flex justify-between text-sm sm:text-base font-black text-[#1F2329]">
            <span>{isRTL ? 'المبلغ المطلوب سداده نقداً عند الاستلام:' : 'Cash Due Upon Delivery (COD):'}</span>
            <span className="text-[#C8102E] font-black">{formatCurrency(createdOrder.totalAmount)}</span>
          </div>
        </div>

        {/* Multi-Vendor Shipments Breakdown */}
        {createdOrder.shipments && createdOrder.shipments.length > 0 && (
          <div className="bg-[#FAF8F5] rounded-2xl p-5 border border-[#ECE9E6] text-start space-y-3">
            <h3 className="font-bold text-sm text-[#1F2329] flex items-center gap-2">
              <Truck className="w-4 h-4 text-[#D6A33A]" />
              <span>{t('checkout.shipmentsBreakdown')} ({createdOrder.shipments.length}):</span>
            </h3>
            <div className="space-y-2">
              {createdOrder.shipments.map((s) => (
                <div
                  key={s.id}
                  className="bg-white p-3.5 rounded-xl border border-[#ECE9E6] flex flex-wrap items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <span className="font-bold text-[#1F2329]">
                      {isRTL ? `شحنة #${s.id}` : `Shipment #${s.id}`} • {s.sellerName || (isRTL ? 'تاجر سوق مصر' : 'Seller')}
                    </span>
                    <p className="text-[#595F69] text-[11px] mt-0.5">
                      {isRTL ? `تشحن من مستودع: ${s.dispatchCity}` : `From: ${s.dispatchCity}`}
                    </p>
                  </div>
                  <div className="text-end">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-50 text-blue-800 border border-blue-200">
                      {s.status}
                    </span>
                    <p className="text-[11px] text-[#595F69] mt-0.5 font-semibold">
                      {isRTL ? `الشحن: ${formatCurrency(s.shippingFee)}` : `Delivery: ${formatCurrency(s.shippingFee)}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Link
            to="/orders"
            className="flex-1 py-3.5 px-6 bg-[#1F2329] hover:bg-[#14171B] text-white font-bold text-sm rounded-xl transition-colors shadow-md text-center"
          >
            {isRTL ? 'متابعة وتتبع الطلب في صفحة طلباتي' : 'Track Order in My Orders'}
          </Link>
          <Link
            to="/"
            className="flex-1 py-3.5 px-6 bg-[#FAF8F5] hover:bg-slate-100 text-[#1F2329] border border-[#ECE9E6] font-bold text-sm rounded-xl transition-colors text-center"
          >
            {isRTL ? 'العودة للتسوق في المتجر' : 'Continue Shopping'}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 pb-20">
      {/* Title Bar */}
      <div className="pb-2 border-b border-[#ECE9E6]">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FDF2F4] border border-[#F8CAD1] text-[#C8102E] text-xs font-bold mb-1">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>{isRTL ? 'بوابة إتمام الطلب الآمنة' : 'Secure Checkout'}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-[#1F2329] tracking-tight">
          {t('checkout.title')}
        </h1>
        <p className="text-xs text-[#595F69] mt-0.5">
          {isRTL
            ? 'أكمل بيانات التوصيل واختر طريقة الاستلام لتأكيد شحنتك بالدفع عند الاستلام'
            : 'Complete your delivery details to confirm your Cash on Delivery order'}
        </p>
      </div>

      {submitError && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs font-medium flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{submitError}</span>
        </div>
      )}

      <form onSubmit={handleConfirmOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Left Form (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* =========================================================================
              1. DELIVERY METHOD SELECTION
              Courier Home Delivery vs Bosta PVZ Branch Pickup
              ========================================================================= */}
          <div className="bg-white rounded-2xl border border-[#ECE9E6] p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#FAF8F5] border border-[#ECE9E6] flex items-center justify-center text-[#C8102E]">
                <Truck className="w-4 h-4" />
              </div>
              <h2 className="font-extrabold text-sm sm:text-base text-[#1F2329]">
                {t('checkout.deliveryMethod')}
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Home Delivery Card */}
              <label
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3.5 ${
                  deliveryMethod === 'Courier'
                    ? 'border-[#C8102E] bg-[#FDF2F4]/60 ring-2 ring-[#C8102E]/15 shadow-xs'
                    : 'border-[#ECE9E6] bg-white hover:border-slate-300 hover:bg-[#FAF8F5]'
                }`}
              >
                <input
                  type="radio"
                  name="deliveryMethod"
                  value="Courier"
                  checked={deliveryMethod === 'Courier'}
                  onChange={() => setDeliveryMethod('Courier')}
                  className="mt-1 accent-[#C8102E] cursor-pointer"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Truck className={`w-4 h-4 ${deliveryMethod === 'Courier' ? 'text-[#C8102E]' : 'text-slate-400'}`} />
                    <span className="font-bold text-xs sm:text-sm text-[#1F2329]">
                      {t('checkout.courierHomeDelivery')}
                    </span>
                  </div>
                  <span className="text-xs text-[#595F69] block leading-relaxed">
                    {isRTL
                      ? 'توصيل لباب بيتك أو عنوان عملك في محافظتك عبر مندوب بوسطة'
                      : 'Doorstep delivery to your home or workplace via Bosta courier'}
                  </span>
                </div>
              </label>

              {/* Branch Pickup Card */}
              <label
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3.5 ${
                  deliveryMethod === 'Pickup'
                    ? 'border-[#C8102E] bg-[#FDF2F4]/60 ring-2 ring-[#C8102E]/15 shadow-xs'
                    : 'border-[#ECE9E6] bg-white hover:border-slate-300 hover:bg-[#FAF8F5]'
                }`}
              >
                <input
                  type="radio"
                  name="deliveryMethod"
                  value="Pickup"
                  checked={deliveryMethod === 'Pickup'}
                  onChange={() => setDeliveryMethod('Pickup')}
                  className="mt-1 accent-[#C8102E] cursor-pointer"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Building className={`w-4 h-4 ${deliveryMethod === 'Pickup' ? 'text-[#C8102E]' : 'text-slate-400'}`} />
                    <span className="font-bold text-xs sm:text-sm text-[#1F2329]">
                      {t('checkout.pickupBranch')}
                    </span>
                  </div>
                  <span className="text-xs text-[#595F69] block leading-relaxed">
                    {isRTL
                      ? 'استلام ذاتي من أقرب فرع بوسطة (PVZ) بأسعار شحن مخفضة'
                      : 'Pickup yourself from a Bosta branch (PVZ) with discounted shipping'}
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* =========================================================================
              2. CUSTOMER & RECIPIENT INFORMATION
              Consistent input heights, Egyptian phone prefix, standard labels
              ========================================================================= */}
          <div className="bg-white rounded-2xl border border-[#ECE9E6] p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#FAF8F5] border border-[#ECE9E6] flex items-center justify-center text-[#C8102E]">
                <User className="w-4 h-4" />
              </div>
              <h2 className="font-extrabold text-sm sm:text-base text-[#1F2329]">
                {t('checkout.recipientInfo')}
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#1F2329] mb-1.5">
                  {t('checkout.recipientName')}
                  <span className="text-[#C8102E] ms-1">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder={isRTL ? 'الاسم ثلاثي للمستلم' : 'Full Name of Recipient'}
                  className="w-full h-11 sm:h-12 px-4 rounded-xl border border-[#ECE9E6] bg-white text-xs sm:text-sm text-[#1F2329] placeholder:text-slate-400 focus:outline-none focus:border-[#C8102E] focus:ring-2 focus:ring-[#C8102E]/10 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1F2329] mb-1.5">
                  {t('checkout.recipientPhone')}
                  <span className="text-[#C8102E] ms-1">*</span>
                </label>
                <div
                  dir="ltr"
                  className="flex items-center h-11 sm:h-12 rounded-xl border border-[#ECE9E6] bg-white overflow-hidden focus-within:border-[#C8102E] focus-within:ring-2 focus-within:ring-[#C8102E]/10 transition-all"
                >
                  <span className="flex items-center gap-1.5 px-3 h-full bg-[#FAF8F5] border-e border-[#ECE9E6] text-xs font-bold text-[#1F2329] select-none">
                    <span>🇪🇬</span>
                    <span className="font-mono">+20</span>
                  </span>
                  <input
                    type="tel"
                    inputMode="tel"
                    required
                    dir="ltr"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    placeholder="01012345678"
                    className="w-full h-full px-3 text-xs sm:text-sm outline-none font-mono text-left bg-transparent"
                  />
                </div>
                <span className="text-[10px] text-[#595F69] mt-1 block">
                  {isRTL ? 'رقم موبايل مصري صالح للتواصل عند وصول مندوب الشحن' : 'Valid Egyptian mobile number for carrier contact'}
                </span>
              </div>
            </div>
          </div>

          {/* =========================================================================
              3. DELIVERY ADDRESS / PICKUP BRANCH SELECTION
              Structured: Governorate, City, District, Street/Building, Delivery Notes
              ========================================================================= */}
          <div className="bg-white rounded-2xl border border-[#ECE9E6] p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#FAF8F5] border border-[#ECE9E6] flex items-center justify-center text-[#C8102E]">
                <MapPin className="w-4 h-4" />
              </div>
              <h2 className="font-extrabold text-sm sm:text-base text-[#1F2329]">
                {deliveryMethod === 'Courier'
                  ? t('checkout.deliveryAddress')
                  : t('checkout.selectPickupBranch')}
              </h2>
            </div>

            {deliveryMethod === 'Courier' ? (
              <div className="space-y-4">
                {/* Saved Address Book Selector */}
                {savedAddresses.length > 0 && (
                  <div className="space-y-2 pb-2 border-b border-[#ECE9E6]">
                    <label className="block text-xs font-bold text-[#1F2329]">
                      {t('checkout.useSavedAddress')}:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {savedAddresses.map((addr) => (
                        <div
                          key={addr.id}
                          onClick={() => handleSelectSavedAddress(addr)}
                          className={`p-3.5 rounded-xl border cursor-pointer text-xs transition-all ${
                            selectedAddressId === addr.id
                              ? 'border-[#C8102E] bg-[#FDF2F4]/60 shadow-xs ring-1 ring-[#C8102E]'
                              : 'border-[#ECE9E6] hover:border-slate-300 hover:bg-[#FAF8F5]'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[#1F2329]">
                              {addr.label || addr.recipientName}
                            </span>
                            {selectedAddressId === addr.id && (
                              <CheckCircle className="w-4 h-4 text-[#C8102E]" />
                            )}
                          </div>
                          <p className="text-[11px] text-[#595F69] mt-1">
                            {addr.governorate}، {addr.city}، {addr.area}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate mt-0.5">
                            {addr.streetBuilding}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Structured Address Form */}
                <div className="space-y-4">
                  {/* Row 1: Governorate & City */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-[#1F2329] mb-1.5">
                        {isRTL ? 'المحافظة' : 'Governorate'}
                        <span className="text-[#C8102E] ms-1">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={governorate}
                        onChange={(e) => {
                          setGovernorate(e.target.value);
                          setSelectedAddressId(null);
                        }}
                        placeholder={isRTL ? 'مثال: القاهرة' : 'e.g., Cairo'}
                        className="w-full h-11 sm:h-12 px-4 rounded-xl border border-[#ECE9E6] bg-white text-xs sm:text-sm text-[#1F2329] placeholder:text-slate-400 focus:outline-none focus:border-[#C8102E] focus:ring-2 focus:ring-[#C8102E]/10 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#1F2329] mb-1.5">
                        {isRTL ? 'المدينة / المركز' : 'City / District'}
                        <span className="text-[#C8102E] ms-1">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={city}
                        onChange={(e) => {
                          setCity(e.target.value);
                          setSelectedAddressId(null);
                        }}
                        placeholder={isRTL ? 'مثال: مدينة نصر' : 'e.g., Nasr City'}
                        className="w-full h-11 sm:h-12 px-4 rounded-xl border border-[#ECE9E6] bg-white text-xs sm:text-sm text-[#1F2329] placeholder:text-slate-400 focus:outline-none focus:border-[#C8102E] focus:ring-2 focus:ring-[#C8102E]/10 transition-all"
                      />
                    </div>
                  </div>

                  {/* Row 2: District/Area & Street/Building/Apt */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-[#1F2329] mb-1.5">
                        {isRTL ? 'الحي / المنطقة' : 'Area / Neighborhood'}
                        <span className="text-[#C8102E] ms-1">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={area}
                        onChange={(e) => {
                          setArea(e.target.value);
                          setSelectedAddressId(null);
                        }}
                        placeholder={isRTL ? 'مثال: الحي السابع' : 'e.g., 7th District'}
                        className="w-full h-11 sm:h-12 px-4 rounded-xl border border-[#ECE9E6] bg-white text-xs sm:text-sm text-[#1F2329] placeholder:text-slate-400 focus:outline-none focus:border-[#C8102E] focus:ring-2 focus:ring-[#C8102E]/10 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#1F2329] mb-1.5">
                        {isRTL ? 'الشارع ورقم العمارة / الشقة' : 'Street, Building & Apt'}
                        <span className="text-[#C8102E] ms-1">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={streetBuilding}
                        onChange={(e) => {
                          setStreetBuilding(e.target.value);
                          setSelectedAddressId(null);
                        }}
                        placeholder={isRTL ? 'شارع عباس العقاد، عمارة 12، شقة 4' : 'St. 12 Abbas El Akkad, Apt 4'}
                        className="w-full h-11 sm:h-12 px-4 rounded-xl border border-[#ECE9E6] bg-white text-xs sm:text-sm text-[#1F2329] placeholder:text-slate-400 focus:outline-none focus:border-[#C8102E] focus:ring-2 focus:ring-[#C8102E]/10 transition-all"
                      />
                    </div>
                  </div>

                  {/* Row 3: Optional Delivery Instructions & Landmarks */}
                  <div>
                    <label className="block text-xs font-bold text-[#1F2329] mb-1.5">
                      {isRTL ? 'ملاحظات إضافية للتوصيل (اختياري)' : 'Delivery Instructions / Landmark (Optional)'}
                    </label>
                    <input
                      type="text"
                      value={deliveryNotes}
                      onChange={(e) => setDeliveryNotes(e.target.value)}
                      placeholder={isRTL ? 'علامة مميزة بجوار العنوان، مواعيد التواجد، أو تفاصيل خاصة للمندوب...' : 'Landmark, preferred delivery hours, or special courier notes...'}
                      className="w-full h-11 sm:h-12 px-4 rounded-xl border border-[#ECE9E6] bg-white text-xs sm:text-sm text-[#1F2329] placeholder:text-slate-400 focus:outline-none focus:border-[#C8102E] focus:ring-2 focus:ring-[#C8102E]/10 transition-all"
                    />
                  </div>
                </div>

                {/* Save Address to Book Checkbox */}
                {isAuthenticated && !selectedAddressId && (
                  <label className="flex items-center gap-2.5 cursor-pointer pt-2">
                    <input
                      type="checkbox"
                      checked={saveToAddressBook}
                      onChange={(e) => setSaveToAddressBook(e.target.checked)}
                      className="rounded accent-[#C8102E] cursor-pointer"
                    />
                    <span className="text-xs text-[#595F69] font-medium">
                      {t('checkout.saveToAddressBook')}
                    </span>
                  </label>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {/* City selection for Bosta PVZ branch */}
                <div>
                  <label className="block text-xs font-bold text-[#1F2329] mb-1.5">
                    {isRTL ? 'اختر المدينة للبحث عن فروع بوسطة:' : 'Select City for Bosta Branches:'}
                  </label>
                  <select
                    value={pickupCity}
                    onChange={(e) => setPickupCity(e.target.value)}
                    className="w-full h-11 sm:h-12 px-4 rounded-xl border border-[#ECE9E6] text-xs sm:text-sm font-bold outline-none focus:border-[#C8102E] bg-white text-[#1F2329]"
                  >
                    {availableCities.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Pickup points list */}
                <div>
                  <label className="block text-xs font-bold text-[#1F2329] mb-2">
                    {isRTL ? 'فروع ونقاط الاستلام المتاحة:' : 'Available Pickup Points:'}
                  </label>
                  {pickupPoints.length > 0 ? (
                    <div className="space-y-2.5 max-h-56 overflow-y-auto pe-1">
                      {pickupPoints.map((point) => {
                        const isSelected = selectedPickupPointId === point.id;
                        return (
                          <div
                            key={point.id}
                            onClick={() => setSelectedPickupPointId(point.id)}
                            className={`p-3.5 rounded-xl border cursor-pointer text-xs transition-all ${
                              isSelected
                                ? 'border-[#C8102E] bg-[#FDF2F4]/60 shadow-xs ring-1 ring-[#C8102E]'
                                : 'border-[#ECE9E6] hover:border-slate-300 hover:bg-[#FAF8F5]'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-[#1F2329]">
                                {point.name}
                              </span>
                              <span className="text-[11px] text-[#C8102E] font-bold">
                                {point.city}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#595F69] mt-1">
                              {point.address || (isRTL ? 'عنوان نقطة الاستلام' : 'Branch address')}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-4 bg-[#FAF8F5] rounded-xl text-center text-xs text-[#595F69] border border-[#ECE9E6]">
                      {isRTL ? 'لا توجد نقاط استلام متاحة حالياً في هذه المدينة' : 'No pickup branches in this city'}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* =========================================================================
              4. PAYMENT METHOD SECTION
              Clean single header: "طريقة الدفع", selected: "الدفع عند الاستلام"
              ========================================================================= */}
          <div className="bg-white rounded-2xl border border-[#ECE9E6] p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#FAF8F5] border border-[#ECE9E6] flex items-center justify-center text-[#C8102E]">
                <Banknote className="w-4 h-4" />
              </div>
              <h2 className="font-extrabold text-sm sm:text-base text-[#1F2329]">
                {t('checkout.paymentMethod')}
              </h2>
            </div>

            {/* Selected COD Payment Option Card */}
            <div className="p-4 rounded-xl border-2 border-[#C8102E] bg-[#FDF2F4]/60 ring-2 ring-[#C8102E]/15 flex items-start gap-3.5">
              <div className="w-5 h-5 rounded-full bg-[#C8102E] text-white flex items-center justify-center mt-0.5 flex-shrink-0">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-[#1F2329]">
                    {t('checkout.cashOnDelivery')}
                  </span>
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                    {isRTL ? 'مفعل ومضمون' : 'Active & Guaranteed'}
                  </span>
                </div>
                <p className="text-xs text-[#595F69] leading-relaxed">
                  {isRTL
                    ? 'عاين طلبك وتأكد من سلامة جميع المنتجات، ثم ادفع نقداً لمندوب التوصيل عند باب منزلك بكل أمان وثقة.'
                    : 'Inspect your order and verify items upon arrival, then pay cash to the courier at your door with complete confidence.'}
                </p>
              </div>
            </div>
          </div>

          {/* =========================================================================
              5. MULTI-VENDOR PARCELS BREAKDOWN
              Transparent overview of all shipments and vendor parcels
              ========================================================================= */}
          <div className="bg-white rounded-2xl border border-[#ECE9E6] p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#FAF8F5] border border-[#ECE9E6] flex items-center justify-center text-[#C8102E]">
                <Package className="w-4 h-4" />
              </div>
              <h3 className="font-extrabold text-sm sm:text-base text-[#1F2329]">
                {t('checkout.parcelsBreakdown')} ({groupedBySeller.length}):
              </h3>
            </div>

            <div className="space-y-3">
              {groupedBySeller.map((group, idx) => (
                <div
                  key={`checkout-vendor-${group.sellerId}`}
                  className="bg-[#FAF8F5] p-4 rounded-xl border border-[#ECE9E6] space-y-2.5"
                >
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-[#1F2329] flex items-center gap-1.5">
                      <Store className="w-3.5 h-3.5 text-[#C8102E]" />
                      <span>{t('checkout.sellerParcel', { seller: group.sellerName })}</span>
                    </span>
                    <span className="text-[11px] text-[#595F69] bg-white px-2 py-0.5 rounded border border-[#ECE9E6]">
                      {t('checkout.fromCity', { city: group.dispatchCity })}
                    </span>
                  </div>

                  <div className="divide-y divide-[#ECE9E6] bg-white rounded-lg p-2.5 border border-[#ECE9E6]/70">
                    {group.items.map((it) => (
                      <div
                        key={`checkout-it-${it.productId}-${it.variantId || 'base'}`}
                        className="py-1.5 flex justify-between items-center text-xs"
                      >
                        <span className="text-[#1F2329] truncate max-w-xs">
                          {it.product?.name} <span className="font-bold text-[#C8102E]">× {it.quantity}</span>
                        </span>
                        <span className="font-black text-[#1F2329]">
                          {formatCurrency((Number(it.product?.price) || 0) * it.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* =========================================================================
            RIGHT COLUMN: ORDER SUMMARY SIDEBAR (4 cols)
            Sticky on desktop, complete financial transparency, prominent CTA
            ========================================================================= */}
        <div className="lg:col-span-4 space-y-4 lg:sticky lg:top-24">
          <div className="bg-white rounded-2xl border border-[#ECE9E6] shadow-sm p-5 sm:p-6 space-y-5">
            <h3 className="font-black text-lg text-[#1F2329] border-b border-[#ECE9E6] pb-3">
              {t('cart.orderSummary')}
            </h3>

            {/* Promo Coupon Input & Applied Badge */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[#1F2329]">
                {isRTL ? 'كود الخصم أو قسيمة الشراء' : 'Promo Code / Coupon'}
              </label>

              {appliedCoupon ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-emerald-600" />
                    <div>
                      <span className="font-black text-emerald-900 font-mono tracking-wider">{appliedCoupon.code}</span>
                      <span className="block text-[11px] text-emerald-700 font-bold">
                        {isRTL ? `خصم: ${formatCurrency(appliedCoupon.discountAmount)}` : `Saved: ${formatCurrency(appliedCoupon.discountAmount)}`}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveCoupon}
                    className="p-1 hover:bg-emerald-100 rounded-lg text-emerald-700 transition-colors"
                    title={isRTL ? 'إزالة الكوبون' : 'Remove Coupon'}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={couponCodeInput}
                      onChange={(e) => setCouponCodeInput(e.target.value.toUpperCase())}
                      placeholder={isRTL ? 'أدخل كود الخصم (مثال: EGYPT10)' : 'Enter promo code...'}
                      className="flex-1 h-10 px-3 rounded-xl border border-[#ECE9E6] text-xs font-mono uppercase tracking-wider outline-none focus:border-[#C8102E] transition-all bg-white"
                    />
                    <button
                      type="button"
                      disabled={validatingCoupon || !couponCodeInput.trim()}
                      onClick={handleApplyCoupon}
                      className="h-10 px-4 bg-[#1F2329] hover:bg-[#14171B] disabled:opacity-40 text-white font-bold text-xs rounded-xl transition-colors shadow-xs"
                    >
                      {validatingCoupon ? '...' : (isRTL ? 'تطبيق' : 'Apply')}
                    </button>
                  </div>
                  {couponError && (
                    <p className="text-[11px] text-red-600 font-medium">{couponError}</p>
                  )}
                </div>
              )}
            </div>

            {/* Buyer Wallet (Store Credit) Option */}
            {isAuthenticated && walletBalance > 0 && (
              <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-bold text-blue-900">
                      {isRTL ? 'رصيد محفظتك المتاح:' : 'Available Store Credit:'}
                    </span>
                  </div>
                  <span className="text-xs font-black text-blue-800 font-mono">
                    {formatCurrency(walletBalance)}
                  </span>
                </div>

                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={useWalletBalance}
                    onChange={(e) => setUseWalletBalance(e.target.checked)}
                    className="rounded accent-blue-600 cursor-pointer"
                  />
                  <span className="text-xs text-blue-950 font-semibold">
                    {isRTL ? 'استخدام رصيد المحفظة لخصم جزء من الطلب' : 'Use wallet balance for this order'}
                  </span>
                </label>
              </div>
            )}

            {/* Financial Price Breakdown */}
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between text-[#595F69] text-xs">
                <span>{t('checkout.itemsTotal')}:</span>
                <span className="font-bold text-[#1F2329]">
                  {formatCurrency(itemsSubtotal)}
                </span>
              </div>

              {appliedCoupon && (
                <div className="flex justify-between text-emerald-700 text-xs font-bold">
                  <span>{isRTL ? 'خصم الكوبون:' : 'Coupon Discount:'}</span>
                  <span>-{formatCurrency(couponDiscount)}</span>
                </div>
              )}

              <div className="flex justify-between text-[#595F69] text-xs">
                <span>{t('checkout.deliveryTotal')}:</span>
                <span className="font-bold text-[#1F2329]">
                  {quoteLoading ? (
                    <span className="text-slate-400">...</span>
                  ) : (
                    formatCurrency(deliveryCostTotal)
                  )}
                </span>
              </div>

              {useWalletBalance && walletAmountUsed > 0 && (
                <div className="flex justify-between text-blue-700 text-xs font-bold">
                  <span>{isRTL ? 'الخصم من المحفظة:' : 'Wallet Store Credit:'}</span>
                  <span>-{formatCurrency(walletAmountUsed)}</span>
                </div>
              )}

              {/* Delivery ETA info */}
              {quoteData?.parcels && quoteData.parcels.length > 0 && (
                <div className="bg-[#FAF8F5] p-3 rounded-xl border border-[#ECE9E6] text-[11px] space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-[#1F2329]">
                    <Clock className="w-3.5 h-3.5 text-[#D6A33A]" />
                    <span>{isRTL ? 'الوصول المتوقع للشحنات:' : 'Estimated Arrival:'}</span>
                  </div>
                  {quoteData.parcels.map((p, idx) => (
                    <div key={`parcel-eta-${idx}`} className="flex justify-between text-[#595F69]">
                      <span>{p.sellerName || (isRTL ? `شحنة ${idx + 1}` : `Shipment ${idx + 1}`)}:</span>
                      <span className="font-bold text-emerald-700">
                        {p.etaMinDays}-{p.etaMaxDays} {isRTL ? 'أيام عمل' : 'business days'}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Grand Total Box */}
              <div className="border-t border-[#ECE9E6] pt-3 flex justify-between items-baseline">
                <span className="font-black text-[#1F2329] text-sm sm:text-base">
                  {isRTL ? 'المطلوب عند الاستلام:' : 'Cash Upon Receipt:'}
                </span>
                <span className="font-black text-xl text-[#C8102E]">
                  {formatCurrency(grandTotal)}
                </span>
              </div>
            </div>

            {/* Confirm Order CTA Button */}
            <button
              type="submit"
              disabled={submitting || checkoutItems.length === 0}
              className="w-full py-4 px-4 bg-[#C8102E] hover:bg-[#A80D26] text-white font-black text-sm rounded-xl transition-all shadow-md shadow-[#C8102E]/25 flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <span>{t('checkout.placingOrder')}</span>
              ) : (
                <>
                  <span>{t('checkout.confirmOrder')}</span>
                  {isRTL ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                </>
              )}
            </button>

            {/* Trust and PDPL Note */}
            <div className="text-[11px] text-[#595F69] space-y-1.5 border-t border-[#ECE9E6] pt-3">
              <div className="flex items-center gap-1.5 text-emerald-800 font-bold">
                <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                <span>{isRTL ? 'ضمان حماية المستهلك المصري' : 'Egyptian Consumer Protection'}</span>
              </div>
              <p className="leading-relaxed text-[10px] text-slate-500">
                {isRTL
                  ? 'وفقاً لقانون حماية البيانات الشخصية رقم 151/2020، بياناتك مشفرة ومحمية بالكامل ولا تتم مشاركتها إلا مع مندوب التوصيل لإتمام التسليم.'
                  : 'In compliance with PDPL 151/2020, your personal data is protected and solely shared with the delivery carrier to fulfill delivery.'}
              </p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
