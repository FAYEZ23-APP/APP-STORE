import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  Clock,
  Truck,
  Store,
  CheckCircle2,
  RotateCcw,
  Package,
  Check,
  ChevronRight,
  ChevronLeft,
  Banknote,
  Send,
} from 'lucide-react';
import { formatCurrency } from '../../utils/currency';

export default function OrderTrackingCard({
  role = 'Buyer',
  buyerDashboard,
  sellerDashboard,
  sellerOrdersSummary,
}) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const isSeller = role === 'Seller';

  // Counts determination based on role
  const processingCount = isSeller
    ? (sellerOrdersSummary?.processingCount ?? sellerDashboard?.pendingHandoverCount ?? 0)
    : (buyerDashboard?.processingCount ?? 0);

  const inTransitCount = isSeller
    ? (sellerOrdersSummary?.inTransitCount ?? 0)
    : (buyerDashboard?.inTransitCount ?? 0);

  const readyForPickupCount = isSeller
    ? (sellerOrdersSummary?.readyForPickupCount ?? 0)
    : (buyerDashboard?.readyForPickupCount ?? 0);

  const deliveredCount = isSeller
    ? (sellerOrdersSummary?.deliveredCount ?? sellerDashboard?.deliveredOrdersCount ?? 0)
    : (buyerDashboard?.deliveredCount ?? 0);

  const returnedCount = isSeller
    ? (sellerOrdersSummary?.returnedCount ?? sellerDashboard?.returnedShipmentsCount ?? 0)
    : (buyerDashboard?.returnedCount ?? 0);

  const activeShipment = !isSeller && buyerDashboard?.activeShipment;

  const baseOrdersPath = isSeller ? '/seller/orders' : '/orders';

  const statusItems = [
    {
      key: 'Processing',
      label: t('profile.statusProcessing', 'قيد التجهيز'),
      icon: Clock,
      colorClass: 'text-amber-600',
      bgClass: 'bg-amber-50',
      badgeClass: 'bg-amber-600',
      borderClass: 'hover:border-amber-400',
      count: processingCount,
      path: `${baseOrdersPath}?status=Processing`,
    },
    {
      key: 'InTransit',
      label: t('profile.statusInTransit', 'في الطريق'),
      icon: Truck,
      colorClass: 'text-blue-600',
      bgClass: 'bg-blue-50',
      badgeClass: 'bg-blue-600',
      borderClass: 'hover:border-blue-400',
      count: inTransitCount,
      path: `${baseOrdersPath}?status=InTransit`,
    },
    {
      key: 'ReadyForPickup',
      label: t('profile.statusReadyPickup', 'نقطة الاستلام'),
      icon: Store,
      colorClass: 'text-purple-600',
      bgClass: 'bg-purple-50',
      badgeClass: 'bg-purple-600',
      borderClass: 'hover:border-purple-400',
      count: readyForPickupCount,
      path: `${baseOrdersPath}?status=ReadyForPickup`,
    },
    {
      key: 'Delivered',
      label: t('profile.statusDelivered', 'تم التوصيل'),
      icon: CheckCircle2,
      colorClass: 'text-emerald-600',
      bgClass: 'bg-emerald-50',
      badgeClass: 'bg-emerald-600',
      borderClass: 'hover:border-emerald-400',
      count: deliveredCount,
      path: `${baseOrdersPath}?status=Delivered`,
    },
    {
      key: 'Returned',
      label: t('profile.statusReturned', 'المرتجعات'),
      icon: RotateCcw,
      colorClass: 'text-red-600',
      bgClass: 'bg-red-50',
      badgeClass: 'bg-red-600',
      borderClass: 'hover:border-red-400',
      count: returnedCount,
      path: `${baseOrdersPath}?status=Returned`,
    },
  ];

  return (
    <div className="space-y-4">
      {/* 5-Status Overview Card */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-[#ECE9E6] shadow-sm">
        <div className="flex items-center justify-between border-b border-[#ECE9E6] pb-3 mb-4">
          <h2 className="text-sm font-black text-[#1F2329] flex items-center gap-2">
            <Package className="w-4 h-4 text-[#C8102E]" />
            <span>
              {isSeller
                ? t('profile.sellerOrdersHubTitle', 'متابعة طلبات وشحنات المتجر')
                : t('profile.buyerHubTitle', 'متابعة طلباتي وشحناتي')}
            </span>
          </h2>
          <Link
            to={baseOrdersPath}
            className="text-xs font-bold text-[#C8102E] hover:underline flex items-center gap-1"
          >
            <span>{t('profile.viewAllOrders', 'عرض كل الطلبات')}</span>
            {isRTL ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </Link>
        </div>

        {/* 5 Status Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {statusItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                to={item.path}
                className={`flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl border border-[#ECE9E6] ${item.borderClass} transition-all group text-center relative`}
              >
                {/* Count Badge */}
                {item.count > 0 && (
                  <span
                    className={`absolute top-2 start-2 text-[10px] font-black text-white px-2 py-0.5 rounded-full ${item.badgeClass} shadow-sm`}
                  >
                    {item.count}
                  </span>
                )}

                <div
                  className={`w-11 h-11 rounded-2xl ${item.bgClass} ${item.colorClass} flex items-center justify-center mb-2 group-hover:scale-105 transition-transform`}
                >
                  <Icon className="w-5 h-5" />
                </div>

                <span className="text-xs font-bold text-[#1F2329] line-clamp-1">
                  {item.label}
                </span>
                <span className="text-[11px] font-mono font-bold text-[#595F69] mt-0.5">
                  {item.count}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Buyer Active Shipment Live Stepper Card */}
      {activeShipment && (
        <div className="bg-[#FAF8F5] rounded-3xl p-5 sm:p-6 border border-[#ECE9E6] shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#ECE9E6] pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h3 className="text-sm font-black text-[#1F2329]">
                {t('profile.liveShipmentTitle', 'شحنة في طريقها إليك الآن')}
              </h3>
              <span className="text-xs font-bold text-[#D6A33A] bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                {t('profile.bostaCarrierTag', 'بوسطة Express 🇪🇬')}
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs text-[#595F69]">
              {activeShipment.trackingNumber && (
                <span className="font-mono font-bold">
                  {t('profile.trackingAirway', { number: activeShipment.trackingNumber, defaultValue: `بوليصة #${activeShipment.trackingNumber}` })}
                </span>
              )}
              {activeShipment.minEtaDays && activeShipment.maxEtaDays && (
                <span className="font-bold text-[#C8102E]">
                  {t('profile.etaDeliveryDays', {
                    min: activeShipment.minEtaDays,
                    max: activeShipment.maxEtaDays,
                    defaultValue: `التسليم خلال ${activeShipment.minEtaDays}–${activeShipment.maxEtaDays} أيام`,
                  })}
                </span>
              )}
            </div>
          </div>

          {/* Stepper Progress */}
          <div className="py-2">
            <div className="flex items-center justify-between relative">
              {/* Stepper background line */}
              <div className="absolute top-1/2 start-4 end-4 -translate-y-1/2 h-1 bg-[#ECE9E6] -z-0" />

              {[
                { step: 1, label: t('profile.stepOrderConfirmed', 'تأكيد الطلب') },
                { step: 2, label: t('profile.stepHandedBosta', 'تسليم لبوسطة') },
                { step: 3, label: t('profile.stepInTransit', 'في الطريق') },
                { step: 4, label: t('profile.stepPickup', 'نقطة الاستلام') },
                { step: 5, label: t('profile.stepDelivered', 'تم التوصيل') },
              ].map((stepItem) => {
                const isCurrent = activeShipment.currentStep === stepItem.step;
                const isCompleted = (activeShipment.currentStep || 1) >= stepItem.step;

                return (
                  <div key={stepItem.step} className="flex flex-col items-center z-10">
                    <div
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                        isCurrent
                          ? 'bg-[#C8102E] text-white ring-4 ring-red-100'
                          : isCompleted
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white text-[#595F69] border border-[#ECE9E6]'
                      }`}
                    >
                      {isCompleted ? <Check className="w-3.5 h-3.5" /> : stepItem.step}
                    </div>
                    <span
                      className={`text-[10px] sm:text-xs mt-1.5 font-bold ${
                        isCurrent ? 'text-[#C8102E]' : isCompleted ? 'text-emerald-700' : 'text-[#595F69]'
                      }`}
                    >
                      {stepItem.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer Info & Details Action */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-xs border-t border-[#ECE9E6]">
            {activeShipment.codAmount != null && (
              <div className="flex items-center gap-1.5 text-amber-900 bg-amber-100/60 px-3 py-1.5 rounded-xl border border-amber-200">
                <Banknote className="w-4 h-4 text-amber-700" />
                <span>
                  {t('profile.codAmountNeeded', 'المبلغ المطلوب تجهيزه كاش عند الاستلام:')}{' '}
                  <strong className="font-mono text-sm">{formatCurrency(activeShipment.codAmount)}</strong>
                </span>
              </div>
            )}

            <Link
              to={`/orders/${activeShipment.orderId || ''}`}
              className="font-bold text-[#C8102E] hover:underline self-end sm:self-auto flex items-center gap-1"
            >
              <span>{t('profile.trackDetails', 'تتبع وتفاصيل الشحنة بالكامل')}</span>
              {isRTL ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
