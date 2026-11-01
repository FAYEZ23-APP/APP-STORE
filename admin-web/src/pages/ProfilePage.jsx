import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  User,
  MapPin,
  Shield,
  Trash2,
  Plus,
  Key,
  CheckCircle,
  AlertTriangle,
  Wallet,
  Coins,
  ArrowDownLeft,
  ArrowUpRight,
  Edit2,
  Compass,
  Link2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  updateMyProfile,
  changePassword,
  getMyAddresses,
  createMyAddress,
  updateMyAddress,
  deleteMyAddress,
  getMyBuyerStats,
  getBuyerDashboard,
  getMyWallet,
  deleteMyAccount,
} from '../api/usersApi';
import { linkGoogle } from '../api/authApi';
import { fetchSafeAppConfig } from '../api/configApi';
import MapAddressPicker from '../components/MapAddressPicker';
import { isValidEgyptianPhone, normalizeEgyptianPhone } from '../utils/egyptianPhone';
import { formatCurrency } from '../utils/currency';
import { getRoleLabel } from '../utils/enumTranslations';

export default function ProfilePage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { userName, userEmail, userRole, logout } = useAuth();
  const isBuyer = userRole === 'Buyer';

  const [activeTab, setActiveTab] = useState('profile'); // profile, addresses, privacy

  // Profile Form
  const [name, setName] = useState(userName || '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState(null);

  // Password Form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState(null);

  // Addresses
  const [addresses, setAddresses] = useState([]);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [addrLabel, setAddrLabel] = useState(isRTL ? 'المنزل' : 'Home');
  const [addrRecipient, setAddrRecipient] = useState(userName || '');
  const [addrPhone, setAddrPhone] = useState('');
  const [addrGov, setAddrGov] = useState(isRTL ? 'القاهرة' : 'Cairo');
  const [addrCity, setAddrCity] = useState(isRTL ? 'مدينة نصر' : 'Nasr City');
  const [addrArea, setAddrArea] = useState(isRTL ? 'الحي السابع' : '7th District');
  const [addrStreet, setAddrStreet] = useState('');
  const [addrBuildingNumber, setAddrBuildingNumber] = useState('');
  const [addrFloor, setAddrFloor] = useState('');
  const [addrApartment, setAddrApartment] = useState('');
  const [addrLandmark, setAddrLandmark] = useState('');
  const [addrLat, setAddrLat] = useState(30.0444);
  const [addrLng, setAddrLng] = useState(31.2357);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [addrIsDefault, setAddrIsDefault] = useState(false);
  const [addrSaving, setAddrSaving] = useState(false);
  const [addrError, setAddrError] = useState(null);

  // Google SSO Linking
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [linkGoogleToken, setLinkGoogleToken] = useState('');
  const [linkGoogleLoading, setLinkGoogleLoading] = useState(false);
  const [linkGoogleMsg, setLinkGoogleMsg] = useState(null);

  // Buyer Stats & Dashboard Hub
  const [buyerStats, setBuyerStats] = useState(null);
  const [buyerDashboard, setBuyerDashboard] = useState(null);
  const [walletData, setWalletData] = useState(null);

  // Account Deletion State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteAuthMethod, setDeleteAuthMethod] = useState('password'); // 'password' | 'google'
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteGoogleToken, setDeleteGoogleToken] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  // Load Data
  const loadAddresses = async () => {
    try {
      setAddressesLoading(true);
      const res = await getMyAddresses();
      setAddresses(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.warn('Failed to load addresses', e);
    } finally {
      setAddressesLoading(false);
    }
  };

  const loadBuyerStats = async () => {
    try {
      const res = await getMyBuyerStats();
      setBuyerStats(res.data);
    } catch (e) {
      console.warn('Failed to load buyer stats', e);
    }

    try {
      const dashRes = await getBuyerDashboard();
      setBuyerDashboard(dashRes.data);
    } catch (e) {
      console.warn('Failed to load buyer dashboard', e);
    }

    try {
      const walletRes = await getMyWallet();
      setWalletData(walletRes.data);
    } catch (e) {
      console.warn('Failed to load buyer wallet', e);
    }
  };

  useEffect(() => {
    if (isBuyer) {
      loadAddresses();
      loadBuyerStats();
    } else {
      setAddressesLoading(false);
    }
    fetchSafeAppConfig().then((cfg) => {
      setGoogleEnabled(Boolean(cfg?.googleEnabled));
    });
  }, [isBuyer]);

  // Update Profile Name
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      await updateMyProfile({ name: name.trim() });
      setProfileMsg({ type: 'success', text: isRTL ? 'تم حفظ التعديلات بنجاح' : 'Profile updated successfully' });
    } catch (err) {
      setProfileMsg({ type: 'error', text: isRTL ? 'فشل حفظ التعديلات' : 'Failed to update profile' });
    } finally {
      setProfileSaving(false);
    }
  };

  // Change Password
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordLoading(true);
    setPasswordMsg(null);
    try {
      await changePassword({ currentPassword, newPassword });
      setPasswordMsg({ type: 'success', text: t('profile.passwordChanged') });
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setPasswordMsg({
        type: 'error',
        text: err?.response?.data?.error || t('common.error'),
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  // Link Google Account
  const handleLinkGoogleAccount = async (e) => {
    e.preventDefault();
    if (!linkGoogleToken.trim()) {
      setLinkGoogleMsg({
        type: 'error',
        text: isRTL ? 'يرجى إدخال رمز تعريف Google ID Token' : 'Please provide a valid Google ID token',
      });
      return;
    }
    setLinkGoogleLoading(true);
    setLinkGoogleMsg(null);
    try {
      await linkGoogle({ idToken: linkGoogleToken.trim() });
      setLinkGoogleMsg({
        type: 'success',
        text: isRTL ? 'تم ربط حسابك بحساب Google بنجاح!' : 'Google account linked successfully!',
      });
      setLinkGoogleToken('');
    } catch (err) {
      setLinkGoogleMsg({
        type: 'error',
        text:
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          (isRTL ? 'فشل ربط حساب Google. قد يكون الحساب مرتبطاً بمستخدم آخر.' : 'Failed to link Google account. It may already be linked to another user.'),
      });
    } finally {
      setLinkGoogleLoading(false);
    }
  };

  // Open Add Address Modal
  const handleOpenAddAddress = () => {
    setEditingAddress(null);
    setAddrLabel(isRTL ? 'المنزل' : 'Home');
    setAddrRecipient(userName || '');
    setAddrPhone('');
    setAddrGov(isRTL ? 'القاهرة' : 'Cairo');
    setAddrCity(isRTL ? 'مدينة نصر' : 'Nasr City');
    setAddrArea(isRTL ? 'الحي السابع' : '7th District');
    setAddrStreet('');
    setAddrBuildingNumber('');
    setAddrFloor('');
    setAddrApartment('');
    setAddrLandmark('');
    setAddrLat(30.0444);
    setAddrLng(31.2357);
    setAddrIsDefault(addresses.length === 0);
    setAddrError(null);
    setShowMapPicker(false);
    setShowAddressModal(true);
  };

  // Open Edit Address Modal
  const handleOpenEditAddress = (addr) => {
    setEditingAddress(addr);
    setAddrLabel(addr.label || (isRTL ? 'المنزل' : 'Home'));
    setAddrRecipient(addr.recipientName || userName || '');
    setAddrPhone(addr.recipientPhone || '');
    setAddrGov(addr.governorate || (isRTL ? 'القاهرة' : 'Cairo'));
    setAddrCity(addr.city || (isRTL ? 'مدينة نصر' : 'Nasr City'));
    setAddrArea(addr.area || (isRTL ? 'الحي السابع' : '7th District'));
    setAddrStreet(addr.streetBuilding || '');
    setAddrBuildingNumber(addr.buildingNumber || '');
    setAddrFloor(addr.floor || '');
    setAddrApartment(addr.apartment || '');
    setAddrLandmark(addr.landmark || '');
    setAddrLat(Number(addr.latitude) || 30.0444);
    setAddrLng(Number(addr.longitude) || 31.2357);
    setAddrIsDefault(Boolean(addr.isDefault));
    setAddrError(null);
    setShowMapPicker(false);
    setShowAddressModal(true);
  };

  // Save Address (Create or Update)
  const handleSaveAddress = async (e) => {
    e.preventDefault();
    setAddrError(null);

    if (!isValidEgyptianPhone(addrPhone)) {
      setAddrError(t('common.invalidPhone'));
      return;
    }

    setAddrSaving(true);
    try {
      const payload = {
        label: addrLabel.trim(),
        recipientName: addrRecipient.trim(),
        recipientPhone: normalizeEgyptianPhone(addrPhone),
        governorate: addrGov.trim(),
        city: addrCity.trim(),
        area: addrArea.trim(),
        streetBuilding: addrStreet.trim(),
        buildingNumber: addrBuildingNumber.trim(),
        floor: addrFloor.trim() || null,
        apartment: addrApartment.trim() || null,
        landmark: addrLandmark.trim() || null,
        latitude: addrLat,
        longitude: addrLng,
        formattedAddress: `${addrGov}، ${addrCity}، ${addrArea}، ${addrStreet}`.trim(),
        isDefault: addrIsDefault,
      };

      if (editingAddress) {
        await updateMyAddress(editingAddress.id, payload);
      } else {
        await createMyAddress(payload);
      }

      setShowAddressModal(false);
      setEditingAddress(null);
      await loadAddresses();
    } catch (err) {
      setAddrError(err?.response?.data?.error || err?.response?.data?.message || t('common.error'));
    } finally {
      setAddrSaving(false);
    }
  };

  // Delete Address
  const handleDeleteAddress = async (id) => {
    if (!window.confirm(t('profile.deleteAddressConfirm'))) return;
    try {
      await deleteMyAddress(id);
      await loadAddresses();
    } catch (e) {
      alert(t('common.error'));
    }
  };

  // Delete Account
  const handleDeleteAccount = async (e) => {
    e.preventDefault();
    setDeleteError(null);
    setDeleteLoading(true);

    try {
      if (deleteAuthMethod === 'password') {
        if (!deletePassword) {
          setDeleteError(isRTL ? 'يرجى إدخال كلمة المرور الحالية' : 'Please enter current password');
          setDeleteLoading(false);
          return;
        }
        await deleteMyAccount(deletePassword, null);
      } else {
        if (!deleteGoogleToken) {
          setDeleteError(isRTL ? 'يرجى إدخال رمز تعريف Google' : 'Please enter Google ID token');
          setDeleteLoading(false);
          return;
        }
        await deleteMyAccount(null, deleteGoogleToken);
      }

      alert(isRTL ? 'تم حذف وتجهيل حسابك بالكامل وفقاً للقانون 151/2020.' : 'Your account has been deleted in compliance with PDPL 151/2020.');
      logout();
      window.location.href = '/';
    } catch (err) {
      console.error('Delete account failed', err);
      if (err?.response?.status === 409) {
        setDeleteError(
          isRTL
            ? 'لا يمكن حذف الحساب الآن لوجود شحنات نشطة قيد التوصيل. يرجى الانتظار حتى اكتمال تسليمها أو إرجاعها.'
            : 'Cannot delete account with active in-progress shipments. Please wait until deliveries are completed.'
        );
      } else {
        setDeleteError(
          err?.response?.data?.error ||
          (isRTL ? 'فشل تأكيد الهوية أو تعذر إتمام الحذف' : 'Verification failed or deletion failed.')
        );
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      {/* Page Title & Privacy Trust Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#ECE9E6] pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#1F2329]">
            {t('profile.title')}
          </h1>
          <p className="text-xs text-[#595F69] mt-0.5">
            {t('profile.privacyCenter')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-full bg-white border border-[#ECE9E6] text-[#595F69] shadow-sm">
            <Shield className="w-3.5 h-3.5 text-[#C8102E]" />
            <span>{isRTL ? 'حساب موثق ومحمي (قانون 151/2020)' : 'Protected Account (PDPL 151/2020)'}</span>
          </span>
        </div>
      </div>

      {/* Buyer Hub Analytics Summary Card */}
      {isBuyer && buyerDashboard && (
        <div className="bg-white rounded-3xl p-6 border border-[#ECE9E6] shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#ECE9E6] pb-5">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-[#C8102E] text-white flex items-center justify-center font-black text-lg shadow-md shadow-[#C8102E]/20 flex-shrink-0">
                {(buyerDashboard.buyerName || userName || 'U').charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#C8102E]">
                    {isRTL ? 'لوحة تحكم ونشاط الحساب' : 'Buyer Activity Hub'}
                  </span>
                  <span className="bg-[#FAF8F5] text-[#595F69] border border-[#ECE9E6] text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {getRoleLabel(userRole, t)}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-[#1F2329] mt-0.5">
                  {buyerDashboard.buyerName || userName}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs px-3.5 py-1.5 rounded-full bg-[#FAF8F5] border border-[#ECE9E6] text-[#595F69] font-mono font-medium">
                {buyerDashboard.email || userEmail}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-[#FAF8F5] rounded-2xl p-4 border border-[#ECE9E6] hover:border-[#C8102E]/30 transition-colors">
              <span className="text-xs text-[#595F69] block font-medium">{isRTL ? 'إجمالي الطلبات' : 'Total Orders'}</span>
              <span className="text-2xl font-black text-[#1F2329] mt-1 block">
                {buyerDashboard.totalOrdersPlaced || 0}
              </span>
            </div>
            <div className="bg-[#FAF8F5] rounded-2xl p-4 border border-[#ECE9E6] hover:border-[#C8102E]/30 transition-colors">
              <span className="text-xs text-[#595F69] block font-medium">{isRTL ? 'إجمالي المشتريات' : 'Total Spent'}</span>
              <span className="text-2xl font-black text-[#C8102E] mt-1 block">
                {formatCurrency(buyerDashboard.totalSpent || 0)}
              </span>
            </div>
            <div className="bg-[#FAF8F5] rounded-2xl p-4 border border-[#ECE9E6] hover:border-[#C8102E]/30 transition-colors">
              <span className="text-xs text-[#595F69] block font-medium">{isRTL ? 'رصيد المحفظة (متجر)' : 'Store Credit'}</span>
              <span className="text-2xl font-black text-[#1F2329] mt-1 block">
                {formatCurrency(walletData?.balance || 0)}
              </span>
            </div>
            <div className="bg-[#FAF8F5] rounded-2xl p-4 border border-[#ECE9E6] hover:border-[#C8102E]/30 transition-colors">
              <span className="text-xs text-[#595F69] block font-medium">{t('profile.addressesSection')}</span>
              <span className="text-2xl font-black text-[#1F2329] mt-1 block">
                {addresses.length || buyerDashboard.savedAddressesCount || 0}
              </span>
            </div>
            <div className="bg-[#FAF8F5] rounded-2xl p-4 border border-[#ECE9E6] hover:border-[#C8102E]/30 transition-colors col-span-2 sm:col-span-1">
              <span className="text-xs text-[#595F69] block font-medium">{isRTL ? 'حالة الدفع بالاستلام' : 'COD Status'}</span>
              <span
                className={`text-xs font-black mt-2 inline-block px-2.5 py-1 rounded-full ${
                  buyerDashboard.codEligibilityStatus?.isCodBlocked
                    ? 'bg-[#FDF2F4] text-[#C8102E] border border-[#F8CAD1]'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}
              >
                {buyerDashboard.codEligibilityStatus?.isCodBlocked
                  ? (isRTL ? 'معلق مؤقتاً' : 'Restricted')
                  : (isRTL ? 'مفعل ومتاح' : 'Eligible')}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-[#ECE9E6] gap-2 sm:gap-4 text-xs font-bold overflow-x-auto scrollbar-none pb-1">
        <button
          onClick={() => setActiveTab('profile')}
          className={`pb-3 px-2 border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'profile'
              ? 'border-[#C8102E] text-[#C8102E]'
              : 'border-transparent text-[#595F69] hover:text-[#1F2329]'
          }`}
        >
          <User className="w-4 h-4" />
          <span>{isRTL ? 'الملف الشخصي وكلمة المرور' : 'Profile & Password'}</span>
        </button>

        {isBuyer && (
          <>
            <button
              onClick={() => setActiveTab('wallet')}
              className={`pb-3 px-2 border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
                activeTab === 'wallet'
                  ? 'border-[#C8102E] text-[#C8102E]'
                  : 'border-transparent text-[#595F69] hover:text-[#1F2329]'
              }`}
            >
              <Wallet className="w-4 h-4" />
              <span>{isRTL ? 'محفظة المشتري والرصيد' : 'Store Credit Wallet'}</span>
            </button>

            <button
              onClick={() => setActiveTab('addresses')}
              className={`pb-3 px-2 border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
                activeTab === 'addresses'
                  ? 'border-[#C8102E] text-[#C8102E]'
                  : 'border-transparent text-[#595F69] hover:text-[#1F2329]'
              }`}
            >
              <MapPin className="w-4 h-4" />
              <span>{t('profile.addressesSection')}</span>
            </button>
          </>
        )}

        <button
          onClick={() => setActiveTab('privacy')}
          className={`pb-3 px-2 border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'privacy'
              ? 'border-[#C8102E] text-[#C8102E]'
              : 'border-transparent text-[#595F69] hover:text-[#1F2329]'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>{isBuyer ? t('profile.accountSettingsTab') : t('profile.deleteAccountTitle')}</span>
        </button>
      </div>

      {/* Tab 1: Profile & Password */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Edit Info */}
          <div className="bg-white rounded-3xl p-6 border border-[#ECE9E6] shadow-sm space-y-4">
            <h3 className="font-extrabold text-sm text-[#1F2329] flex items-center gap-2">
              <User className="w-4 h-4 text-[#C8102E]" />
              <span>{isRTL ? 'البيانات الشخصية الأساسية' : 'Basic Profile Info'}</span>
            </h3>

            {profileMsg && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  profileMsg.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                <span>{profileMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#1F2329] mb-1">
                  {t('auth.name')}
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#ECE9E6] bg-[#FAF8F5] text-xs text-[#1F2329] outline-none focus:ring-2 focus:ring-[#C8102E]/20 focus:border-[#C8102E]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1F2329] mb-1">
                  {t('auth.email')}
                </label>
                <input
                  type="email"
                  disabled
                  value={userEmail || ''}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#ECE9E6] bg-[#ECE9E6]/50 text-xs text-[#595F69] font-mono cursor-not-allowed"
                />
              </div>

              <div>
                <span className="block text-xs font-bold text-[#1F2329] mb-1">
                  {isRTL ? 'نوع الحساب الحالي:' : 'Current Role:'}
                </span>
                <span className="inline-block bg-[#FAF8F5] border border-[#ECE9E6] text-[#1F2329] text-xs font-bold px-3 py-1 rounded-full">
                  {getRoleLabel(userRole, t)}
                </span>
              </div>

              <button
                type="submit"
                disabled={profileSaving}
                className="px-6 py-2.5 bg-[#C8102E] hover:bg-[#A80D26] text-white font-bold text-xs rounded-xl shadow-md shadow-[#C8102E]/20 disabled:opacity-50 transition-all"
              >
                {profileSaving ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : t('common.save')}
              </button>
            </form>
          </div>

          {/* Change Password */}
          <div className="bg-white rounded-3xl p-6 border border-[#ECE9E6] shadow-sm space-y-4">
            <h3 className="font-extrabold text-sm text-[#1F2329] flex items-center gap-2">
              <Key className="w-4 h-4 text-[#C8102E]" />
              <span>{t('profile.changePassword')}</span>
            </h3>

            {passwordMsg && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  passwordMsg.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                <span>{passwordMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#1F2329] mb-1">
                  {t('profile.currentPassword')}
                </label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#ECE9E6] bg-[#FAF8F5] text-xs text-[#1F2329] outline-none focus:ring-2 focus:ring-[#C8102E]/20 focus:border-[#C8102E]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1F2329] mb-1">
                  {t('profile.newPassword')}
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#ECE9E6] bg-[#FAF8F5] text-xs text-[#1F2329] outline-none focus:ring-2 focus:ring-[#C8102E]/20 focus:border-[#C8102E]"
                />
              </div>

              <button
                type="submit"
                disabled={passwordLoading}
                className="px-6 py-2.5 bg-[#1F2329] hover:bg-[#2B3039] text-white font-bold text-xs rounded-xl shadow-md disabled:opacity-50 transition-all"
              >
                {passwordLoading ? (isRTL ? 'جاري التحديث...' : 'Updating...') : (isRTL ? 'تحديث كلمة المرور' : 'Update Password')}
              </button>
            </form>
          </div>

          {/* Google Account Linking */}
          {googleEnabled && (
            <div className="bg-white rounded-3xl p-6 border border-[#ECE9E6] shadow-sm space-y-4 md:col-span-2">
              <div className="flex items-center justify-between border-b border-[#ECE9E6] pb-3">
                <h3 className="font-extrabold text-sm text-[#1F2329] flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-[#C8102E]" />
                  <span>{isRTL ? 'ربط الحساب بحساب Google' : 'Google Account Linking'}</span>
                </h3>
                <span className="text-[11px] bg-[#FAF8F5] text-[#1F2329] font-bold px-2.5 py-0.5 rounded-full border border-[#ECE9E6]">
                  {isRTL ? 'تسجيل دخول موحد' : 'SSO Integration'}
                </span>
              </div>

              <p className="text-xs text-[#595F69] leading-relaxed">
                {isRTL
                  ? 'يمكنك ربط حسابك الحالي بحساب Google لتسجيل الدخول السريع بنقرة واحدة مستقبلاً بأمان تام.'
                  : 'Link your existing marketplace account with your Google account for quick, secure one-click sign in.'}
              </p>

              {linkGoogleMsg && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    linkGoogleMsg.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-red-50 text-red-800 border border-red-200'
                  }`}
                >
                  <span>{linkGoogleMsg.text}</span>
                </div>
              )}

              <form onSubmit={handleLinkGoogleAccount} className="space-y-3 max-w-xl">
                <div>
                  <label className="block text-xs font-bold text-[#1F2329] mb-1">
                    {isRTL ? 'رمز تعريف Google ID Token:' : 'Google ID Token:'}
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={linkGoogleToken}
                    onChange={(e) => setLinkGoogleToken(e.target.value)}
                    placeholder="eyJhbGciOiJSUzI1NiIs..."
                    className="w-full px-3.5 py-2 rounded-xl border border-[#ECE9E6] bg-[#FAF8F5] text-xs font-mono text-[#1F2329] outline-none focus:ring-2 focus:ring-[#C8102E]/20 focus:border-[#C8102E]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={linkGoogleLoading}
                  className="px-6 py-2.5 bg-[#C8102E] hover:bg-[#A80D26] text-white font-bold text-xs rounded-xl shadow-md shadow-[#C8102E]/20 disabled:opacity-50 flex items-center gap-2 transition-all"
                >
                  <Link2 className="w-4 h-4" />
                  <span>
                    {linkGoogleLoading
                      ? (isRTL ? 'جاري الربط...' : 'Linking...')
                      : (isRTL ? 'ربط الحساب بـ Google' : 'Link with Google')}
                  </span>
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Tab: Buyer Wallet & Store Credit */}
      {activeTab === 'wallet' && (
        <div className="space-y-6">
          {/* Balance Overview Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#ECE9E6] shadow-sm flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-[#C8102E]/10 text-[#C8102E] flex items-center justify-center border border-[#C8102E]/20 shadow-sm flex-shrink-0">
                <Wallet className="w-8 h-8" />
              </div>
              <div>
                <span className="text-xs font-bold text-[#595F69] uppercase tracking-wider block">
                  {isRTL ? 'رصيد محفظتك المتاح للشراء (Store Credit)' : 'Available Store Credit Balance'}
                </span>
                <span className="text-3xl sm:text-4xl font-black text-[#1F2329] mt-1 block font-mono">
                  {formatCurrency(walletData?.balance || 0)}
                </span>
              </div>
            </div>

            <div className="text-xs text-[#595F69] bg-[#FAF8F5] px-4 py-3 rounded-2xl border border-[#ECE9E6] max-w-sm">
              <span className="font-bold text-[#1F2329] block mb-1">
                {isRTL ? 'كيف يعمل رصيد المحفظة؟' : 'How does Store Credit work?'}
              </span>
              <p className="text-[11px] text-[#595F69] leading-relaxed">
                {isRTL
                  ? 'يتم إيداع مبالغ المنتجات المرتجعة المقبولة تلقائياً في محفظتك، ويمكنك استخدامه في أي وقت لخصم قيمة مشترياتك في صفحة تأكيد الطلب.'
                  : 'Refunds from approved 14-day returns are automatically credited here. You can use it anytime during checkout to deduct from order totals.'}
              </p>
            </div>
          </div>

          {/* Transactions Ledger */}
          <div className="bg-white rounded-3xl border border-[#ECE9E6] p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[#ECE9E6] pb-3">
              <h3 className="font-black text-sm text-[#1F2329] flex items-center gap-2">
                <Coins className="w-4 h-4 text-[#C8102E]" />
                <span>{isRTL ? 'سجل حركات ومعاملات المحفظة' : 'Wallet Transaction Ledger'}</span>
              </h3>
              <span className="text-xs text-[#595F69] font-bold">
                {walletData?.transactions?.length || 0} {isRTL ? 'معاملة' : 'transactions'}
              </span>
            </div>

            {!walletData?.transactions || walletData.transactions.length === 0 ? (
              <div className="p-10 text-center text-[#595F69] text-xs space-y-2">
                <Coins className="w-10 h-10 text-[#D8D4CF] mx-auto" />
                <p className="font-bold text-[#1F2329]">
                  {isRTL ? 'لا توجد حركات سابقة على المحفظة' : 'No wallet transactions yet'}
                </p>
                <p className="text-[11px] text-[#595F69]">
                  {isRTL
                    ? 'ستظهر هنا أي عمليات استرداد أو استخدام للرصيد عند الشراء.'
                    : 'Any refunds from returns or checkout deductions will be listed here.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#ECE9E6]">
                {walletData.transactions.map((tx) => {
                  const isPositive = Number(tx.amount) > 0;
                  return (
                    <div
                      key={`tx-${tx.id}`}
                      className="py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                            isPositive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-[#FDF2F4] text-[#C8102E] border border-[#F8CAD1]'
                          }`}
                        >
                          {isPositive ? (
                            <ArrowDownLeft className="w-4 h-4" />
                          ) : (
                            <ArrowUpRight className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <span className="font-bold text-[#1F2329] block">
                            {tx.description || (isPositive ? (isRTL ? 'إيداع رصيد مسترد' : 'Refund Deposit') : (isRTL ? 'خصم مشتريات' : 'Order Payment'))}
                          </span>
                          <span className="text-[11px] text-[#8C929B]">
                            {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US') : ''}
                            {tx.orderId && ` • ${isRTL ? 'طلب #' : 'Order #'}${tx.orderId}`}
                            {tx.returnRequestId && ` • ${isRTL ? 'مرتجع #' : 'Return #'}${tx.returnRequestId}`}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`font-black text-sm font-mono ${
                          isPositive ? 'text-emerald-700' : 'text-[#C8102E]'
                        }`}
                      >
                        {isPositive ? '+' : ''}{formatCurrency(tx.amount)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Addresses */}
      {activeTab === 'addresses' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="font-extrabold text-sm text-[#1F2329]">
              {t('profile.addressesSection')} ({addresses.length})
            </h3>
            <button
              onClick={handleOpenAddAddress}
              className="px-4 py-2 bg-[#C8102E] hover:bg-[#A80D26] text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-[#C8102E]/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>{t('profile.addAddress')}</span>
            </button>
          </div>

          {addressesLoading ? (
            <div className="p-8 text-center text-xs text-[#595F69]">{t('common.loading')}</div>
          ) : addresses.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center border border-[#ECE9E6] text-xs text-[#595F69]">
              {isRTL ? 'لا توجد عناوين محفوظة بعد. أضف عنوانك لتسريع عملية الشراء.' : 'No saved addresses yet.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {addresses.map((addr) => (
                <div
                  key={`user-addr-${addr.id}`}
                  className="bg-white rounded-2xl p-5 border border-[#ECE9E6] hover:border-[#C8102E]/30 shadow-sm space-y-3 relative transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-sm text-[#1F2329] flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-[#C8102E]" />
                      <span>{addr.label || (isRTL ? 'عنوان' : 'Address')}</span>
                    </span>
                    {addr.isDefault && (
                      <span className="bg-[#FDF2F4] text-[#C8102E] border border-[#F8CAD1] text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {t('profile.defaultBadge')}
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-[#595F69] space-y-1">
                    <p className="font-bold text-[#1F2329]">{addr.recipientName}</p>
                    <p dir="ltr" className="font-mono text-[#595F69] text-end sm:text-start">{addr.recipientPhone}</p>
                    <p className="text-[#1F2329]">
                      {addr.governorate}، {addr.city}، {addr.area}
                    </p>
                    <p className="text-[#595F69]">{addr.streetBuilding}</p>
                    {(addr.buildingNumber || addr.floor || addr.apartment || addr.landmark) && (
                      <p className="text-[11px] text-[#8C929B]">
                        {[
                          addr.buildingNumber && `${isRTL ? 'مبنى' : 'Bldg'} ${addr.buildingNumber}`,
                          addr.floor && `${isRTL ? 'طابق' : 'Floor'} ${addr.floor}`,
                          addr.apartment && `${isRTL ? 'شقة' : 'Apt'} ${addr.apartment}`,
                          addr.landmark && `${isRTL ? 'علامة مميزة:' : 'Landmark:'} ${addr.landmark}`,
                        ].filter(Boolean).join(' • ')}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-[#ECE9E6] flex items-center justify-between">
                    <div className="flex items-center gap-1 text-[11px]">
                      {addr.latitude && addr.longitude ? (
                        <span className="text-emerald-700 font-bold flex items-center gap-1">
                          <Compass className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{isRTL ? 'إحداثيات GPS' : 'GPS Pinned'}</span>
                        </span>
                      ) : (
                        <span className="text-[#8C929B]">{isRTL ? 'عنوان عادي' : 'Standard Address'}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleOpenEditAddress(addr)}
                        className="text-xs text-[#C8102E] hover:text-[#A80D26] font-bold flex items-center gap-1 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>{isRTL ? 'تعديل' : 'Edit'}</span>
                      </button>
                      <button
                        onClick={() => handleDeleteAddress(addr.id)}
                        className="text-xs text-red-600 hover:text-red-700 font-semibold flex items-center gap-1 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{t('common.delete')}</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add / Edit Address Modal */}
          {showAddressModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in overflow-y-auto">
              <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-[#ECE9E6] space-y-4 my-8 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center border-b border-[#ECE9E6] pb-3">
                  <h3 className="font-extrabold text-sm text-[#1F2329] flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#C8102E]" />
                    <span>
                      {editingAddress
                        ? (isRTL ? 'تعديل بيانات العنوان' : 'Edit Saved Address')
                        : t('profile.addressModal.titleNew')}
                    </span>
                  </h3>
                  <button onClick={() => setShowAddressModal(false)} className="text-[#595F69] hover:text-[#1F2329]">
                    ✕
                  </button>
                </div>

                {addrError && (
                  <div className="bg-red-50 text-red-700 p-2.5 rounded-xl text-xs font-semibold border border-red-200">
                    {addrError}
                  </div>
                )}

                {/* Map Pin Adjuster Toggle */}
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setShowMapPicker(!showMapPicker)}
                    className="w-full py-2.5 px-3.5 rounded-xl border border-[#ECE9E6] bg-[#FAF8F5] hover:bg-[#ECE9E6] text-[#1F2329] text-xs font-bold flex items-center justify-between transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Compass className="w-4 h-4 text-[#C8102E]" />
                      <span>{isRTL ? 'تحديد الموقع على الخريطة (GPS)' : 'Pin Exact Location on Map (GPS)'}</span>
                    </span>
                    <span className="text-[11px] text-[#C8102E] underline">
                      {showMapPicker
                        ? (isRTL ? 'إخفاء الخريطة' : 'Hide Map')
                        : (isRTL ? 'إظهار الخريطة' : 'Show Map')}
                    </span>
                  </button>

                  {showMapPicker && (
                    <div className="rounded-2xl overflow-hidden border border-[#ECE9E6] h-64 w-full">
                      <MapAddressPicker
                        initialLat={addrLat}
                        initialLng={addrLng}
                        height="100%"
                        onLocationSelect={({ lat, lng, addressData }) => {
                          setAddrLat(lat);
                          setAddrLng(lng);
                          if (addressData?.governorate) setAddrGov(addressData.governorate);
                          if (addressData?.city) setAddrCity(addressData.city);
                          if (addressData?.area) setAddrArea(addressData.area);
                          if (addressData?.street) setAddrStreet(addressData.street);
                          if (addressData?.buildingNumber) setAddrBuildingNumber(addressData.buildingNumber);
                        }}
                      />
                    </div>
                  )}
                </div>

                <form onSubmit={handleSaveAddress} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-[#1F2329] mb-1">
                        {t('profile.addressModal.label')}
                      </label>
                      <input
                        type="text"
                        required
                        value={addrLabel}
                        onChange={(e) => setAddrLabel(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-[#ECE9E6] bg-[#FAF8F5] text-xs text-[#1F2329] outline-none focus:border-[#C8102E]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#1F2329] mb-1">
                        {t('profile.addressModal.recipientName')}
                      </label>
                      <input
                        type="text"
                        required
                        value={addrRecipient}
                        onChange={(e) => setAddrRecipient(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-[#ECE9E6] bg-[#FAF8F5] text-xs text-[#1F2329] outline-none focus:border-[#C8102E]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#1F2329] mb-1">
                      {t('profile.addressModal.recipientPhone')} *
                    </label>
                    <input
                      type="tel"
                      required
                      dir="ltr"
                      value={addrPhone}
                      onChange={(e) => setAddrPhone(e.target.value)}
                      placeholder="01012345678"
                      className="w-full px-3 py-2 rounded-xl border border-[#ECE9E6] bg-[#FAF8F5] text-xs text-[#1F2329] outline-none font-mono focus:border-[#C8102E]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-[#1F2329] mb-1">
                        {t('profile.addressModal.governorate')} *
                      </label>
                      <input
                        type="text"
                        required
                        value={addrGov}
                        onChange={(e) => setAddrGov(e.target.value)}
                        placeholder={isRTL ? 'القاهرة' : 'Cairo'}
                        className="w-full px-3 py-2 rounded-xl border border-[#ECE9E6] bg-[#FAF8F5] text-xs text-[#1F2329] outline-none focus:border-[#C8102E]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#1F2329] mb-1">
                        {t('profile.addressModal.city')} *
                      </label>
                      <input
                        type="text"
                        required
                        value={addrCity}
                        onChange={(e) => setAddrCity(e.target.value)}
                        placeholder={isRTL ? 'مدينة نصر' : 'Nasr City'}
                        className="w-full px-3 py-2 rounded-xl border border-[#ECE9E6] bg-[#FAF8F5] text-xs text-[#1F2329] outline-none focus:border-[#C8102E]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-[#1F2329] mb-1">
                        {t('profile.addressModal.area')} *
                      </label>
                      <input
                        type="text"
                        required
                        value={addrArea}
                        onChange={(e) => setAddrArea(e.target.value)}
                        placeholder={isRTL ? 'الحي السابع' : '7th District'}
                        className="w-full px-3 py-2 rounded-xl border border-[#ECE9E6] bg-[#FAF8F5] text-xs text-[#1F2329] outline-none focus:border-[#C8102E]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#1F2329] mb-1">
                        {t('profile.addressModal.streetBuilding')} *
                      </label>
                      <input
                        type="text"
                        required
                        value={addrStreet}
                        onChange={(e) => setAddrStreet(e.target.value)}
                        placeholder={isRTL ? 'شارع الطيران، عمارة 15' : '15 Tayaran St'}
                        className="w-full px-3 py-2 rounded-xl border border-[#ECE9E6] bg-[#FAF8F5] text-xs text-[#1F2329] outline-none focus:border-[#C8102E]"
                      />
                    </div>
                  </div>

                  {/* Detailed building & apartment info */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-[#1F2329] mb-1">
                        {isRTL ? 'رقم العمارة / المبنى' : 'Building #'}
                      </label>
                      <input
                        type="text"
                        value={addrBuildingNumber}
                        onChange={(e) => setAddrBuildingNumber(e.target.value)}
                        placeholder="15"
                        className="w-full px-3 py-2 rounded-xl border border-[#ECE9E6] bg-[#FAF8F5] text-xs text-[#1F2329] outline-none focus:border-[#C8102E]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#1F2329] mb-1">
                        {isRTL ? 'الطابق' : 'Floor'}
                      </label>
                      <input
                        type="text"
                        value={addrFloor}
                        onChange={(e) => setAddrFloor(e.target.value)}
                        placeholder="3"
                        className="w-full px-3 py-2 rounded-xl border border-[#ECE9E6] bg-[#FAF8F5] text-xs text-[#1F2329] outline-none focus:border-[#C8102E]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#1F2329] mb-1">
                        {isRTL ? 'رقم الشقة' : 'Apartment'}
                      </label>
                      <input
                        type="text"
                        value={addrApartment}
                        onChange={(e) => setAddrApartment(e.target.value)}
                        placeholder="12"
                        className="w-full px-3 py-2 rounded-xl border border-[#ECE9E6] bg-[#FAF8F5] text-xs text-[#1F2329] outline-none focus:border-[#C8102E]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#1F2329] mb-1">
                      {isRTL ? 'علامة مميزة (اختياري)' : 'Landmark (Optional)'}
                    </label>
                    <input
                      type="text"
                      value={addrLandmark}
                      onChange={(e) => setAddrLandmark(e.target.value)}
                      placeholder={isRTL ? 'بجوار صيدلية العزبي' : 'Next to El-Ezaby Pharmacy'}
                      className="w-full px-3 py-2 rounded-xl border border-[#ECE9E6] bg-[#FAF8F5] text-xs text-[#1F2329] outline-none focus:border-[#C8102E]"
                    />
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer pt-2">
                    <input
                      type="checkbox"
                      checked={addrIsDefault}
                      onChange={(e) => setAddrIsDefault(e.target.checked)}
                      className="rounded accent-[#C8102E]"
                    />
                    <span className="text-xs text-[#595F69] font-medium">
                      {t('profile.addressModal.isDefault')}
                    </span>
                  </label>

                  <div className="flex justify-end gap-2 pt-3 border-t border-[#ECE9E6]">
                    <button
                      type="button"
                      onClick={() => setShowAddressModal(false)}
                      className="px-4 py-2 bg-[#FAF8F5] hover:bg-[#ECE9E6] text-[#595F69] text-xs font-bold rounded-xl transition-colors"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      type="submit"
                      disabled={addrSaving}
                      className="px-5 py-2 bg-[#C8102E] hover:bg-[#A80D26] text-white text-xs font-bold rounded-xl shadow-md shadow-[#C8102E]/20 disabled:opacity-50 transition-all"
                    >
                      {addrSaving ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : t('common.save')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Service Status & Account Deletion */}
      {activeTab === 'privacy' && (
        <div className="space-y-6">
          <div className={`grid grid-cols-1 ${isBuyer ? 'md:grid-cols-3' : 'max-w-lg'} gap-6`}>
            {isBuyer && (
              <>
                {/* Box 1: Refused Deliveries */}
                <div className="bg-white rounded-3xl p-6 border border-[#ECE9E6] shadow-sm flex flex-col justify-between space-y-4">
                  <div>
                    <div className="w-10 h-10 rounded-2xl bg-[#FDF2F4] text-[#C8102E] border border-[#F8CAD1] flex items-center justify-center mb-3">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <h4 className="font-extrabold text-sm text-[#1F2329]">
                      {t('profile.refusedDeliveriesTitle')}
                    </h4>
                    <span className="text-3xl font-black text-[#1F2329] block mt-3">
                      {buyerStats?.refusedDeliveriesCount || 0}
                    </span>
                  </div>
                  <span className="text-[11px] text-[#595F69] block pt-3 border-t border-[#ECE9E6]">
                    {t('profile.refusedDeliveriesHint')}
                  </span>
                </div>

                {/* Box 2: COD Service Status */}
                <div className="bg-white rounded-3xl p-6 border border-[#ECE9E6] shadow-sm flex flex-col justify-between space-y-4">
                  <div>
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-3 ${
                        buyerStats?.canUseCod !== false
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-[#FDF2F4] text-[#C8102E] border border-[#F8CAD1]'
                      }`}
                    >
                      <CheckCircle className="w-5 h-5" />
                    </div>
                    <h4 className="font-extrabold text-sm text-[#1F2329]">
                      {t('profile.codStatusTitle')}
                    </h4>
                  </div>
                  <div className="pt-3 border-t border-[#ECE9E6]">
                    <span
                      className={`inline-block font-black text-xs px-3.5 py-1.5 rounded-full ${
                        buyerStats?.canUseCod !== false
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-[#FDF2F4] text-[#C8102E] border border-[#F8CAD1]'
                      }`}
                    >
                      {buyerStats?.canUseCod !== false
                        ? t('profile.codStatusActive')
                        : t('profile.codStatusRestricted')}
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* Box 3: Account Deletion */}
            <div className="bg-white rounded-3xl p-6 border border-red-200/80 shadow-sm space-y-4 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 border border-red-200 flex items-center justify-center mb-3">
                  <Trash2 className="w-5 h-5" />
                </div>
                <h4 className="font-extrabold text-sm text-red-700">
                  {t('profile.deleteAccountTitle')}
                </h4>
                <p className="text-xs text-[#595F69] leading-relaxed mt-2">
                  {t('profile.deleteAccountDesc')}
                </p>
              </div>

              <button
                onClick={() => setShowDeleteModal(true)}
                className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-md transition-all"
              >
                <Trash2 className="w-4 h-4" />
                <span>{t('profile.deleteAccount')}</span>
              </button>
            </div>
          </div>

          {/* Delete Account Modal */}
          {showDeleteModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-red-200 space-y-4">
                <div className="flex items-center gap-3 text-red-600">
                  <div className="w-10 h-10 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-[#1F2329]">
                      {t('profile.deleteConfirmTitle')}
                    </h3>
                    <span className="text-[11px] text-red-600 font-bold">
                      {isRTL ? 'إجراء لا يمكن التراجع عنه' : 'Irreversible Action'}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-[#595F69] leading-relaxed">
                  {t('profile.deleteWarning')}
                </p>

                {deleteError && (
                  <div className="bg-red-50 text-red-800 p-3 rounded-xl text-xs font-semibold border border-red-200">
                    {deleteError}
                  </div>
                )}

                {googleEnabled && (
                  <div className="flex border border-[#ECE9E6] rounded-xl p-1 bg-[#FAF8F5] text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteAuthMethod('password');
                        setDeleteError(null);
                      }}
                      className={`flex-1 py-1.5 rounded-lg transition-all ${
                        deleteAuthMethod === 'password'
                          ? 'bg-white shadow text-[#1F2329] font-black'
                          : 'text-[#595F69] hover:text-[#1F2329]'
                      }`}
                    >
                      {t('profile.currentPassword')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteAuthMethod('google');
                        setDeleteError(null);
                      }}
                      className={`flex-1 py-1.5 rounded-lg transition-all ${
                        deleteAuthMethod === 'google'
                          ? 'bg-white shadow text-[#1F2329] font-black'
                          : 'text-[#595F69] hover:text-[#1F2329]'
                      }`}
                    >
                      {isRTL ? 'رمز Google ID Token' : 'Google ID Token'}
                    </button>
                  </div>
                )}

                <form onSubmit={handleDeleteAccount} className="space-y-4">
                  {deleteAuthMethod === 'password' ? (
                    <div>
                      <label className="block text-xs font-bold text-[#1F2329] mb-1">
                        {t('profile.deleteConfirmText')}
                      </label>
                      <input
                        type="password"
                        required
                        value={deletePassword}
                        onChange={(e) => setDeletePassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#ECE9E6] bg-[#FAF8F5] text-xs text-[#1F2329] outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-bold text-[#1F2329] mb-1">
                        {isRTL
                          ? 'أدخل رمز Google ID Token (لحسابات تسجيل الدخول بـ Google):'
                          : 'Enter Google ID Token (For Google SSO accounts):'}
                      </label>
                      <textarea
                        required
                        rows={3}
                        value={deleteGoogleToken}
                        onChange={(e) => setDeleteGoogleToken(e.target.value)}
                        placeholder="eyJhbGciOiJSUzI1NiIs..."
                        className="w-full px-3.5 py-2 rounded-xl border border-[#ECE9E6] bg-[#FAF8F5] text-xs font-mono text-[#1F2329] outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2 border-t border-[#ECE9E6]">
                    <button
                      type="button"
                      onClick={() => setShowDeleteModal(false)}
                      className="px-4 py-2 bg-[#FAF8F5] hover:bg-[#ECE9E6] text-[#595F69] text-xs font-bold rounded-xl transition-colors"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      type="submit"
                      disabled={deleteLoading}
                      className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-md disabled:opacity-50 transition-all"
                    >
                      {deleteLoading ? (isRTL ? 'جاري الحذف...' : 'Deleting...') : (isRTL ? 'نعم، احذف حسابي' : 'Yes, Delete Account')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
