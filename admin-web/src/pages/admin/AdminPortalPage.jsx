import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ShieldCheck,
  TrendingUp,
  Users,
  Package,
  RotateCcw,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  RefreshCw,
  Building,
  Phone,
  UserCheck,
  UserX,
  CreditCard,
  DollarSign,
  ArrowUpRight,
  ShieldAlert,
  Star,
  MessageSquare,
  Eye,
  EyeOff,
  Flag,
  ChevronDown,
  ChevronUp,
  Layers,
  Plus,
  Trash2,
  Edit3,
  ClipboardList,
  Lock,
  Key,
  Copy,
  Check,
  AlertCircle,
} from 'lucide-react';
import {
  getAdminStats,
  getAdminUsers,
  updateUserStatus,
  getAdminPayouts,
  processAdminPayout,
  getReportedReviews,
  hideReview,
  unhideReview,
  getAdminAuditLogs,
} from '../../api/adminApi';
import {
  getTwoFactorStatus,
  setupTwoFactor,
  enableTwoFactor,
  disableTwoFactor,
} from '../../api/authApi';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../../api/categoriesApi';
import { formatCurrency } from '../../utils/currency';
import { getImageUrl, handleImageError } from '../../utils/imageUrl';
import {
  getRoleLabel,
  getPayoutStatusLabel,
  getPayoutMethodLabel,
} from '../../utils/enumTranslations';

