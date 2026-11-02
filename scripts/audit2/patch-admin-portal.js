const fs = require('fs');
const path = require('path');

const filePath = path.resolve('admin-web/src/pages/admin/AdminPortalPage.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add Truck to lucide-react import
content = content.replace(
  "  AlertCircle,\n} from 'lucide-react';",
  "  AlertCircle,\n  Truck,\n} from 'lucide-react';"
);

// 2. Add getAdminShipments, updateAdminShipmentStatus to adminApi import
content = content.replace(
  "  getAdminAuditLogs,\n} from '../../api/adminApi';",
  "  getAdminAuditLogs,\n  getAdminShipments,\n  updateAdminShipmentStatus,\n} from '../../api/adminApi';"
);

// 3. Add shipments state
const stateMarker = "  const [auditActionFilter, setAuditActionFilter] = useState('');";
const shipmentState = `  const [auditActionFilter, setAuditActionFilter] = useState('');

  // Shipments & Delivery Operations State (GAP-REL-03 & GAP-ADM-01)
  const [shipments, setShipments] = useState([]);
  const [shipmentsLoading, setShipmentsLoading] = useState(false);
  const [shipmentStatusFilter, setShipmentStatusFilter] = useState('');
  const [shipmentOrderFilter, setShipmentOrderFilter] = useState('');
  const [shipmentSellerFilter, setShipmentSellerFilter] = useState('');
  const [shipmentPage, setShipmentPage] = useState(1);
  const [shipmentTotalCount, setShipmentTotalCount] = useState(0);
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [showShipmentModal, setShowShipmentModal] = useState(false);
  const [newShipmentStatus, setNewShipmentStatus] = useState('');
  const [shipmentTrackingNumber, setShipmentTrackingNumber] = useState('');
  const [shipmentReturnReason, setShipmentReturnReason] = useState('');
  const [shipmentSettleCod, setShipmentSettleCod] = useState(false);
  const [shipmentReceivedAmount, setShipmentReceivedAmount] = useState('');
  const [shipmentSettlementRef, setShipmentSettlementRef] = useState('');
  const [shipmentAdminNotes, setShipmentAdminNotes] = useState('');
  const [shipmentActionLoading, setShipmentActionLoading] = useState(false);`;
content = content.replace(stateMarker, shipmentState);

// 4. Add shipment handler functions and hook into useEffect
const effectMarker = `  useEffect(() => {
    if (activeTab === 'reviews') {
      fetchReviews();
    } else if (activeTab === 'categories') {
      fetchCategories();
    } else if (activeTab === 'audit-logs') {
      fetchAuditLogs(1);
    } else if (activeTab === 'security') {
      fetchTwoFactorStatus();
    }
  }, [activeTab, reviewFilter, auditEntityTypeFilter, auditActionFilter]);`;

const shipmentHandlersAndEffect = `  const fetchShipments = async (page = 1) => {
    setShipmentsLoading(true);
    try {
      const res = await getAdminShipments({
        status: shipmentStatusFilter || undefined,
        orderId: shipmentOrderFilter ? parseInt(shipmentOrderFilter, 10) : undefined,
        sellerId: shipmentSellerFilter ? parseInt(shipmentSellerFilter, 10) : undefined,
        page,
        pageSize: 15,
      });
      setShipments(res.data.items || []);
      setShipmentTotalCount(res.data.totalCount || 0);
      setShipmentPage(res.data.page || 1);
    } catch (err) {
      console.error('Failed to load admin shipments:', err);
      setBannerMsg({
        type: 'error',
        text: err?.response?.data?.message || t('admin.loadDataError'),
      });
    } finally {
      setShipmentsLoading(false);
    }
  };

  const handleOpenShipmentModal = (s) => {
    setSelectedShipment(s);
    setNewShipmentStatus(s.status);
    setShipmentTrackingNumber(s.trackingNumber || '');
    setShipmentReturnReason(s.returnReason || '');
    setShipmentSettleCod(s.isCodSettled || false);
    setShipmentReceivedAmount(s.receivedAmount != null ? String(s.receivedAmount) : (s.codAmount ? String(s.codAmount) : ''));
    setShipmentSettlementRef(s.settlementReference || '');
    setShipmentAdminNotes('');
    setShowShipmentModal(true);
  };

  const handleUpdateShipmentStatus = async (e) => {
    e.preventDefault();
    if (!selectedShipment || shipmentActionLoading) return;
    setShipmentActionLoading(true);
    try {
      await updateAdminShipmentStatus(selectedShipment.id, {
        status: newShipmentStatus,
        trackingNumber: shipmentTrackingNumber.trim() || undefined,
        returnReason: shipmentReturnReason || undefined,
        settleCod: shipmentSettleCod,
        receivedAmount: shipmentReceivedAmount ? parseFloat(shipmentReceivedAmount) : undefined,
        settlementReference: shipmentSettlementRef.trim() || undefined,
        adminNotes: shipmentAdminNotes.trim() || undefined,
      });
      setBannerMsg({
        type: 'success',
        text: isRTL ? 'تم تحديث حالة الشحنة بنجاح' : 'Shipment updated successfully.',
      });
      setShowShipmentModal(false);
      await fetchShipments(shipmentPage);
    } catch (err) {
      console.error('Failed to update shipment status:', err);
      setBannerMsg({
        type: 'error',
        text: err?.response?.data?.message || (isRTL ? 'فشل تحديث الشحنة' : 'Failed to update shipment'),
      });
    } finally {
      setShipmentActionLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'reviews') {
      fetchReviews();
    } else if (activeTab === 'categories') {
      fetchCategories();
    } else if (activeTab === 'audit-logs') {
      fetchAuditLogs(1);
    } else if (activeTab === 'security') {
      fetchTwoFactorStatus();
    } else if (activeTab === 'shipments') {
      fetchShipments(1);
    }
  }, [activeTab, reviewFilter, auditEntityTypeFilter, auditActionFilter, shipmentStatusFilter, shipmentOrderFilter, shipmentSellerFilter]);`;

content = content.replace(effectMarker, shipmentHandlersAndEffect);

// 5. Add button in navigation tabs bar after payouts button
const payoutsTabMarker = `          <button
            onClick={() => setActiveTab('payouts')}
            className={\`px-4 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap \${
              activeTab === 'payouts'
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/30 font-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }\`}
          >
            <CreditCard className="w-4 h-4" />
            <span>{t('admin.vendorPayouts')}</span>
          </button>`;

const shipmentsTabButton = `${payoutsTabMarker}

          <button
            onClick={() => setActiveTab('shipments')}
            className={\`px-4 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap \${
              activeTab === 'shipments'
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/30 font-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }\`}
          >
            <Truck className="w-4 h-4" />
            <span>{t('adminPortal.tabs.shipments', isRTL ? 'إدارة الشحنات والتوصيل' : 'Shipments & Delivery')}</span>
          </button>`;

content = content.replace(payoutsTabMarker, shipmentsTabButton);

// 6. Add Shipments tab view before {/* MODAL: SETUP 2FA */}
const modalSetupMarker = "      {/* MODAL: SETUP 2FA */}";
const shipmentsTabView = `      {/* TAB 8: SHIPMENTS & OPERATIONS (GAP-REL-03 & GAP-ADM-01) */}
      {activeTab === 'shipments' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Truck className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="font-black text-base text-slate-900">
                    {t('adminPortal.shipments.title', isRTL ? 'إدارة الشحنات والعمليات الميدانية' : 'Shipments & Field Operations')}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {t('adminPortal.shipments.subtitle', isRTL ? 'متابعة بوالص الشحن وتحديث حالات التوصيل وتسوية نقدية الدفع عند الاستلام (COD)' : 'Track waybills, update carrier delivery status, and settle COD remittance')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => fetchShipments(shipmentPage)}
                disabled={shipmentsLoading}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-2 transition-all self-start sm:self-auto"
              >
                <RefreshCw className={\`w-3.5 h-3.5 \${shipmentsLoading ? 'animate-spin' : ''}\`} />
                <span>{t('common.refresh')}</span>
              </button>
            </div>

            {/* Shipment Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs">
              <div>
                <label className="block font-bold text-slate-600 mb-1">
                  {t('common.status')}
                </label>
                <select
                  value={shipmentStatusFilter}
                  onChange={(e) => setShipmentStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium text-slate-800 outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="">{t('common.all') || (isRTL ? 'كافة الحالات' : 'All Statuses')}</option>
                  <option value="Created">{isRTL ? 'تم إنشاء الشحنة' : 'Created'}</option>
                  <option value="HandedToCarrier">{isRTL ? 'سُلمت لشركة الشحن' : 'Handed to Carrier'}</option>
                  <option value="InTransit">{isRTL ? 'في الطريق للتسليم' : 'In Transit'}</option>
                  <option value="ReadyForPickup">{isRTL ? 'جاهزة للاستلام' : 'Ready for Pickup'}</option>
                  <option value="Delivered">{isRTL ? 'تم التسليم بنجاح' : 'Delivered'}</option>
                  <option value="Returned">{isRTL ? 'مرتجع / رفض استلام' : 'Returned'}</option>
                  <option value="Cancelled">{isRTL ? 'ملغاة' : 'Cancelled'}</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1">
                  {isRTL ? 'رقم الطلب' : 'Order ID'}
                </label>
                <input
                  type="number"
                  value={shipmentOrderFilter}
                  onChange={(e) => setShipmentOrderFilter(e.target.value)}
                  placeholder={isRTL ? 'مثال: 105' : 'e.g. 105'}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium text-slate-800 outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1">
                  {isRTL ? 'معرّف البائع' : 'Seller ID'}
                </label>
                <input
                  type="number"
                  value={shipmentSellerFilter}
                  onChange={(e) => setShipmentSellerFilter(e.target.value)}
                  placeholder={isRTL ? 'مثال: 4' : 'e.g. 4'}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium text-slate-800 outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => {
                    setShipmentStatusFilter('');
                    setShipmentOrderFilter('');
                    setShipmentSellerFilter('');
                  }}
                  className="w-full px-4 py-2 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl font-bold transition-colors"
                >
                  {t('common.reset')}
                </button>
              </div>
            </div>

            {/* Shipments List */}
            {shipmentsLoading ? (
              <div className="py-12 flex justify-center items-center text-slate-400 gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-red-600" />
                <span className="text-xs font-bold">{t('common.loading')}</span>
              </div>
            ) : shipments.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <Package className="w-10 h-10 mx-auto text-slate-300" />
                <p className="text-xs font-bold">{isRTL ? 'لا توجد شحنات مطابقة للبحث' : 'No shipments found'}</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100">
                    <tr>
                      <th className="p-3.5 whitespace-nowrap">{isRTL ? 'الشحنة / الطلب' : 'Shipment / Order'}</th>
                      <th className="p-3.5 whitespace-nowrap">{isRTL ? 'المستلم والعنوان المصري' : 'Recipient & Detailed Address'}</th>
                      <th className="p-3.5 whitespace-nowrap">{isRTL ? 'البائع والأصناف' : 'Seller & Items'}</th>
                      <th className="p-3.5 whitespace-nowrap">{isRTL ? 'المبالغ وتسوية COD' : 'Financials & COD'}</th>
                      <th className="p-3.5 whitespace-nowrap">{isRTL ? 'الحالة والمعاينة' : 'Status & Inspection'}</th>
                      <th className="p-3.5 whitespace-nowrap text-center">{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {shipments.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3.5 align-top">
                          <div className="font-black text-slate-900">#{s.id}</div>
                          <div className="text-[11px] text-slate-500 font-bold mt-0.5">
                            {isRTL ? 'الطلب:' : 'Order:'} #{s.orderId}
                          </div>
                          {s.trackingNumber && (
                            <div className="text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded font-mono mt-1 inline-block">
                              AWB: {s.trackingNumber}
                            </div>
                          )}
                          <div className="text-[10px] text-slate-400 mt-1">
                            {new Date(s.createdAt).toLocaleDateString('ar-EG')}
                          </div>
                        </td>

                        <td className="p-3.5 align-top max-w-xs">
                          <div className="font-bold text-slate-800">{s.recipientName || s.buyerName}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5" dir="ltr">
                            {s.recipientPhone || s.buyerPhone}
                          </div>
                          <div className="text-[11px] text-slate-600 mt-1">
                            {s.governorate} • {s.city} {s.area ? \`• \${s.area}\` : ''}
                          </div>
                          {/* Egyptian Detailed Address Fields (GAP-LOG-04) */}
                          <div className="flex flex-wrap gap-1 mt-1 text-[10px]">
                            {s.buildingNumber && (
                              <span className="bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-medium">
                                {isRTL ? 'عمارة:' : 'Bldg:'} {s.buildingNumber}
                              </span>
                            )}
                            {s.floor && (
                              <span className="bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-medium">
                                {isRTL ? 'دور:' : 'Floor:'} {s.floor}
                              </span>
                            )}
                            {s.apartment && (
                              <span className="bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-medium">
                                {isRTL ? 'شقة:' : 'Apt:'} {s.apartment}
                              </span>
                            )}
                            {s.landmark && (
                              <span className="bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.2 rounded font-medium">
                                📍 {s.landmark}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="p-3.5 align-top max-w-xs">
                          <div className="font-bold text-slate-800">{s.sellerName}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {s.items?.length || 0} {isRTL ? 'أصناف:' : 'items:'}
                          </div>
                          <ul className="text-[10px] text-slate-600 list-disc list-inside mt-1 space-y-0.5">
                            {s.items?.slice(0, 2).map((item, idx) => (
                              <li key={idx} className="truncate">
                                {item.quantity}x {item.productName}
                              </li>
                            ))}
                            {(s.items?.length || 0) > 2 && (
                              <li className="text-slate-400 font-bold">
                                +{(s.items?.length || 0) - 2} {isRTL ? 'آخرين...' : 'more...'}
                              </li>
                            )}
                          </ul>
                        </td>

                        <td className="p-3.5 align-top">
                          <div className="font-bold text-slate-800">
                            {formatCurrency(s.codAmount || s.deliveryCost)}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {isRTL ? 'الشحن:' : 'Delivery:'} {formatCurrency(s.deliveryCost)}
                          </div>
                          <div className="mt-1">
                            {s.isCodSettled ? (
                              <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                                <CheckCircle className="w-3 h-3" />
                                {isRTL ? 'تمت التسوية' : 'Settled'}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                                <Clock className="w-3 h-3" />
                                {isRTL ? 'بانتظار التوريد' : 'Unsettled'}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="p-3.5 align-top">
                          <div>
                            <span
                              className={\`inline-block text-[10px] font-black px-2.5 py-0.5 rounded-full \${
                                s.status === 'Delivered'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : s.status === 'Returned'
                                  ? 'bg-rose-100 text-rose-800'
                                  : s.status === 'InTransit'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-slate-100 text-slate-800'
                              }\`}
                            >
                              {s.status}
                            </span>
                          </div>
                          {s.returnReason && (
                            <div className="text-[10px] text-rose-600 font-bold mt-1">
                              ⚠️ {s.returnReason}
                            </div>
                          )}
                          {s.allowInspection && (
                            <div className="mt-1.5">
                              <span className="inline-flex items-center gap-1 text-[9px] bg-teal-50 text-teal-800 border border-teal-200 px-1.5 py-0.2 rounded font-bold">
                                🔍 {isRTL ? 'معاينة عند الاستلام' : 'Open Box'}
                              </span>
                            </div>
                          )}
                        </td>

                        <td className="p-3.5 align-top text-center">
                          <button
                            type="button"
                            onClick={() => handleOpenShipmentModal(s)}
                            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all whitespace-nowrap"
                          >
                            {isRTL ? 'تعديل / تسوية' : 'Manage'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {shipmentTotalCount > 15 && (
              <div className="flex items-center justify-between text-xs text-slate-500 pt-4 border-t border-slate-100">
                <div>
                  {isRTL ? 'إجمالي الشحنات:' : 'Total:'} <span className="font-bold text-slate-800">{shipmentTotalCount}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fetchShipments(shipmentPage - 1)}
                    disabled={shipmentPage <= 1 || shipmentsLoading}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 disabled:opacity-40 hover:bg-slate-50 transition-colors"
                  >
                    {t('common.previous')}
                  </button>
                  <span className="font-bold text-slate-800 px-2">{shipmentPage}</span>
                  <button
                    onClick={() => fetchShipments(shipmentPage + 1)}
                    disabled={shipmentPage * 15 >= shipmentTotalCount || shipmentsLoading}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 disabled:opacity-40 hover:bg-slate-50 transition-colors"
                  >
                    {t('common.next')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: SETUP 2FA */}`;

content = content.replace(modalSetupMarker, shipmentsTabView);

// 7. Add Modal for updating shipment status before the final </div>
const fileEndMarker = `              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}`;

const shipmentModalAndEnd = `              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: UPDATE SHIPMENT STATUS & COD SETTLEMENT (GAP-REL-03 & GAP-ADM-01) */}
      {showShipmentModal && selectedShipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <Truck className="w-4 h-4 text-red-600" />
                <span>
                  {isRTL
                    ? \`تحديث الشحنة #\${selectedShipment.id} (الطلب #\${selectedShipment.orderId})\`
                    : \`Update Shipment #\${selectedShipment.id} (Order #\${selectedShipment.orderId})\`}
                </span>
              </h3>
              <button
                onClick={() => setShowShipmentModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateShipmentStatus} className="space-y-4 text-xs">
              {/* Status Select */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {isRTL ? 'حالة الشحنة الجديدة' : 'New Shipment Status'}
                </label>
                <select
                  value={newShipmentStatus}
                  onChange={(e) => setNewShipmentStatus(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium text-slate-800 outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="HandedToCarrier">{isRTL ? 'سُلمت لشركة الشحن (HandedToCarrier)' : 'HandedToCarrier'}</option>
                  <option value="InTransit">{isRTL ? 'في الطريق للتسليم (InTransit)' : 'InTransit'}</option>
                  <option value="ReadyForPickup">{isRTL ? 'جاهزة للاستلام في الفرع (ReadyForPickup)' : 'ReadyForPickup'}</option>
                  <option value="Delivered">{isRTL ? 'تم التسليم الفعلي للمشتري (Delivered)' : 'Delivered'}</option>
                  <option value="Returned">{isRTL ? 'مرتجع / رفض الاستلام (Returned)' : 'Returned'}</option>
                  <option value="Cancelled">{isRTL ? 'ملغاة (Cancelled)' : 'Cancelled'}</option>
                </select>
              </div>

              {/* Tracking Number Input */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {isRTL ? 'رقم بوليصة التتبع (Tracking Number / AWB)' : 'Tracking Number / AWB'}
                </label>
                <input
                  type="text"
                  value={shipmentTrackingNumber}
                  onChange={(e) => setShipmentTrackingNumber(e.target.value)}
                  placeholder="e.g. BST-9823471"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-slate-800 outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              {/* If Returned: Return Reason Select */}
              {newShipmentStatus === 'Returned' && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                  <label className="block font-bold text-rose-800">
                    {isRTL ? 'سبب رفض الاستلام / الإرجاع (GAP-ORD-05 & GAP-ADM-02)' : 'Return / Refusal Reason'}
                  </label>
                  <select
                    value={shipmentReturnReason}
                    onChange={(e) => setShipmentReturnReason(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-rose-300 bg-white font-medium text-slate-800 outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <option value="RefusedByBuyer">{isRTL ? 'رفض المشتري الاستلام عند الباب (يحسب في سجل إساءة COD)' : 'Refused by Buyer (Counts towards COD abuse limit)'}</option>
                    <option value="DefectiveItem">{isRTL ? 'عيب مصنعي أو تلف في المنتج' : 'Defective Item'}</option>
                    <option value="WrongItem">{isRTL ? 'منتج غير مطابق للمواصفات' : 'Wrong Item'}</option>
                    <option value="BuyerNotAvailable">{isRTL ? 'المشتري غير متواجد / الهاتف مغلق' : 'Buyer Not Available'}</option>
                    <option value="CarrierDelayed">{isRTL ? 'تأخر شركة الشحن عن الموعد' : 'Carrier Delayed'}</option>
                    <option value="Other">{isRTL ? 'أسباب أخرى' : 'Other'}</option>
                  </select>
                  <p className="text-[10px] text-rose-600">
                    {isRTL
                      ? 'ملاحظة: اختيار "رفض المشتري" يزيد عداد الرفض الكيدي للمشتري، وعند تكراره يتم حجب خيار COD تلقائياً.'
                      : 'Note: Selecting "Refused by Buyer" increments the buyer COD refusal count and blocks COD after threshold.'}
                  </p>
                </div>
              )}

              {/* COD Settlement Section */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="settleCodCheck"
                    checked={shipmentSettleCod}
                    onChange={(e) => setShipmentSettleCod(e.target.checked)}
                    className="w-4 h-4 text-red-600 rounded border-slate-300 focus:ring-red-500"
                  />
                  <label htmlFor="settleCodCheck" className="font-bold text-slate-800 cursor-pointer">
                    {isRTL ? 'تأكيد توريد وتسوية نقدية الدفع عند الاستلام (COD Remittance)' : 'Confirm COD Remittance & Settlement'}
                  </label>
                </div>

                {shipmentSettleCod && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                    <div>
                      <label className="block font-bold text-slate-600 mb-1">
                        {isRTL ? 'المبلغ المحصل فعلياً (ج.م)' : 'Received Amount (EGP)'}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={shipmentReceivedAmount}
                        onChange={(e) => setShipmentReceivedAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono text-slate-800 outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-600 mb-1">
                        {isRTL ? 'رقم مرجع التسوية البنكية' : 'Settlement Reference'}
                      </label>
                      <input
                        type="text"
                        value={shipmentSettlementRef}
                        onChange={(e) => setShipmentSettlementRef(e.target.value)}
                        placeholder="e.g. CIB-DEP-2026-09"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono text-slate-800 outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Admin Notes */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {isRTL ? 'ملاحظات الإدارة' : 'Admin Notes'}
                </label>
                <textarea
                  rows={2}
                  value={shipmentAdminNotes}
                  onChange={(e) => setShipmentAdminNotes(e.target.value)}
                  placeholder={isRTL ? 'أي تفاصيل تشغيلية أو أسباب إدارية للتعديل...' : 'Operational notes...'}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-800 outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowShipmentModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={shipmentActionLoading}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-md disabled:opacity-50"
                >
                  {shipmentActionLoading ? t('common.loading') : (isRTL ? 'حفظ التحديث' : 'Save Update')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}`;

content = content.replace(fileEndMarker, shipmentModalAndEnd);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully patched AdminPortalPage.jsx');
