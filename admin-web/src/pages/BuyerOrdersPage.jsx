import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Package,
  Truck,
  CheckCircle,
  Clock,
  RotateCcw,
  Store,
  ChevronRight,
  ChevronLeft,
  Calendar,
  AlertCircle,
  FileText,
  MapPin,
  Star,
  MessageSquare,
  Sparkles,
  ShieldCheck,
  X,
  Navigation,
  Eye,
  Plus,
  Minus,
  XCircle,
  AlertTriangle,
  Printer,
} from 'lucide-react';
import { getMyOrders, getOrderById, cancelOrder, confirmOrder } from '../api/ordersApi';
import { getBuyerDashboard } from '../api/usersApi';
import { createReview } from '../api/reviewsApi';
import { createReturnRequest, getBuyerReturns } from '../api/returnsApi';
import { formatCurrency } from '../utils/currency';
import { getImageUrl, handleImageError } from '../utils/imageUrl';
import { getShipmentStatusLabel, getShipmentStatusBadgeClass, getDeliveryMethodLabel } from '../utils/enumTranslations';

const STEPS = [
  { key: 'Pending', labelKey: 'orderStatus.Pending' },
  { key: 'HandedToCarrier', labelKey: 'shipmentStatus.HandedToCarrier' },
  { key: 'InTransit', labelKey: 'shipmentStatus.InTransit' },
  { key: 'Delivered', labelKey: 'shipmentStatus.Delivered' },
];

const isWithinReturnWindow = (deliveredAt, orderCreatedAt) => {
  const ref = deliveredAt || orderCreatedAt;
  if (!ref) return true;
  const diff = Date.now() - new Date(ref).getTime();
  return diff <= 30 * 24 * 60 * 60 * 1000;
};