export default function AdminPortalPage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [activeTab, setActiveTab] = useState('kpis'); // 'kpis' | 'users' | 'payouts' | 'reviews'
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Stats State
  const [stats, setStats] = useState(null);

  // Users State
  const [users, setUsers] = useState([]);
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusReason, setStatusReason] = useState('');
  const [statusLoading, setStatusLoading] = useState(false);

  // Payouts State
  const [payouts, setPayouts] = useState([]);
  const [payoutStatusFilter, setPayoutStatusFilter] = useState('');
  const [selectedPayout, setSelectedPayout] = useState(null);
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [processStatus, setProcessStatus] = useState('Completed'); // 'Completed' | 'Rejected'
  const [adminNotes, setAdminNotes] = useState('');
  const [processLoading, setProcessLoading] = useState(false);

  // Reported Reviews Moderation State
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewFilter, setReviewFilter] = useState('ALL'); // 'ALL' | 'VISIBLE' | 'HIDDEN'
  const [expandedReports, setExpandedReports] = useState({});
  const [modLoadingId, setModLoadingId] = useState(null);

  // Categories State
  const [categoriesList, setCategoriesList] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryForm, setCategoryForm] = useState({
    nameAr: '',
    nameEn: '',
    displayOrder: 0,
    isActive: true,
  });
  const [categorySubmitting, setCategorySubmitting] = useState(false);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalCount, setAuditTotalCount] = useState(0);
  const [auditEntityTypeFilter, setAuditEntityTypeFilter] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('');

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
  const [shipmentActionLoading, setShipmentActionLoading] = useState(false);

  // Notification message
  const [bannerMsg, setBannerMsg] = useState(null);

  // 2FA Security State
  const [twoFactorStatus, setTwoFactorStatus] = useState(null);
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [setupData, setSetupData] = useState(null);
  const [setupCode, setSetupCode] = useState('');
  const [setupSubmitting, setSetupSubmitting] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableSubmitting, setDisableSubmitting] = useState(false);

  // Fetch initial data
  const fetchData = async () => {
    setRefreshing(true);
    try {
      const [statsRes, usersRes, payoutsRes] = await Promise.all([
        getAdminStats(),
        getAdminUsers({
          role: userRoleFilter || undefined,
          isActive: userStatusFilter === '' ? undefined : userStatusFilter === 'true',
        }),
        getAdminPayouts(payoutStatusFilter || undefined),
      ]);
      setStats(statsRes.data);
      setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
      setPayouts(Array.isArray(payoutsRes.data) ? payoutsRes.data : []);
      if (activeTab === 'reviews') {
        await fetchReviews();
      }
    } catch (err) {
      console.error('Failed to load admin portal data:', err);
      setBannerMsg({
        type: 'error',
        text: t('admin.loadDataError'),
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchReviews = async () => {
    setReviewsLoading(true);
    try {
      const params = {};
      if (reviewFilter === 'VISIBLE') params.isHidden = false;
      else if (reviewFilter === 'HIDDEN') params.isHidden = true;

      const res = await getReportedReviews(params);
      setReviews(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load reported reviews:', err);
      setBannerMsg({
        type: 'error',
        text: err?.response?.data?.message || t('admin.loadDataError'),
      });
    } finally {
      setReviewsLoading(false);
    }
  };

  const handleToggleHideReview = async (review) => {
    if (modLoadingId) return;
    setModLoadingId(review.id);
    try {
      if (review.isHidden) {
        await unhideReview(review.id);
        setBannerMsg({
          type: 'success',
          text: isRTL ? 'تم إلغاء حجب التقييم بنجاح وإعادته للظهور' : 'Review unhidden successfully.',
        });
      } else {
        await hideReview(review.id);
        setBannerMsg({
          type: 'success',
          text: isRTL ? 'تم حجب التقييم واستبعاده من احتساب تقييم المنتج' : 'Review hidden and excluded from rating calculations.',
        });
      }
      await fetchReviews();
    } catch (err) {
      setBannerMsg({
        type: 'error',
        text: err?.response?.data?.message || t('common.error'),
      });
    } finally {
      setModLoadingId(null);
    }
  };

  const toggleReportsExpand = (reviewId) => {
    setExpandedReports((prev) => ({
      ...prev,
      [reviewId]: !prev[reviewId],
    }));
  };

  useEffect(() => {
    fetchData();
  }, [userRoleFilter, userStatusFilter, payoutStatusFilter]);

  useEffect(() => {
    if (activeTab === 'reviews') {
      fetchReviews();
    } else if (activeTab === 'categories') {
      fetchCategories();
    } else if (activeTab === 'audit-logs') {
      fetchAuditLogs(1);
    } else if (activeTab === 'security') {
      fetchTwoFactorStatus();
    }
  }, [activeTab, reviewFilter, auditEntityTypeFilter, auditActionFilter]);

  const fetchTwoFactorStatus = async () => {
    setTwoFactorLoading(true);
    try {
      const res = await getTwoFactorStatus();
      setTwoFactorStatus(res.data);
    } catch (err) {
      console.error('Failed to load 2FA status:', err);
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleStartSetup = async () => {
    setSetupSubmitting(true);
    try {
      const res = await setupTwoFactor();
      setSetupData(res.data);
      setSetupCode('');
      setShowSetupModal(true);
    } catch (err) {
      console.error('Failed to start 2FA setup:', err);
      setBannerMsg({ type: 'error', text: err?.response?.data?.message || t('common.error') });
    } finally {
      setSetupSubmitting(false);
    }
  };

  const handleConfirmEnable = async (e) => {
    e.preventDefault();
    if (!setupCode || setupCode.trim().length !== 6) return;
    setSetupSubmitting(true);
    try {
      await enableTwoFactor({
        secret: setupData.secret || setupData.manualEntryKey || setupData.secretKey,
        code: setupCode.trim(),
      });
      setShowSetupModal(false);
      setBannerMsg({ type: 'success', text: t('adminPortal.twoFactor.enabledSuccess') });
      fetchTwoFactorStatus();
    } catch (err) {
      console.error('Failed to enable 2FA:', err);
      setBannerMsg({ type: 'error', text: err?.response?.data?.message || t('common.error') });
    } finally {
      setSetupSubmitting(false);
    }
  };

  const handleConfirmDisable = async (e) => {
    e.preventDefault();
    if (!disablePassword) return;
    setDisableSubmitting(true);
    try {
      await disableTwoFactor({ password: disablePassword });
      setShowDisableModal(false);
      setDisablePassword('');
      setBannerMsg({ type: 'success', text: t('adminPortal.twoFactor.disabledSuccess') });
      fetchTwoFactorStatus();
    } catch (err) {
      console.error('Failed to disable 2FA:', err);
      setBannerMsg({ type: 'error', text: err?.response?.data?.message || t('common.error') });
    } finally {
      setDisableSubmitting(false);
    }
  };

  const fetchAuditLogs = async (page = 1) => {
    setAuditLoading(true);
    try {
      const res = await getAdminAuditLogs({
        page,
        pageSize: 30,
        entityType: auditEntityTypeFilter || undefined,
        action: auditActionFilter || undefined,
      });
      if (res?.data?.items) {
        setAuditLogs(res.data.items);
        setAuditTotalCount(res.data.totalCount || 0);
        setAuditPage(res.data.page || page);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setAuditLoading(false);
    }
  };

  const fetchCategories = async () => {
    setCategoriesLoading(true);
    try {
      const res = await getCategories(true);
      if (res && Array.isArray(res.data)) {
        setCategoriesList(res.data);
      }
    } catch (err) {
      console.error('Failed to load categories:', err);
    } finally {
      setCategoriesLoading(false);
    }
  };

  const handleOpenAddCategory = () => {
    setEditingCategory(null);
    setCategoryForm({
      nameAr: '',
      nameEn: '',
      displayOrder: categoriesList.length + 1,
      isActive: true,
    });
    setShowCategoryModal(true);
  };

  const handleOpenEditCategory = (cat) => {
    setEditingCategory(cat);
    setCategoryForm({
      nameAr: cat.nameAr || '',
      nameEn: cat.nameEn || '',
      displayOrder: cat.displayOrder ?? 0,
      isActive: cat.isActive !== false,
    });
    setShowCategoryModal(true);
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    if (!categoryForm.nameAr.trim() || !categoryForm.nameEn.trim()) return;
    setCategorySubmitting(true);
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, {
          nameAr: categoryForm.nameAr.trim(),
          nameEn: categoryForm.nameEn.trim(),
          displayOrder: Number(categoryForm.displayOrder) || 0,
          isActive: Boolean(categoryForm.isActive),
        });
      } else {
        await createCategory({
          nameAr: categoryForm.nameAr.trim(),
          nameEn: categoryForm.nameEn.trim(),
          displayOrder: Number(categoryForm.displayOrder) || 0,
          isActive: Boolean(categoryForm.isActive),
        });
      }
      setShowCategoryModal(false);
      setBannerMsg({
        type: 'success',
        text: t('categoriesAdmin.saveSuccess'),
      });
      fetchCategories();
    } catch (err) {
      console.error('Failed to save category:', err);
      const errMsg = err?.response?.data?.message || err?.message || 'Failed to save category';
      setBannerMsg({
        type: 'error',
        text: errMsg,
      });
    } finally {
      setCategorySubmitting(false);
    }
  };

  const handleDeleteCategory = async (cat) => {
    const confirmMsg = t('categoriesAdmin.deleteConfirm');
    if (!window.confirm(confirmMsg)) return;
    try {
      await deleteCategory(cat.id);
      setBannerMsg({
        type: 'success',
        text: t('categoriesAdmin.deleteSuccess'),
      });
      fetchCategories();
    } catch (err) {
      console.error('Failed to delete category:', err);
      const errMsg = err?.response?.data?.message || t('categoriesAdmin.hasProductsError');
      setBannerMsg({
        type: 'error',
        text: errMsg,
      });
    }
  };

  // Handle User Status Update
  const handleUpdateUserStatus = async (e) => {
    e.preventDefault();
    if (statusLoading || !selectedUser) return;
    setStatusLoading(true);
    try {
      const nextActiveState = !selectedUser.isActive;
      await updateUserStatus(selectedUser.id, {
        isActive: nextActiveState,
        reason: statusReason.trim() || undefined,
      });

      setBannerMsg({
        type: 'success',
        text: t('admin.userUpdatedSuccess', { id: selectedUser.id }),
      });

      setShowStatusModal(false);
      setSelectedUser(null);
      setStatusReason('');

      // Refresh users
      const usersRes = await getAdminUsers({
        role: userRoleFilter || undefined,
        isActive: userStatusFilter === '' ? undefined : userStatusFilter === 'true',
      });
      setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
    } catch (err) {
      setBannerMsg({
        type: 'error',
        text: err?.response?.data?.message || t('admin.userStatusError'),
      });
    } finally {
      setStatusLoading(false);
    }
  };

  // Handle Payout Processing
  const handleProcessPayout = async (e) => {
    e.preventDefault();
    if (processLoading || !selectedPayout) return;
    setProcessLoading(true);
    try {
      await processAdminPayout(selectedPayout.id, {
        status: processStatus,
        adminNotes: adminNotes.trim() || undefined,
      });

      setBannerMsg({
        type: 'success',
        text: t('admin.payoutUpdatedSuccess', {
          id: selectedPayout.id,
          status: getPayoutStatusLabel(processStatus, t),
        }),
      });

      setShowProcessModal(false);
      setSelectedPayout(null);
      setAdminNotes('');

      // Refresh payouts & stats
      const [payoutsRes, statsRes] = await Promise.all([
        getAdminPayouts(payoutStatusFilter || undefined),
        getAdminStats(),
      ]);
      setPayouts(Array.isArray(payoutsRes.data) ? payoutsRes.data : []);
      setStats(statsRes.data);
    } catch (err) {
      setBannerMsg({
        type: 'error',
        text: err?.response?.data?.message || t('admin.payoutError'),
      });
    } finally {
      setProcessLoading(false);
    }
  };

  // Filter Users in Memory by Search
  const filteredUsers = users.filter((u) => {
    if (!userSearch.trim()) return true;
    const term = userSearch.toLowerCase();
    return (
      u.name?.toLowerCase().includes(term) ||
      u.email?.toLowerCase().includes(term) ||
      u.contactPhone?.toLowerCase().includes(term) ||
      u.dispatchCity?.toLowerCase().includes(term) ||
      String(u.id).includes(term)
    );
  });

  return (
    <div className="space-y-6 pb-20">
      {/* Top Header */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 end-0 -mt-8 -me-8 w-60 h-60 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                {t('admin.superAdminPortal')}
              </span>
              <span className="text-xs text-slate-400 font-mono">PDPL 151/2020 Compliance</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black">
              {t('admin.centralAdmin')}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
              {t('admin.adminDescription')}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchData}
              disabled={refreshing}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-2 border border-slate-700 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 text-orange-400 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{t('common.refresh')}</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 sm:gap-4 mt-6 pt-6 border-t border-slate-800 overflow-x-auto text-xs font-bold">
          <button
            onClick={() => setActiveTab('kpis')}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'kpis'
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/30 font-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>{t('admin.platformKpis')}</span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'users'
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/30 font-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>{t('admin.usersAndVendors')}</span>
          </button>

          <button
            onClick={() => setActiveTab('payouts')}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'payouts'
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/30 font-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>{t('admin.vendorPayouts')}</span>
          </button>

          <button
            onClick={() => setActiveTab('reviews')}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'reviews'
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/30 font-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>{isRTL ? 'مراجعة البلاغات والتقييمات' : 'Reported Reviews'}</span>
            {reviews.length > 0 && (
              <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
                {reviews.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('categories')}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'categories'
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/30 font-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>{t('categoriesAdmin.title')}</span>
          </button>

          <button
            onClick={() => setActiveTab('audit-logs')}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'audit-logs'
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/30 font-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            <span>{t('adminPortal.tabs.auditLogs')}</span>
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'security'
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/30 font-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{t('adminPortal.tabs.security')}</span>
          </button>
        </div>
      </div>

      {/* Floating Status Banner */}
      {bannerMsg && (
        <div
          className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between shadow-sm animate-in fade-in ${
            bannerMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {bannerMsg.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            )}
            <span>{bannerMsg.text}</span>
          </div>
          <button
            onClick={() => setBannerMsg(null)}
            className="text-slate-400 hover:text-slate-600"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TAB 1: PLATFORM KPIS & FINANCIALS */}
      {activeTab === 'kpis' && (
        <div className="space-y-6">
          {/* High-Level Financial & Volume Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total GMV / Volume */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">
                  {t('admin.totalGmv')}
                </span>
                <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-black text-slate-900 mt-2">
                {formatCurrency(stats?.totalVolume || 0)}
              </p>
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-bold mt-2">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>{t('admin.successfulVolume')}</span>
              </div>
            </div>

            {/* Total Orders */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">
                  {t('admin.totalOrdersPlaced')}
                </span>
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-black text-slate-900 mt-2">
                {stats?.totalOrders || 0}
              </p>
              <span className="text-[11px] text-slate-400 block mt-2">
                {t('admin.combinedOrders')}
              </span>
            </div>

            {/* Active Products */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">
                  {t('admin.activeCatalogProducts')}
                </span>
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-black text-slate-900 mt-2">
                {stats?.totalActiveProducts || 0}
              </p>
              <span className="text-[11px] text-slate-400 block mt-2">
                {t('admin.liveInStorefront')}
              </span>
            </div>

            {/* Refused COD Orders */}
            <div className="bg-white rounded-3xl p-6 border border-red-200/80 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-red-600">
                  {t('admin.refusedCodTitle')}
                </span>
                <div className="w-8 h-8 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
                  <RotateCcw className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-black text-red-700 mt-2">
                {stats?.totalRefusedCodOrders || 0}
              </p>
              <span className="text-[11px] text-red-500 block mt-2 font-bold">
                {stats?.totalOrders > 0
                  ? `${((stats.totalRefusedCodOrders / stats.totalOrders) * 100).toFixed(1)}% ${t('admin.refusalRate')}`
                  : t('admin.zeroRefusals')}
              </span>
            </div>
          </div>

          {/* User Demographics & Roles Breakdown */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-red-600" />
              <span>{t('admin.userDemographics')}</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-xs text-slate-500 font-bold block">
                  {t('admin.totalRegisteredUsers')}
                </span>
                <span className="text-3xl font-black text-slate-900 block mt-1">
                  {stats?.totalUsers || 0}
                </span>
                <span className="text-[11px] text-slate-400 block mt-1">
                  {t('admin.pdplCompliance')}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200">
                <span className="text-xs text-blue-700 font-bold block">
                  {t('admin.registeredBuyers')}
                </span>
                <span className="text-3xl font-black text-blue-900 block mt-1">
                  {stats?.totalBuyers || 0}
                </span>
                <span className="text-[11px] text-blue-600 block mt-1">
                  {stats?.totalUsers > 0
                    ? `${Math.round(((stats.totalBuyers || 0) / stats.totalUsers) * 100)}% ${t('admin.ofTotalUsers')}`
                    : ''}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-orange-50/60 border border-orange-200">
                <span className="text-xs text-orange-700 font-bold block">
                  {t('admin.approvedVendors')}
                </span>
                <span className="text-3xl font-black text-orange-900 block mt-1">
                  {stats?.totalSellers || 0}
                </span>
                <span className="text-[11px] text-orange-600 block mt-1">
                  {t('admin.activeWallets')}
                </span>
              </div>
            </div>
          </div>

          {/* Egyptian Market Legal & Regulatory Governance Box */}
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-3xl p-6 text-white shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-600/20 text-red-400 border border-red-500/30 flex items-center justify-center flex-shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-black text-base text-white">
                  {t('admin.egyptianGovernance')}
                </h4>
                <p className="text-xs text-slate-400">
                  {t('admin.governanceNotice')}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-2">
              <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700/60">
                <span className="font-bold text-orange-400 block mb-1">
                  {t('admin.localResidency')}
                </span>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  {t('admin.governanceDetails')}
                </p>
              </div>

              <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700/60">
                <span className="font-bold text-emerald-400 block mb-1">
                  {t('admin.codAntiFraud')}
                </span>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  {isRTL
                    ? 'حظر الشراء عند تجاوز 3 مرات رفض استلام متتالية لحماية حقوق التجار وتكاليف الشحن.'
                    : 'Automatic COD restriction triggered upon 3 consecutive doorstep delivery refusals.'}
                </p>
              </div>

              <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700/60">
                <span className="font-bold text-blue-400 block mb-1">
                  {t('admin.platformCommission10')}
                </span>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  {isRTL
                    ? 'تخصم تلقائياً عند تسليم الشحنة للعميل، ويتاح للتاجر سحب صافي أرباحه عبر إنستاباي أو المحافظ الذكية.'
                    : 'Deducted upon successful delivery; net earnings cleared into vendor ledger.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: USERS & VENDORS MANAGEMENT */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Controls Bar: Search & Filters */}
          <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            {/* Search Box */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder={t('admin.searchUsersPlaceholder')}
                className="w-full ps-10 pe-4 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-red-500 bg-slate-50 focus:bg-white transition-all"
              />
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white outline-none cursor-pointer hover:bg-slate-50 transition-colors"
              >
                <option value="">{t('admin.allRoles')}</option>
                <option value="Buyer">{t('admin.buyersOnly')}</option>
                <option value="Seller">{t('admin.sellersOnly')}</option>
                <option value="Admin">{t('admin.adminsOnly')}</option>
              </select>

              <select
                value={userStatusFilter}
                onChange={(e) => setUserStatusFilter(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white outline-none cursor-pointer hover:bg-slate-50 transition-colors"
              >
                <option value="">{t('admin.allStatuses')}</option>
                <option value="true">{t('admin.activeOnly')}</option>
                <option value="false">{t('admin.bannedInactive')}</option>
              </select>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5 text-start">{t('admin.thUser')}</th>
                    <th className="px-4 py-3.5 text-start">{t('admin.thRole')}</th>
                    <th className="px-4 py-3.5 text-start">{t('admin.thContactCity')}</th>
                    <th className="px-4 py-3.5 text-start">{t('admin.thRegisteredAt')}</th>
                    <th className="px-4 py-3.5 text-start">{t('admin.thStatus')}</th>
                    <th className="px-5 py-3.5 text-end">{t('admin.thActions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                        {t('admin.noUsersMatch')}
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                        {/* User ID & Name */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700">
                              {u.name ? u.name.charAt(0).toUpperCase() : 'U'}
                            </div>
                            <div>
                              <div className="font-black text-slate-900 text-xs flex items-center gap-1.5">
                                <span>{u.name}</span>
                                <span className="text-[10px] text-slate-400 font-mono">#{u.id}</span>
                              </div>
                              <span className="text-[11px] text-slate-500 font-mono block">
                                {u.email}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Role Badge */}
                        <td className="px-4 py-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                              u.role === 'Admin'
                                ? 'bg-red-100 text-red-800'
                                : u.role === 'Seller'
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {getRoleLabel(u.role, t)}
                          </span>
                        </td>

                        {/* Contact & City */}
                        <td className="px-4 py-4">
                          <div className="space-y-0.5 text-slate-600">
                            {u.dispatchCity && (
                              <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-700">
                                <Building className="w-3 h-3 text-orange-500" />
                                <span>{u.dispatchCity}</span>
                              </div>
                            )}
                            {u.contactPhone && (
                              <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500">
                                <Phone className="w-3 h-3 text-slate-400" />
                                <span>{u.contactPhone}</span>
                              </div>
                            )}
                            {!u.dispatchCity && !u.contactPhone && (
                              <span className="text-slate-400 text-[11px]">-</span>
                            )}
                          </div>
                        </td>

                        {/* Registered At */}
                        <td className="px-4 py-4 text-slate-500 text-[11px]">
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US') : '-'}
                        </td>

                        {/* Status Badge */}
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                              u.isActive
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {u.isActive ? (
                              <>
                                <CheckCircle className="w-3 h-3 text-emerald-600" />
                                <span>{t('admin.activeBadge')}</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3 h-3 text-red-600" />
                                <span>{t('admin.bannedBadge')}</span>
                              </>
                            )}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-4 text-end">
                          <button
                            onClick={() => {
                              setSelectedUser(u);
                              setShowStatusModal(true);
                              setStatusReason('');
                            }}
                            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all shadow-sm ${
                              u.isActive
                                ? 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {u.isActive ? t('admin.banBtn') : t('admin.activateBtn')}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: VENDOR PAYOUT REQUESTS */}
      {activeTab === 'payouts' && (
        <div className="space-y-4">
          {/* Status Filter Selector */}
          <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900">
                {t('admin.vendorSettlements')}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isRTL
                  ? 'مراجعة طلبات سحب رصيد مبيعات الدفع عند الاستلام المعتمدة عبر إنستاباي والمحافظ الذكية.'
                  : 'Approve or reject cleared vendor COD earnings via InstaPay or Mobile Wallets.'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={payoutStatusFilter}
                onChange={(e) => setPayoutStatusFilter(e.target.value)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white outline-none cursor-pointer hover:bg-slate-50 transition-colors"
              >
                <option value="">{t('admin.allPayoutStatuses')}</option>
                <option value="Pending">{t('payoutStatus.Pending')}</option>
                <option value="Completed">{t('payoutStatus.Completed')}</option>
                <option value="Rejected">{t('payoutStatus.Rejected')}</option>
              </select>
            </div>
          </div>

          {/* Payouts Table */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5 text-start">{t('admin.thRequestVendor')}</th>
                    <th className="px-4 py-3.5 text-start">{t('admin.thAmount')}</th>
                    <th className="px-4 py-3.5 text-start">{t('admin.thMethod')}</th>
                    <th className="px-4 py-3.5 text-start">{t('admin.thDestination')}</th>
                    <th className="px-4 py-3.5 text-start">{t('admin.thDate')}</th>
                    <th className="px-4 py-3.5 text-start">{t('common.status')}</th>
                    <th className="px-5 py-3.5 text-end">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payouts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                        {t('admin.noPayoutsMatch')}
                      </td>
                    </tr>
                  ) : (
                    payouts.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                        {/* ID & Vendor */}
                        <td className="px-5 py-4">
                          <div className="font-black text-slate-900 text-xs">
                            {p.sellerName || t('admin.vendorNum', { id: p.sellerId })}
                          </div>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {t('admin.reqNum', { id: p.id })}
                          </span>
                        </td>

                        {/* Amount */}
                        <td className="px-4 py-4">
                          <span className="font-black text-slate-900 text-sm">
                            {formatCurrency(p.amount)}
                          </span>
                        </td>

                        {/* Method */}
                        <td className="px-4 py-4">
                          <span className="inline-block px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-800">
                            {getPayoutMethodLabel(p.method, t)}
                          </span>
                        </td>

                        {/* Destination */}
                        <td className="px-4 py-4 font-mono text-[11px] text-slate-700">
                          {p.destinationAccount}
                        </td>

                        {/* Date */}
                        <td className="px-4 py-4 text-slate-500 text-[11px]">
                          {p.createdAt ? new Date(p.createdAt).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US') : '-'}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                              p.status === 'Completed'
                                ? 'bg-emerald-100 text-emerald-800'
                                : p.status === 'Rejected'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {p.status === 'Completed' && <CheckCircle className="w-3 h-3 text-emerald-600" />}
                            {p.status === 'Rejected' && <XCircle className="w-3 h-3 text-red-600" />}
                            {p.status === 'Pending' && <Clock className="w-3 h-3 text-amber-600" />}
                            <span>{getPayoutStatusLabel(p.status, t)}</span>
                          </span>
                          {p.adminNotes && (
                            <span className="text-[10px] text-slate-400 block mt-0.5 truncate max-w-[150px]">
                              {p.adminNotes}
                            </span>
                          )}
                        </td>

                        {/* Action */}
                        <td className="px-5 py-4 text-end">
                          {p.status === 'Pending' ? (
                            <button
                              onClick={() => {
                                setSelectedPayout(p);
                                setProcessStatus('Completed');
                                setAdminNotes('');
                                setShowProcessModal(true);
                              }}
                              className="px-3.5 py-1.5 rounded-xl font-bold text-xs bg-red-600 hover:bg-red-700 text-white shadow-sm transition-all"
                            >
                              {t('admin.processBtn')}
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-semibold">
                              {p.processedAt ? new Date(p.processedAt).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US') : '-'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Reported Reviews Moderation */}
      {activeTab === 'reviews' && (
        <div className="space-y-6">
          {/* Header & Filter Controls */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-orange-500" />
                <span>{isRTL ? 'إدارة التقييمات المبلغ عنها ومراقبة المحتوى' : 'Reported Reviews & Moderation Queue'}</span>
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {isRTL
                  ? 'مراجعة بلاغات المستخدمين ضد التقييمات وحجب التقييمات المسيئة أو استعادتها.'
                  : 'Review user reports on product reviews and hide or restore content.'}
              </p>
            </div>

            {/* Filter Pills: ALL | VISIBLE | HIDDEN */}
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-2xl text-xs font-bold">
              {[
                { id: 'ALL', label: isRTL ? 'الكل' : 'All' },
                { id: 'VISIBLE', label: isRTL ? 'النشطة' : 'Visible' },
                { id: 'HIDDEN', label: isRTL ? 'المحجوبة' : 'Hidden' },
              ].map((f) => (
                <button
                  key={`rev-filter-${f.id}`}
                  onClick={() => setReviewFilter(f.id)}
                  className={`px-3 py-1.5 rounded-xl transition-all ${
                    reviewFilter === f.id
                      ? 'bg-white text-slate-900 shadow-sm font-black'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {reviewsLoading ? (
            <div className="p-12 text-center text-xs text-slate-400 font-bold">
              {t('common.loading')}
            </div>
          ) : reviews.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-sm space-y-2">
              <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto" />
              <h3 className="font-black text-sm text-slate-800">
                {isRTL ? 'لا توجد تقييمات مبلغ عنها' : 'No Reported Reviews Found'}
              </h3>
              <p className="text-xs text-slate-400">
                {isRTL ? 'طابور المراجعة نظيف تماماً ولا توجد بلاغات معلقة مطابقة للمحدد.' : 'The review moderation queue is clear.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((rev) => {
                const isExpanded = Boolean(expandedReports[rev.id]);
                const reportsList = Array.isArray(rev.reports) ? rev.reports : [];

                return (
                  <div
                    key={`reported-rev-${rev.id}`}
                    className={`bg-white rounded-3xl p-6 border shadow-sm transition-all space-y-4 ${
                      rev.isHidden ? 'border-red-200 bg-red-50/20' : 'border-slate-200/80'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-sm text-slate-900">
                            {rev.userName || (isRTL ? 'مشتري معتمد' : 'Verified Buyer')}
                          </span>
                          <span className="text-xs text-slate-400">•</span>
                          <span className="text-xs font-bold text-orange-600">
                            {rev.productName || (isRTL ? 'منتج سوق مصر' : 'Product')}
                          </span>
                          <span className="text-xs text-slate-400">•</span>
                          <span className="text-[11px] text-slate-400">
                            {rev.createdAt ? new Date(rev.createdAt).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US') : ''}
                          </span>
                        </div>

                        {/* Star Rating */}
                        <div className="flex items-center gap-1 mt-1 text-amber-500">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={`star-${rev.id}-${star}`}
                              className={`w-3.5 h-3.5 ${
                                star <= rev.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'
                              }`}
                            />
                          ))}
                          <span className="text-xs font-mono font-bold text-slate-700 ms-1.5">
                            {rev.rating}/5
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {rev.isHidden ? (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-red-100 text-red-800 border border-red-200 flex items-center gap-1">
                            <EyeOff className="w-3 h-3 text-red-600" />
                            <span>{isRTL ? 'محجوب' : 'Hidden'}</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                            <Eye className="w-3 h-3 text-emerald-600" />
                            <span>{isRTL ? 'نشط' : 'Visible'}</span>
                          </span>
                        )}

                        <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                          <Flag className="w-3 h-3 text-amber-600" />
                          <span>
                            {reportsList.length || rev.reportCount || 1} {isRTL ? 'بلاغات' : 'Reports'}
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* Review Comment */}
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-xs text-slate-800 leading-relaxed font-medium">
                      "{rev.comment}"
                    </div>

                    {/* Review Images (if any) */}
                    {Array.isArray(rev.imageUrls) && rev.imageUrls.length > 0 && (
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {rev.imageUrls.map((img, i) => (
                          <img
                            key={`rev-img-${rev.id}-${i}`}
                            src={getImageUrl(img) || img}
                            alt="Review attachment"
                            onError={handleImageError}
                            className="w-16 h-16 rounded-xl object-cover border border-slate-200"
                          />
                        ))}
                      </div>
                    )}

                    {/* Footer Actions & Reports Drawer */}
                    <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => toggleReportsExpand(rev.id)}
                        className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        <span>
                          {isExpanded
                            ? (isRTL ? 'إخفاء تفاصيل البلاغات' : 'Hide Report Details')
                            : (isRTL ? `عرض تفاصيل البلاغات (${reportsList.length})` : `View Reports (${reportsList.length})`)}
                        </span>
                      </button>

                      {/* Moderation Button */}
                      <button
                        type="button"
                        onClick={() => handleToggleHideReview(rev)}
                        disabled={modLoadingId === rev.id}
                        className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50 ${
                          rev.isHidden
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'bg-red-600 hover:bg-red-700 text-white'
                        }`}
                      >
                        {rev.isHidden ? (
                          <>
                            <Eye className="w-4 h-4" />
                            <span>{isRTL ? 'إلغاء الحجب واستعادة التقييم' : 'Unhide Review'}</span>
                          </>
                        ) : (
                          <>
                            <EyeOff className="w-4 h-4" />
                            <span>{isRTL ? 'حجب هذا التقييم فوراً' : 'Hide Review'}</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Expanded Reports Sub-table */}
                    {isExpanded && (
                      <div className="mt-3 p-4 rounded-2xl bg-slate-900 text-white space-y-2.5 text-xs animate-in fade-in">
                        <span className="font-black text-amber-400 block text-[11px] uppercase tracking-wider">
                          {isRTL ? 'سجل بلاغات المستخدمين ضد هذا التقييم' : 'User Reports Log'}
                        </span>
                        {reportsList.length === 0 ? (
                          <p className="text-slate-400 text-xs">
                            {isRTL ? 'لا توجد ملاحظات إضافية مسجلة.' : 'No detailed reports recorded.'}
                          </p>
                        ) : (
                          <div className="divide-y divide-slate-800">
                            {reportsList.map((rep, idx) => (
                              <div key={`rep-${rev.id}-${idx}`} className="py-2 space-y-1">
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="font-bold text-orange-400">
                                    {rep.reason || (isRTL ? 'محتوى غير لائق' : 'Inappropriate')}
                                  </span>
                                  <span className="text-slate-500 font-mono">
                                    {rep.createdAt ? new Date(rep.createdAt).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US') : ''}
                                  </span>
                                </div>
                                {rep.details && (
                                  <p className="text-slate-300 text-[11px] leading-relaxed">
                                    {rep.details}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Category Management */}
      {activeTab === 'categories' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-red-600" />
                <span>{t('categoriesAdmin.title')}</span>
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {isRTL
                  ? 'إدارة فئات المنتجات، الترتيب، وتفعيل/تعطيل الفئات في المتجر.'
                  : 'Manage product categories, sorting order, and active storefront visibility.'}
              </p>
            </div>

            <button
              onClick={handleOpenAddCategory}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md shadow-red-600/20 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>{t('categoriesAdmin.addCategory')}</span>
            </button>
          </div>

          {categoriesLoading ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80">
              <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs text-slate-500">{t('common.loading')}</p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-start">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-bold">
                      <th className="py-3 px-4 text-start">#</th>
                      <th className="py-3 px-4 text-start">{t('categoriesAdmin.nameAr')}</th>
                      <th className="py-3 px-4 text-start">{t('categoriesAdmin.nameEn')}</th>
                      <th className="py-3 px-4 text-start">{t('categoriesAdmin.displayOrder')}</th>
                      <th className="py-3 px-4 text-start">{t('categoriesAdmin.productsCount')}</th>
                      <th className="py-3 px-4 text-start">{t('categoriesAdmin.status')}</th>
                      <th className="py-3 px-4 text-end">{t('categoriesAdmin.actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {categoriesList.map((cat) => (
                      <tr key={cat.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-mono text-slate-400 font-bold">{cat.id}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">{cat.nameAr || '—'}</td>
                        <td className="py-3 px-4 font-medium text-slate-700">{cat.nameEn || cat.name || '—'}</td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-600">{cat.displayOrder ?? 0}</td>
                        <td className="py-3 px-4">
                          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                            {cat.productsCount ?? 0}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              cat.isActive !== false
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {cat.isActive !== false ? t('categoriesAdmin.active') : t('categoriesAdmin.inactive')}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-end">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEditCategory(cat)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                              title={t('categoriesAdmin.editCategory')}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteCategory(cat)}
                              className="p-1.5 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
                              title={t('categoriesAdmin.delete')}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 6: ADMIN AUDIT LOGS */}
      {activeTab === 'audit-logs' && (
        <div className="space-y-6">
          {/* Header & Controls Bar */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-red-600" />
                <span>{t('adminPortal.auditLogs.title')}</span>
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {t('adminPortal.auditLogs.subtitle')}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              {/* Entity Type Filter */}
              <select
                value={auditEntityTypeFilter}
                onChange={(e) => setAuditEntityTypeFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="">{t('adminPortal.auditLogs.allEntities')}</option>
                <option value="Category">{t('adminPortal.auditLogs.entityCategory')}</option>
                <option value="User">{t('adminPortal.auditLogs.entityUser')}</option>
                <option value="Product">{t('adminPortal.auditLogs.entityProduct')}</option>
                <option value="Review">{t('adminPortal.auditLogs.entityReview')}</option>
                <option value="Order">{t('adminPortal.auditLogs.entityOrder')}</option>
              </select>

              {/* Action Filter */}
              <select
                value={auditActionFilter}
                onChange={(e) => setAuditActionFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="">{t('adminPortal.auditLogs.allActions')}</option>
                <option value="CreateCategory">{t('adminPortal.auditLogs.actionCreateCategory')}</option>
                <option value="UpdateCategory">{t('adminPortal.auditLogs.actionUpdateCategory')}</option>
                <option value="DeleteCategory">{t('adminPortal.auditLogs.actionDeleteCategory')}</option>
                <option value="ActivateUser">{t('adminPortal.auditLogs.actionActivateUser')}</option>
                <option value="DeactivateUser">{t('adminPortal.auditLogs.actionDeactivateUser')}</option>
              </select>

              {/* Refresh button */}
              <button
                onClick={() => fetchAuditLogs(auditPage)}
                disabled={auditLoading}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors disabled:opacity-50"
                title={t('common.refresh')}
              >
                <RefreshCw className={`w-4 h-4 ${auditLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Audit Logs Table / Empty State */}
          {auditLoading ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-sm">
              <RefreshCw className="w-8 h-8 text-red-600 animate-spin mx-auto mb-3" />
              <p className="text-xs text-slate-500 font-bold">{t('common.loading')}</p>
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-sm">
              <ClipboardList className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-800">{t('adminPortal.auditLogs.noLogsTitle')}</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {t('adminPortal.auditLogs.noLogsDesc')}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs">
                  <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold">
                    <tr>
                      <th className="px-5 py-3.5 text-start">#</th>
                      <th className="px-5 py-3.5 text-start">{t('adminPortal.auditLogs.colDate')}</th>
                      <th className="px-5 py-3.5 text-start">{t('adminPortal.auditLogs.colAdmin')}</th>
                      <th className="px-5 py-3.5 text-start">{t('adminPortal.auditLogs.colAction')}</th>
                      <th className="px-5 py-3.5 text-start">{t('adminPortal.auditLogs.colEntity')}</th>
                      <th className="px-5 py-3.5 text-start">{t('adminPortal.auditLogs.colDetails')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {auditLogs.map((log) => {
                      const isDangerAction = /Delete|Deactivate|Ban|Reject/i.test(log.action);
                      const isSuccessAction = /Create|Activate|Complete|Approve/i.test(log.action);

                      return (
                        <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-5 py-3 font-mono text-slate-400 text-[11px]">
                            #{log.id}
                          </td>
                          <td className="px-5 py-3 text-slate-600 whitespace-nowrap text-[11px]">
                            {new Date(log.createdAt).toLocaleString(isRTL ? 'ar-EG' : 'en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="px-5 py-3 whitespace-nowrap">
                            <div className="font-bold text-slate-900 text-xs">
                              {log.adminName || (log.adminId ? `#${log.adminId}` : t('adminPortal.auditLogs.system'))}
                            </div>
                            {log.adminEmail && (
                              <div className="text-[10px] text-slate-400 font-mono">
                                {log.adminEmail}
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider ${
                                isDangerAction
                                  ? 'bg-red-100 text-red-800'
                                  : isSuccessAction
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {log.action}
                            </span>
                          </td>
                          <td className="px-5 py-3 whitespace-nowrap text-slate-700">
                            <span className="font-bold">{log.entityType}</span>
                            {log.entityId && (
                              <span className="text-slate-400 font-mono ms-1 text-[11px]">
                                ({log.entityId})
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-slate-600 max-w-md break-words text-[11px] leading-relaxed">
                            {log.details || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Bar */}
              <div className="p-4 bg-slate-50/80 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <span className="text-slate-500 font-medium">
                  {t('adminPortal.auditLogs.totalCount', { count: auditTotalCount })}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fetchAuditLogs(auditPage - 1)}
                    disabled={auditPage <= 1 || auditLoading}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 disabled:opacity-40 hover:bg-slate-50 transition-colors"
                  >
                    {t('common.previous')}
                  </button>
                  <span className="font-bold text-slate-800 px-2">
                    {auditPage}
                  </span>
                  <button
                    onClick={() => fetchAuditLogs(auditPage + 1)}
                    disabled={auditPage * 30 >= auditTotalCount || auditLoading}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 disabled:opacity-40 hover:bg-slate-50 transition-colors"
                  >
                    {t('common.next')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 7: 2FA SECURITY */}
      {activeTab === 'security' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="font-black text-base text-slate-900">
                    {t('adminPortal.twoFactor.title')}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {t('adminPortal.twoFactor.subtitle')}
                  </p>
                </div>
              </div>

              <button
                onClick={fetchTwoFactorStatus}
                disabled={twoFactorLoading}
                className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors disabled:opacity-50 self-start sm:self-auto"
                title={t('common.refresh')}
              >
                <RefreshCw className={`w-4 h-4 ${twoFactorLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {twoFactorLoading ? (
              <div className="p-12 text-center">
                <RefreshCw className="w-8 h-8 text-red-600 animate-spin mx-auto mb-3" />
                <p className="text-xs text-slate-500 font-bold">{t('common.loading')}</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      {t('adminPortal.twoFactor.status')}
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black ${
                          twoFactorStatus?.isEnabled
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}
                      >
                        {twoFactorStatus?.isEnabled ? (
                          <>
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{t('adminPortal.twoFactor.statusActive')}</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                            <span>{t('adminPortal.twoFactor.statusDisabled')}</span>
                          </>
                        )}
                      </span>
                      {twoFactorStatus?.isEnforced && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                          <Lock className="w-3 h-3 text-purple-600" />
                          <span>{t('adminPortal.twoFactor.enforcedPolicy')}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={handleStartSetup}
                      disabled={setupSubmitting}
                      className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50 active:scale-[0.99]"
                    >
                      <Key className="w-4 h-4" />
                      <span>{t('adminPortal.twoFactor.setupButton')}</span>
                    </button>

                    {twoFactorStatus?.isEnabled && !twoFactorStatus?.isEnforced && (
                      <button
                        onClick={() => {
                          setDisablePassword('');
                          setShowDisableModal(true);
                        }}
                        className="px-4 py-2.5 bg-white hover:bg-red-50 text-red-600 border border-red-200 text-xs font-bold rounded-xl transition-all"
                      >
                        {t('adminPortal.twoFactor.disableButton')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 8: SHIPMENTS & OPERATIONS (GAP-REL-03 & GAP-ADM-01) */}
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
                <RefreshCw className={`w-3.5 h-3.5 ${shipmentsLoading ? 'animate-spin' : ''}`} />
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
                            {s.governorate} • {s.city} {s.area ? `• ${s.area}` : ''}
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
                              className={`inline-block text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                                s.status === 'Delivered'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : s.status === 'Returned'
                                  ? 'bg-rose-100 text-rose-800'
                                  : s.status === 'InTransit'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-slate-100 text-slate-800'
                              }`}
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

      {/* MODAL: SETUP 2FA */}
      {showSetupModal && setupData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-red-600" />
                <span>{t('adminPortal.twoFactor.modalTitle')}</span>
              </h3>
              <button
                onClick={() => setShowSetupModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmEnable} className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs text-slate-600 font-medium">
                  {t('adminPortal.twoFactor.step1')}
                </p>
                {setupData.qrCodeUri && (
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(setupData.qrCodeUri)}`}
                    alt="2FA QR Code"
                    onError={handleImageError}
                    className="w-40 h-40 mx-auto rounded-xl border border-slate-200 bg-white p-2 shadow-sm"
                  />
                )}
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-slate-500 block">
                    {t('adminPortal.twoFactor.step1Manual')}
                  </span>
                  <div className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-mono">
                    <span className="truncate select-all text-slate-800 font-bold">
                      {setupData.manualEntryKey || setupData.secretKey}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(setupData.manualEntryKey || setupData.secretKey);
                        setCopiedKey(true);
                        setTimeout(() => setCopiedKey(false), 2000);
                      }}
                      className="text-red-600 hover:text-red-700 flex items-center gap-1 font-bold flex-shrink-0"
                    >
                      {copiedKey ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedKey ? t('adminPortal.twoFactor.copied') : t('adminPortal.twoFactor.copyKey')}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-700">
                  {t('adminPortal.twoFactor.step2')}
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 text-slate-400 absolute top-3 start-3" />
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    required
                    dir="ltr"
                    value={setupCode}
                    onChange={(e) => setSetupCode(e.target.value.replace(/\D/g, ''))}
                    placeholder={t('adminPortal.twoFactor.codePlaceholder')}
                    className="w-full ps-9 pe-3 py-2.5 rounded-xl border border-slate-300 text-center text-base font-mono tracking-widest text-slate-900 outline-none focus:ring-2 focus:ring-red-500 font-bold"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowSetupModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={setupSubmitting || setupCode.trim().length !== 6}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-md disabled:opacity-50"
                >
                  {setupSubmitting ? t('common.loading') : t('adminPortal.twoFactor.verifyAndEnable')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DISABLE 2FA */}
      {showDisableModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-600" />
                <span>{t('adminPortal.twoFactor.disableModalTitle')}</span>
              </h3>
              <button
                onClick={() => setShowDisableModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmDisable} className="space-y-4">
              <p className="text-xs text-slate-600">
                {t('adminPortal.twoFactor.disablePrompt')}
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('auth.password')}
                </label>
                <input
                  type="password"
                  required
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDisableModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={disableSubmitting || !disablePassword}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-md disabled:opacity-50"
                >
                  {disableSubmitting ? t('common.loading') : t('adminPortal.twoFactor.confirmDisable')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT CATEGORY */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-sm text-slate-900">
                  {editingCategory ? t('categoriesAdmin.editCategory') : t('categoriesAdmin.addCategory')}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {editingCategory ? `ID: #${editingCategory.id}` : (isRTL ? 'إضافة فئة جديدة للكتالوج' : 'Add a new catalog category')}
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {t('categoriesAdmin.nameAr')} *
                </label>
                <input
                  type="text"
                  required
                  value={categoryForm.nameAr}
                  onChange={(e) => setCategoryForm({ ...categoryForm, nameAr: e.target.value })}
                  placeholder="مثال: إلكترونيات"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {t('categoriesAdmin.nameEn')} *
                </label>
                <input
                  type="text"
                  required
                  value={categoryForm.nameEn}
                  onChange={(e) => setCategoryForm({ ...categoryForm, nameEn: e.target.value })}
                  placeholder="e.g. Electronics"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {t('categoriesAdmin.displayOrder')}
                </label>
                <input
                  type="number"
                  min="0"
                  value={categoryForm.displayOrder}
                  onChange={(e) => setCategoryForm({ ...categoryForm, displayOrder: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="catIsActive"
                  checked={categoryForm.isActive}
                  onChange={(e) => setCategoryForm({ ...categoryForm, isActive: e.target.checked })}
                  className="w-4 h-4 text-red-600 rounded border-slate-300 focus:ring-red-500"
                />
                <label htmlFor="catIsActive" className="text-xs font-bold text-slate-700 select-none">
                  {t('categoriesAdmin.active')}
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
                >
                  {t('categoriesAdmin.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={categorySubmitting}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-md disabled:opacity-50 transition-colors"
                >
                  {categorySubmitting ? t('common.loading') : t('categoriesAdmin.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 1: UPDATE USER STATUS (BAN / ACTIVATE) */}
      {showStatusModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                  selectedUser.isActive ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'
                }`}
              >
                {selectedUser.isActive ? (
                  <UserX className="w-5 h-5" />
                ) : (
                  <UserCheck className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="font-black text-sm text-slate-900">
                  {selectedUser.isActive
                    ? t('admin.confirmDeactivation')
                    : t('admin.confirmReactivation')}
                </h3>
                <span className="text-[11px] text-slate-500 font-semibold">
                  {selectedUser.name} ({selectedUser.email})
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {selectedUser.isActive
                ? (isRTL
                  ? 'سيؤدي تعطيل الحساب إلى منع المستخدم من تسجيل الدخول أو نشر منتجات جديدة أو إجراء عمليات شراء.'
                  : 'Banning this account will prevent the user from logging in or conducting transactions.')
                : (isRTL
                  ? 'سيتم استعادة صلاحيات الحساب والسماح له بالدخول والعمل على المنصة بشكل طبيعي.'
                  : 'Reactivating this account will restore full user privileges on the platform.')}
            </p>

            <form onSubmit={handleUpdateUserStatus} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('admin.reasonLabel')}
                </label>
                <textarea
                  rows={3}
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder={t('admin.reasonPlaceholder')}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowStatusModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={statusLoading}
                  className={`px-5 py-2 text-white text-xs font-bold rounded-xl shadow-md disabled:opacity-50 ${
                    selectedUser.isActive
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {statusLoading
                    ? t('common.loading')
                    : selectedUser.isActive
                    ? t('admin.banUser')
                    : t('admin.unbanUser')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: PROCESS PAYOUT REQUEST */}
      {showProcessModal && selectedPayout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center flex-shrink-0">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-sm text-slate-900">
                  {t('admin.processVendorPayout')}
                </h3>
                <span className="text-[11px] text-slate-500 font-semibold">
                  {selectedPayout.sellerName} • {formatCurrency(selectedPayout.amount)}
                </span>
              </div>
            </div>

            {/* Payout Details Summary */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">{t('admin.lblMethod')}</span>
                <span className="font-bold text-slate-900">{getPayoutMethodLabel(selectedPayout.method, t)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t('admin.lblAccount')}</span>
                <span className="font-mono font-bold text-slate-900">{selectedPayout.destinationAccount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t('admin.lblNetAmount')}</span>
                <span className="font-black text-emerald-700">{formatCurrency(selectedPayout.amount)}</span>
              </div>
            </div>

            <form onSubmit={handleProcessPayout} className="space-y-4">
              {/* Decision Toggle */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {t('admin.lblDecision')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setProcessStatus('Completed')}
                    className={`py-2 px-3 rounded-xl border text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                      processStatus === 'Completed'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>{t('admin.approveAndClear')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setProcessStatus('Rejected')}
                    className={`py-2 px-3 rounded-xl border text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                      processStatus === 'Rejected'
                        ? 'bg-red-600 text-white border-red-600 shadow-md'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <XCircle className="w-4 h-4" />
                    <span>{t('admin.rejectRequest')}</span>
                  </button>
                </div>
              </div>

              {/* Admin Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('admin.lblNotes')}
                </label>
                <textarea
                  rows={2}
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder={
                    processStatus === 'Completed'
                      ? t('admin.placeholderRef')
                      : t('admin.placeholderReject')
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowProcessModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={processLoading}
                  className={`px-5 py-2 text-white text-xs font-bold rounded-xl shadow-md disabled:opacity-50 ${
                    processStatus === 'Completed'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {processLoading ? t('common.loading') : t('admin.submitDecision')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