export default function BuyerOrdersPage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'returns'
  const [orders, setOrders] = useState([]);
  const [buyerReturns, setBuyerReturns] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Review Modal State
  const [reviewProduct, setReviewProduct] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // 14-Day Return Modal State
  const [returnItem, setReturnItem] = useState(null);
  const [returnQuantity, setReturnQuantity] = useState(1);
  const [returnReason, setReturnReason] = useState('');
  const [returnDefectImage, setReturnDefectImage] = useState('');
  const [returnCategory, setReturnCategory] = useState('Standard14Day');
  const [submittingReturn, setSubmittingReturn] = useState(false);
  const [returnModalError, setReturnModalError] = useState(null);

  // Order Cancellation State
  const [cancelConfirmOrder, setCancelConfirmOrder] = useState(null);
  const [cancellingOrderId, setCancellingOrderId] = useState(null);
  const [cancelError, setCancelError] = useState(null);
  const [confirmingOrderId, setConfirmingOrderId] = useState(null);
  const [confirmSuccessMsg, setConfirmSuccessMsg] = useState(null);

  const handleConfirmOrder = async (orderId) => {
    setConfirmingOrderId(orderId);
    try {
      await confirmOrder(orderId, { channel: 'Web' });
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, isBuyerConfirmed: true, confirmedAt: new Date().toISOString() } : o))
      );
      setConfirmSuccessMsg(isRTL ? 'تم تأكيد الطلب بنجاح وسيتم تجهيز الشحنة للشحن.' : 'Order confirmed successfully for dispatch.');
      setTimeout(() => setConfirmSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Failed to confirm order:', err);
    } finally {
      setConfirmingOrderId(null);
    }
  };

  // Printable Invoice State
  const [invoiceOrder, setInvoiceOrder] = useState(null);

  const [searchParams] = useSearchParams();
  const orderIdParam = searchParams.get('orderId') || searchParams.get('highlight');

  useEffect(() => {
    if (!orderIdParam) return;
    const targetId = parseInt(orderIdParam, 10);
    if (!targetId) return;

    const found = orders.find((o) => o.id === targetId);
    if (found) {
      setInvoiceOrder(found);
    } else if (!loading) {
      getOrderById(targetId)
        .then((res) => {
          if (res?.data) {
            setInvoiceOrder(res.data);
          }
        })
        .catch((err) => {
          console.warn('Failed to fetch focused order by ID:', err);
        });
    }
  }, [orderIdParam, orders, loading]);

  const fetchOrdersAndDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ordersRes, dashRes, returnsRes] = await Promise.all([
        getMyOrders(),
        getBuyerDashboard().catch((e) => {
          console.warn('Buyer dashboard fallback', e);
          return { data: null };
        }),
        getBuyerReturns().catch((e) => {
          console.warn('Buyer returns fallback', e);
          return { data: [] };
        }),
      ]);
      setOrders(Array.isArray(ordersRes.data) ? ordersRes.data : []);
      if (dashRes?.data) setDashboard(dashRes.data);
      if (Array.isArray(returnsRes?.data)) setBuyerReturns(returnsRes.data);
    } catch (err) {
      console.error('Failed to load orders/returns', err);
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchOrdersAndDashboard();
  }, [fetchOrdersAndDashboard]);

  // Submit product review from order
  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (submittingReview || !reviewProduct) return;

    if (!reviewComment.trim()) {
      alert(t('product.yourComment'));
      return;
    }

    setSubmittingReview(true);
    try {
      await createReview({
        productId: reviewProduct.productId,
        rating: reviewRating,
        comment: reviewComment.trim(),
      });
      setToastMessage(t('product.reviewSuccess'));
      setReviewProduct(null);
      setReviewComment('');
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err) {
      console.error('Review submit failed', err);
      alert(err?.response?.data?.error || err?.response?.data?.message || t('common.error'));
    } finally {
      setSubmittingReview(false);
    }
  };

  // Open Return Request Modal
  const handleOpenReturnModal = (item) => {
    setReturnItem(item);
    setReturnQuantity(1);
    setReturnReason('');
    setReturnDefectImage('');
    setReturnModalError(null);
  };

  // Submit 14-Day Return Request (Egyptian Law 181/2018)
  const handleSubmitReturn = async (e) => {
    e.preventDefault();
    if (submittingReturn || !returnItem) return;

    if (!returnReason.trim()) {
      setReturnModalError(isRTL ? 'يرجى كتابة سبب طلب الإرجاع' : 'Please provide a return reason');
      return;
    }

    try {
      setSubmittingReturn(true);
      setReturnModalError(null);

      const payload = {
        orderItemId: returnItem.id,
        quantity: Math.max(1, returnQuantity),
        reason: returnReason.trim(),
        defectImageUrl: returnDefectImage.trim() || null,
        category: returnCategory,
      };

      const res = await createReturnRequest(payload);
      setReturnItem(null);
      setToastMessage(
        isRTL
          ? `تم تقديم طلب الإرجاع بنجاح برقم #${res?.data?.id || ''}. سيتم إيداع المبلغ في محفظتك بمجرد موافقة التاجر.`
          : `Return request #${res?.data?.id || ''} submitted successfully. Refund will be credited upon approval.`
      );
      setTimeout(() => setToastMessage(null), 5000);
      await fetchOrdersAndDashboard();
    } catch (err) {
      console.error('Return request failed', err);
      setReturnModalError(
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        t('common.error')
      );
    } finally {
      setSubmittingReturn(false);
    }
  };

  // Submit Order Cancellation
  const handleConfirmCancel = async () => {
    if (!cancelConfirmOrder || cancellingOrderId) return;
    setCancellingOrderId(cancelConfirmOrder.id);
    setCancelError(null);
    try {
      await cancelOrder(cancelConfirmOrder.id);
      setToastMessage(t('orders.cancelOrderSuccess'));
      setTimeout(() => setToastMessage(null), 5000);
      setCancelConfirmOrder(null);
      await fetchOrdersAndDashboard();
    } catch (err) {
      console.error('Failed to cancel order', err);
      setCancelError(err?.response?.data?.error || err?.response?.data?.message || t('common.error'));
    } finally {
      setCancellingOrderId(null);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Delivered':
        return CheckCircle;
      case 'Returned':
        return RotateCcw;
      case 'InTransit':
        return Truck;
      case 'ReadyForPickup':
        return MapPin;
      case 'HandedToCarrier':
        return Truck;
      default:
        return Clock;
    }
  };

  const getStepProgressIndex = (status) => {
    if (status === 'Pending') return 0;
    if (status === 'HandedToCarrier') return 1;
    if (status === 'InTransit' || status === 'ReadyForPickup') return 2;
    if (status === 'Delivered') return 3;
    if (status === 'Returned') return -1;
    return 0;
  };

  if (loading && !dashboard && orders.length === 0) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl text-xs font-bold flex items-center justify-between shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">
            {t('orders.hubTitle')}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {t('orders.hubSubtitle')}
          </p>
        </div>

        <button
          onClick={fetchOrdersAndDashboard}
          className="px-3.5 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{t('common.refresh')}</span>
        </button>
      </div>

      {/* Top Tab Switcher (Orders vs Returns) */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('orders')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
            activeTab === 'orders'
              ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>{isRTL ? 'طلباتي وشحناتي' : 'My Orders & Shipments'}</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeTab === 'orders' ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            {orders.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('returns')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
            activeTab === 'returns'
              ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <RotateCcw className="w-4 h-4" />
          <span>{isRTL ? 'طلبات الإرجاع والاسترداد (قانون 181/2018)' : 'Returns & Refunds (Law 181)'}</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeTab === 'returns' ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            {buyerReturns.length}
          </span>
        </button>
      </div>

      {/* 1. Buyer 5-Stage Order Status Counters Bar (Only shown on orders tab) */}
      {activeTab === 'orders' && dashboard && (
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-3">
          <h3 className="font-extrabold text-xs text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-orange-500" />
            <span>{t('orders.activeShipmentsTitle')}</span>
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 text-center">
              <span className="text-[11px] text-slate-500 font-bold block">{t('orderStatus.Pending')}</span>
              <span className="text-xl font-black text-slate-900 mt-1 block">{dashboard.processingCount}</span>
            </div>

            <div className="bg-blue-50/60 p-3.5 rounded-2xl border border-blue-100 text-center">
              <span className="text-[11px] text-blue-700 font-bold block">{t('shipmentStatus.InTransit')}</span>
              <span className="text-xl font-black text-blue-700 mt-1 block">{dashboard.inTransitCount}</span>
            </div>

            <div className="bg-purple-50/60 p-3.5 rounded-2xl border border-purple-100 text-center">
              <span className="text-[11px] text-purple-700 font-bold block">{t('shipmentStatus.ReadyForPickup')}</span>
              <span className="text-xl font-black text-purple-700 mt-1 block">{dashboard.readyForPickupCount}</span>
            </div>

            <div className="bg-emerald-50/60 p-3.5 rounded-2xl border border-emerald-100 text-center">
              <span className="text-[11px] text-emerald-700 font-bold block">{t('shipmentStatus.Delivered')}</span>
              <span className="text-xl font-black text-emerald-700 mt-1 block">{dashboard.deliveredCount}</span>
            </div>

            <div className="bg-red-50/60 p-3.5 rounded-2xl border border-red-100 text-center col-span-2 sm:col-span-1">
              <span className="text-[11px] text-red-700 font-bold block">{t('shipmentStatus.Returned')}</span>
              <span className="text-xl font-black text-red-700 mt-1 block">{dashboard.returnedCount}</span>
            </div>
          </div>
        </div>
      )}

      {/* 2. Live Active Shipment Tracker Pin Widget */}
      {activeTab === 'orders' && dashboard?.activeShipment && (
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6 rounded-3xl shadow-xl space-y-4 border border-slate-700">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-orange-500 text-white rounded-2xl shadow-md shadow-orange-500/20">
                <Navigation className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <span className="text-[10px] text-orange-400 font-bold uppercase tracking-wider block">
                  {t('orders.currentActiveShipment')}
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <h3 className="font-black text-sm text-white">
                    {t('orders.shipment', { id: dashboard.activeShipment.shipmentId, seller: dashboard.activeShipment.sellerName || '' })}
                  </h3>
                  {dashboard.activeShipment.trackingNumber && (
                    <span className="bg-slate-800 text-orange-400 font-mono text-[11px] px-2 py-0.5 rounded font-bold border border-slate-700">
                      {dashboard.activeShipment.trackingNumber}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="text-end">
              <span className="text-xs text-slate-400 block">{t('orders.codLabel', { amount: '' })}</span>
              <span className="text-base font-black text-orange-400">
                {formatCurrency(dashboard.activeShipment.codAmount)}
              </span>
            </div>
          </div>

          <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <Truck className="w-4 h-4 text-emerald-400" />
              <span>{t('orders.officialCarrier')} <strong className="text-white">{dashboard.activeShipment.carrierName || 'Bosta Express'}</strong></span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <MapPin className="w-4 h-4 text-orange-400" />
              <span>{t('orders.destination')} <strong className="text-white">{dashboard.activeShipment.recipientCity}</strong></span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <Clock className="w-4 h-4 text-blue-400" />
              <span>
                {t('orders.eta', {
                  min: dashboard.activeShipment.etaMinDays || 1,
                  max: dashboard.activeShipment.etaMaxDays || 3,
                })}
              </span>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-2xl p-4 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* TAB 1: ORDERS LIST */}
      {activeTab === 'orders' && (
        <>
          {orders.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 space-y-4 max-w-lg mx-auto shadow-sm">
              <div className="w-16 h-16 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center mx-auto">
                <Package className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                {t('orders.emptyTitle')}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {t('orders.emptySubtitle')}
              </p>
              <Link
                to="/"
                className="inline-block px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs shadow-md shadow-orange-500/20"
              >
                {t('orders.startShopping')}
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {orders.map((order) => {
                const shipments = Array.isArray(order.shipments) ? order.shipments : [];
                const isCancelled = order.status === 'Cancelled';
                const canCancel =
                  !isCancelled &&
                  order.status !== 'Delivered' &&
                  order.status !== 'Completed' &&
                  shipments.length > 0 &&
                  shipments.every((s) => s.status === 'Created' || s.status === 'Pending');
                const formattedDate = order.createdAt
                  ? new Date(order.createdAt).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '';

                const isHighlighted = orderIdParam && parseInt(orderIdParam, 10) === order.id;

                return (
                  <div
                    key={`order-card-${order.id}`}
                    id={`order-card-${order.id}`}
                    className={`bg-white rounded-3xl border transition-all ${
                      isHighlighted
                        ? 'border-orange-500 ring-2 ring-orange-400/50 shadow-lg'
                        : 'border-slate-200/80 shadow-sm'
                    } overflow-hidden`}
                  >
                    {/* Order Header */}
                    <div className="bg-slate-900 text-white px-6 py-4 flex flex-wrap items-center justify-between gap-4">
                      <div className="flex flex-wrap items-center gap-4 text-xs">
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">
                            {t('orders.orderNumber', { id: '' })}
                          </span>
                          <span className="font-mono font-black text-sm text-white">#{order.id}</span>
                        </div>

                        <div className="hidden sm:block border-s border-slate-700 ps-4">
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">
                            {t('common.date')}
                          </span>
                          <span className="font-medium text-slate-200">{formattedDate}</span>
                        </div>

                        <div className="hidden md:block border-s border-slate-700 ps-4">
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">
                            {t('checkout.deliveryMethod')}
                          </span>
                          <span className="font-semibold text-orange-400">
                            {getDeliveryMethodLabel(order.deliveryMethod, t)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        {isCancelled && (
                          <span className="px-3 py-1 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 text-xs font-bold">
                            {t('orderStatus.Cancelled')}
                          </span>
                        )}

                        {/* Pre-Dispatch Confirmation Button (GAP-ORD-01) */}
                        {order.isBuyerConfirmed ? (
                          <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                            <span>{t('orders.confirmed', isRTL ? 'مؤكد للشحن' : 'Confirmed')}</span>
                          </span>
                        ) : (
                          order.paymentMethod === 'OnReceipt' && !isCancelled && order.status === 'Pending' && (
                            <button
                              onClick={() => handleConfirmOrder(order.id)}
                              disabled={confirmingOrderId === order.id}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/30 transition-all disabled:opacity-50"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              <span>{confirmingOrderId === order.id ? t('common.loading') : t('orders.confirmOrder', isRTL ? 'تأكيد الطلب للشحن' : 'Confirm Order')}</span>
                            </button>
                          )
                        )}

                        {canCancel && (
                          <button
                            onClick={() => {
                              setCancelError(null);
                              setCancelConfirmOrder(order);
                            }}
                            className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-200 hover:text-white border border-red-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                          >
                            <XCircle className="w-3.5 h-3.5 text-red-400" />
                            <span>{t('orders.cancelOrder')}</span>
                          </button>
                        )}

                        <button
                          onClick={() => setInvoiceOrder(order)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                        >
                          <Printer className="w-3.5 h-3.5 text-slate-300" />
                          <span>{t('invoice.print')}</span>
                        </button>

                        <div className="text-end">
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">
                            {t('checkout.grandTotal')}
                          </span>
                          <span className="text-lg font-black text-orange-400">
                            {formatCurrency(order.totalAmount)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Vendor Shipments inside this Order */}
                    <div className="p-6 space-y-6">
                      {shipments.map((shipment, sIdx) => {
                        const badgeClass = getShipmentStatusBadgeClass(shipment.status);
                        const StepIcon = getStatusIcon(shipment.status);
                        const stepIdx = getStepProgressIndex(shipment.status);
                        const isDelivered = shipment.status === 'Delivered';
                        const isReturned = shipment.status === 'Returned';
                        const eligibleFor14DayReturn = isDelivered && isWithinReturnWindow(shipment.deliveredAt, order.createdAt);

                        return (
                          <div
                            key={`shipment-${shipment.id || sIdx}`}
                            className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-4"
                          >
                            {/* Shipment Top Bar */}
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <div className="p-2 bg-orange-500 rounded-xl text-white">
                                  <Truck className="w-4 h-4" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-black text-sm text-slate-900">
                                      {shipment.sellerName || t('orders.sellerParcel', { id: shipment.id })}
                                    </h4>
                                    {shipment.trackingNumber && (
                                      <span className="bg-slate-200 text-slate-800 font-mono text-[11px] px-2 py-0.5 rounded font-bold">
                                        {shipment.trackingNumber}
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[11px] text-slate-500">
                                    {t('orders.parcelCod')} <strong className="text-slate-900">{formatCurrency(shipment.codAmount)}</strong>
                                    {' '}({t('orders.inclDelivery')} {formatCurrency(shipment.deliveryCost)})
                                  </span>
                                </div>
                              </div>

                              {/* Status Badge */}
                              <div
                                className={`px-3 py-1 rounded-full border text-xs font-bold flex items-center gap-1.5 ${badgeClass}`}
                              >
                                <StepIcon className="w-3.5 h-3.5" />
                                <span>{getShipmentStatusLabel(shipment.status, t)}</span>
                              </div>
                            </div>

                            {/* Visual Status Stepper */}
                            {!isReturned ? (
                              <div className="py-2">
                                <div className="grid grid-cols-4 gap-2 text-center relative">
                                  {STEPS.map((step, idx) => {
                                    const isPassed = stepIdx >= idx;
                                    const isCurrent = stepIdx === idx;
                                    return (
                                      <div key={step.key} className="flex flex-col items-center">
                                        <div
                                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                                            isPassed
                                              ? 'bg-orange-500 text-white shadow-md shadow-orange-500/25 ring-4 ring-orange-500/10'
                                              : 'bg-slate-200 text-slate-400'
                                          }`}
                                        >
                                          {idx + 1}
                                        </div>
                                        <span
                                          className={`text-[11px] mt-1.5 font-bold ${
                                            isCurrent
                                              ? 'text-orange-600'
                                              : isPassed
                                              ? 'text-slate-800'
                                              : 'text-slate-400'
                                          }`}
                                        >
                                          {t(step.labelKey)}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : (
                              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-800 flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-bold block">
                                    {t('orders.returnedToWarehouse')}
                                  </span>
                                  <span className="text-[11px]">
                                    {shipment.returnReason || t('orders.refusedAtDoor')}
                                  </span>
                                </div>
                              </div>
                            )}

                            {/* Shipment Items + Rate / Return Buttons */}
                            <div className="divide-y divide-slate-200/60 pt-2 border-t border-slate-200/60">
                              {shipment.items?.map((item) => {
                                const img = item.imageUrl ? getImageUrl(item.imageUrl) : null;
                                return (
                                  <div
                                    key={`sh-it-${item.id || item.productId}`}
                                    className="py-2.5 flex flex-wrap items-center justify-between text-xs gap-3"
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      {img && (
                                        <img
                                          src={img}
                                          alt=""
                                          onError={handleImageError}
                                          className="w-10 h-10 object-contain rounded-lg bg-white border border-slate-200 p-0.5"
                                        />
                                      )}
                                      <div>
                                        <span className="text-slate-800 font-medium block truncate max-w-xs">
                                          {item.productName}
                                        </span>
                                        <span className="text-slate-500 text-[11px]">
                                          {formatCurrency(item.unitPrice)} × {item.quantity} = <strong className="text-slate-900">{formatCurrency(item.unitPrice * item.quantity)}</strong>
                                        </span>
                                      </div>
                                    </div>

                                    {/* Action Buttons for Delivered Shipment Item */}
                                    {isDelivered && (
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={() => setReviewProduct(item)}
                                          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm transition-transform active:scale-95"
                                        >
                                          <Star className="w-3.5 h-3.5 fill-white" />
                                          <span>{t('orders.rateProduct')}</span>
                                        </button>

                                        {eligibleFor14DayReturn && (
                                          <button
                                            onClick={() => handleOpenReturnModal(item)}
                                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors"
                                          >
                                            <RotateCcw className="w-3.5 h-3.5 text-orange-500" />
                                            <span>{isRTL ? 'طلب استرجاع (14-30 يوماً)' : 'Request Return (14-30d)'}</span>
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* TAB 2: BUYER RETURNS LIST */}
      {activeTab === 'returns' && (
        <div className="space-y-4">
          <div className="bg-orange-50/70 border border-orange-200 rounded-2xl p-4 text-xs text-orange-900 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block text-sm mb-0.5">
                {isRTL ? 'ضمان حماية المستهلك المصري (القانون 181 لسنة 2018)' : 'Egyptian Consumer Protection Law 181/2018'}
              </span>
              <p className="leading-relaxed text-orange-800">
                {isRTL
                  ? 'يحق للمستهلك استرجاع المنتجات خلال 14 يوماً من تاريخ استلام الشحنة في حال وجود عيب صناعة أو عدم مطابقة للمواصفات. يتم إيداع المبلغ في محفظتك الإلكترونية تلقائياً فور موافقة التاجر.'
                  : 'You are entitled to return goods within 14 days of delivery. Once approved by the seller, the refund amount is credited directly to your store credit wallet.'}
              </p>
            </div>
          </div>

          {buyerReturns.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 space-y-4 max-w-lg mx-auto shadow-sm">
              <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <RotateCcw className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-800">
                {isRTL ? 'لا توجد لديك طلبات إرجاع حالية' : 'No return requests yet'}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {isRTL
                  ? 'يمكنك طلب استرجاع أي منتج تم تسليمه خلال 14 يوماً من تبويب "طلباتي وشحناتي".'
                  : 'You can request a return for delivered items from your orders tab within 14 days of receipt.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {buyerReturns.map((ret) => {
                const isPending = ret.status === 'Pending';
                const isApproved = ret.status === 'Approved';
                const isRejected = ret.status === 'Rejected';

                return (
                  <div
                    key={`ret-${ret.id}`}
                    className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-slate-900">
                          {isRTL ? `طلب إرجاع #${ret.id}` : `Return #${ret.id}`}
                        </span>
                        <span className="text-slate-400">•</span>
                        <span className="text-xs text-slate-500">
                          {isRTL ? `طلب الشراء #${ret.orderId}` : `Order #${ret.orderId}`}
                        </span>
                      </div>

                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${
                          isPending
                            ? 'bg-amber-100 text-amber-800'
                            : isApproved
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {ret.isDisputed
                          ? (isRTL ? 'قيد النزاع الإداري' : 'Disputed')
                          : ret.status === 'ApprovedAwaitingReturn'
                          ? (isRTL ? 'موافقة مبدئية - جاري شحن المرتجع' : 'Approved - Return Shipment')
                          : isPending
                          ? (isRTL ? 'قيد مراجعة التاجر' : 'Pending Review')
                          : (isApproved || ret.status === 'Completed')
                          ? (isRTL ? 'تم الاستلام وإيداع المبلغ بالمحفظة' : 'Completed & Refunded')
                          : (isRTL ? 'طلب مرفوض' : 'Rejected')}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <span className="text-slate-500 block">{isRTL ? 'المنتج:' : 'Product:'}</span>
                        <p className="font-bold text-slate-900 text-sm mt-0.5">{ret.productName}</p>
                      </div>

                      <div>
                        <span className="text-slate-500 block">{isRTL ? 'الكمية ومبلغ الاسترداد:' : 'Qty & Refund:'}</span>
                        <p className="font-bold text-slate-900 mt-0.5">
                          {ret.quantity} {isRTL ? 'قطع' : 'pcs'} •{' '}
                          <span className="text-emerald-600">{formatCurrency(ret.refundAmount)}</span>
                        </p>
                      </div>

                      <div>
                        <span className="text-slate-500 block">{isRTL ? 'تاريخ الطلب:' : 'Request Date:'}</span>
                        <p className="font-semibold text-slate-700 mt-0.5">
                          {ret.createdAt ? new Date(ret.createdAt).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US') : '—'}
                        </p>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1.5">
                      <p className="text-slate-800">
                        <strong className="text-slate-700">{isRTL ? 'السبب المعلن: ' : 'Reason: '}</strong>
                        {ret.reason}
                      </p>

                      {ret.sellerNote && (
                        <p className="text-slate-700 pt-1 border-t border-slate-200/60">
                          <strong className="text-orange-600">{isRTL ? 'رد وملاحظة التاجر: ' : 'Seller Note: '}</strong>
                          {ret.sellerNote}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 14-Day Return Modal */}
      {returnItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div role="dialog" aria-modal="true" className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-orange-500" />
                <span>{isRTL ? 'طلب استرجاع (ضمان 14 يوم - حماية المستهلك)' : '14-Day Return Request'}</span>
              </h3>
              <button onClick={() => setReturnItem(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs space-y-1">
              <p className="font-bold text-slate-900">{returnItem.productName}</p>
              <p className="text-slate-500">
                {isRTL ? 'سعر الوحدة: ' : 'Unit Price: '} {formatCurrency(returnItem.unitPrice)} • {isRTL ? 'الكمية المشتراة: ' : 'Purchased Qty: '} {returnItem.quantity}
              </p>
            </div>

            {returnModalError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{returnModalError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitReturn} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isRTL ? 'نوع طلب الإرجاع (قانون حماية المستهلك 181/2018) *:' : 'Return Type (Law 181/2018) *:'}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setReturnCategory('Standard14Day')}
                    className={`p-3 rounded-xl border text-start transition-all ${
                      returnCategory === 'Standard14Day'
                        ? 'border-orange-500 bg-orange-50 text-orange-950 shadow-sm font-bold'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <p className="text-xs">{isRTL ? 'عدول بدون سبب (14 يوماً)' : 'Standard Return (14 Days)'}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{isRTL ? 'المادة 17 - دون عيب وبحالته الأصلية' : 'Article 17 - In original condition'}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setReturnCategory('ManufacturingDefect30Day')}
                    className={`p-3 rounded-xl border text-start transition-all ${
                      returnCategory === 'ManufacturingDefect30Day'
                        ? 'border-orange-500 bg-orange-50 text-orange-950 shadow-sm font-bold'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <p className="text-xs">{isRTL ? 'عيب صناعة أو تلف (30 يوماً)' : 'Defect / Damaged (30 Days)'}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{isRTL ? 'المادة 21 - عيب صناعة أو عدم مطابقة' : 'Article 21 - Defect or mismatch'}</p>
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isRTL ? 'الكمية المراد إرجاعها:' : 'Return Quantity:'}
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setReturnQuantity((q) => Math.max(1, q - 1))}
                    className="w-9 h-9 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center justify-center font-bold"
                  >
                    <Minus className="w-4 h-4 text-slate-600" />
                  </button>
                  <span className="font-black text-sm text-slate-900 font-mono w-8 text-center">{returnQuantity}</span>
                  <button
                    type="button"
                    onClick={() => setReturnQuantity((q) => Math.min(returnItem.quantity || 1, q + 1))}
                    className="w-9 h-9 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center justify-center font-bold"
                  >
                    <Plus className="w-4 h-4 text-slate-600" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isRTL ? 'سبب الإرجاع *:' : 'Return Reason *:'}
                </label>
                <textarea
                  rows={3}
                  required
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder={isRTL ? 'اذكر سبب طلب الاسترجاع (عيب صناعة، تلف أثناء الشحن، غير مطابق...)' : 'Describe defect or reason for return...'}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs outline-none focus:border-orange-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isRTL ? 'رابط صورة العيب (اختياري):' : 'Defect Image URL (optional):'}
                </label>
                <input
                  type="text"
                  value={returnDefectImage}
                  onChange={(e) => setReturnDefectImage(e.target.value)}
                  placeholder="e.g. /uploads/defect.jpg"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs outline-none focus:border-orange-500 font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReturnItem(null)}
                  className="px-4 py-2.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submittingReturn}
                  className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl shadow-md disabled:opacity-50"
                >
                  {submittingReturn ? t('common.loading') : (isRTL ? 'إرسال طلب الإرجاع' : 'Submit Return Request')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {reviewProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div role="dialog" aria-modal="true" className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                <span>{t('product.writeReview')}</span>
              </h3>
              <button onClick={() => setReviewProduct(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs font-bold text-slate-800 truncate">{reviewProduct.productName}</p>

            <form onSubmit={handleReviewSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {t('product.yourRating')}
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={`modal-star-${star}`}
                      onClick={() => setReviewRating(star)}
                      className="p-1 hover:scale-110 transition-transform"
                    >
                      <Star
                        className={`w-7 h-7 ${
                          star <= reviewRating
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-slate-200'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="text-xs font-bold text-slate-700 ms-2">
                    {reviewRating === 5 ? t('product.ratingExcellent') : reviewRating === 4 ? t('product.ratingVeryGood') : reviewRating === 3 ? t('product.ratingGood') : t('product.ratingNeedsImprovement')}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('product.yourComment')}
                </label>
                <textarea
                  rows={3}
                  required
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder={t('product.commentPlaceholder')}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-orange-500"
                ></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReviewProduct(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submittingReview}
                  className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl shadow-md disabled:opacity-50"
                >
                  {submittingReview ? t('product.submittingReview') : t('product.submitReview')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Cancel Order Confirmation Modal */}
      {cancelConfirmOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div role="dialog" aria-modal="true" className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <span>{t('orders.cancelOrderConfirmTitle')}</span>
              </h3>
              <button
                onClick={() => {
                  if (!cancellingOrderId) setCancelConfirmOrder(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">{t('orders.orderNumber', { id: '' })}</span>
                <span className="font-mono font-bold text-slate-900">#{cancelConfirmOrder.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t('checkout.grandTotal')}</span>
                <span className="font-bold text-orange-600">{formatCurrency(cancelConfirmOrder.totalAmount)}</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {t('orders.cancelOrderConfirmMessage')}
            </p>

            {cancelError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{cancelError}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={Boolean(cancellingOrderId)}
                onClick={() => setCancelConfirmOrder(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                disabled={Boolean(cancellingOrderId)}
                onClick={handleConfirmCancel}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-md transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {cancellingOrderId ? (
                  <span>{t('orders.cancelling')}</span>
                ) : (
                  <>
                    <XCircle className="w-4 h-4" />
                    <span>{t('orders.cancelOrder')}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PRINTABLE INVOICE */}
      {invoiceOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm print:p-0 print:bg-white print:static print:inset-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 max-h-[90vh] overflow-y-auto print:max-h-none print:shadow-none print:border-none print:p-0 print:w-full" role="dialog" aria-modal="true" aria-label="فاتورة الطلب / Invoice">
            {/* Header & Actions */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-xl font-black text-slate-900 tracking-tight">
                  {isRTL ? 'سوق مصر' : 'Egypt Market'}
                </span>
                <span className="text-xs text-orange-600 font-bold block">
                  {t('invoice.title')}
                </span>
              </div>
              <div className="flex items-center gap-2 print:hidden">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-orange-500/20"
                >
                  <Printer className="w-4 h-4" />
                  <span>{t('invoice.print')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInvoiceOrder(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Meta Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-slate-50 text-xs">
              <div>
                <span className="text-slate-400 block">{t('invoice.orderNumber')}</span>
                <strong className="text-slate-900 font-mono text-sm">#{invoiceOrder.id}</strong>
              </div>
              <div>
                <span className="text-slate-400 block">{t('invoice.date')}</span>
                <strong className="text-slate-800">
                  {new Date(invoiceOrder.createdAt).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US')}
                </strong>
              </div>
              <div>
                <span className="text-slate-400 block">{t('invoice.paymentMethod')}</span>
                <strong className="text-slate-800 font-bold">
                  {invoiceOrder.paymentMethod || (isRTL ? 'دفع عند الاستلام' : 'Cash On Delivery')}
                </strong>
              </div>
              <div>
                <span className="text-slate-400 block">{t('invoice.paymentStatus')}</span>
                <strong className="text-emerald-700 font-bold">
                  {isRTL ? 'مطلوب عند الاستلام' : 'Pay on Delivery'}
                </strong>
              </div>
            </div>

            {/* Shipping Info & Detailed Egyptian Address (GAP-LOG-04) */}
            <div className="p-4 rounded-2xl border border-slate-100 text-xs space-y-1.5">
              <span className="font-bold text-slate-800 block text-xs">{t('invoice.shippingAddress')}:</span>
              <p className="text-slate-700 font-medium">
                {invoiceOrder.governorate ? `${invoiceOrder.governorate} - ${invoiceOrder.city || ''} - ${invoiceOrder.area || ''}` : ''}
                {invoiceOrder.streetBuilding ? ` - ${invoiceOrder.streetBuilding}` : ''}
                {invoiceOrder.buildingNumber ? (isRTL ? ` (عقار: ${invoiceOrder.buildingNumber}` : ` (Bldg: ${invoiceOrder.buildingNumber}`) : ''}
                {invoiceOrder.floor ? (isRTL ? `، دور: ${invoiceOrder.floor}` : `, Fl: ${invoiceOrder.floor}`) : ''}
                {invoiceOrder.apartment ? (isRTL ? `، شقة: ${invoiceOrder.apartment})` : `, Apt: ${invoiceOrder.apartment})`) : (invoiceOrder.buildingNumber ? ')' : '')}
              </p>
              {invoiceOrder.landmark && (
                <p className="text-slate-600 font-medium">
                  <span className="font-bold text-slate-400">{isRTL ? 'معلم استرشادي: ' : 'Landmark: '}</span>
                  {invoiceOrder.landmark}
                </p>
              )}
              {invoiceOrder.deliveryLatitude && invoiceOrder.deliveryLongitude && (
                <p className="text-slate-400 font-mono text-[10px]">
                  {t('invoice.coordinates')}: {invoiceOrder.deliveryLatitude.toFixed(5)}, {invoiceOrder.deliveryLongitude.toFixed(5)}
                </p>
              )}
            </div>

            {/* Inspection Badge (GAP-BUY-01) */}
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 text-xs font-bold">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{isRTL ? 'معاينة الطرد عند الاستلام أمام المندوب مسموحة وموصى بها' : 'Open-box inspection upon delivery permitted and recommended'}</span>
            </div>

            {/* Items Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-bold">
                    <th className="py-2 text-start">{t('invoice.item')}</th>
                    <th className="py-2 text-center">{t('invoice.quantity')}</th>
                    <th className="py-2 text-end">{t('invoice.unitPrice')}</th>
                    <th className="py-2 text-end">{t('invoice.total')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(invoiceOrder.shipments?.flatMap((s) => s.orderItems || s.items || []) || []).map((item, idx) => {
                    const itemName = isRTL ? (item.productNameAr || item.productNameEn || item.productName) : (item.productNameEn || item.productNameAr || item.productName);
                    const qty = item.quantity || 1;
                    const price = Number(item.unitPrice || item.price || 0);
                    return (
                      <tr key={`inv-item-${idx}`}>
                        <td className="py-2.5 font-bold text-slate-800">{itemName}</td>
                        <td className="py-2.5 text-center font-mono">{qty}</td>
                        <td className="py-2.5 text-end font-mono">{formatCurrency(price)}</td>
                        <td className="py-2.5 text-end font-mono font-bold text-slate-900">{formatCurrency(price * qty)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Total Summary */}
            <div className="border-t border-slate-200 pt-3 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>{t('invoice.subtotal')}</span>
                <span className="font-mono">
                  {formatCurrency((invoiceOrder.shipments?.flatMap((s) => s.orderItems || s.items || []) || []).reduce((acc, it) => acc + (Number(it.unitPrice || it.price || 0) * (it.quantity || 1)), 0))}
                </span>
              </div>
              {Number(invoiceOrder.shippingFee) > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>{t('invoice.shippingFee')}</span>
                  <span className="font-mono">{formatCurrency(invoiceOrder.shippingFee)}</span>
                </div>
              )}
              {Number(invoiceOrder.discountAmount) > 0 && (
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>{t('invoice.discount')}</span>
                  <span className="font-mono">-{formatCurrency(invoiceOrder.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t border-slate-200">
                <span>{t('invoice.codNetDue')}</span>
                <span className="font-mono text-orange-600">{formatCurrency(invoiceOrder.totalAmount)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
