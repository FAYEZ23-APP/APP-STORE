import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  User,
  MapPin,
  Shield,
  Trash2,
  Key,
  CheckCircle,
  AlertTriangle,
  Wallet,
  Coins,
  ArrowDownLeft,
  ArrowUpRight,
  Compass,
  Link2,
  HelpCircle,
  Headphones,
  Truck,
  RotateCcw,
  Banknote,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getMyProfile,
  updateMyProfile,
  changePassword,
  getMyAddresses,
  createMyAddress,
  updateMyAddress,
  deleteMyAddress,
  getMyBuyerStats,
  getBuyerDashboard,
  getSellerDashboard,
  getMySellerProfile,
  updateMySellerProfile,
  getMyWallet,
  exportMyData,
  deleteMyAccount,
} from '../api/usersApi';
import client from '../api/client';
import { linkGoogle } from '../api/authApi';
import { fetchSafeAppConfig } from '../api/configApi';
import MapAddressPicker from '../components/MapAddressPicker';
import { isValidEgyptianPhone, normalizeEgyptianPhone } from '../utils/egyptianPhone';
import { formatCurrency } from '../utils/currency';

import {
  ProfileHeaderCard,
  AccountStatistics,
  OrderTrackingCard,
  AddressBookCard,
  SellerDispatchCard,
  AccountSettingsSection,
} from '../components/profile';

export default function ProfilePage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { userName, userEmail, userRole, logout } = useAuth();
  const isBuyer = userRole === 'Buyer';
  const isSeller = userRole === 'Seller';

  const settingsRef = useRef(null);

  // Profile Data State
  const [profile, setProfile] = useState(null);
  const [name, setName] = useState(userName || '');
  const [showEditNameModal, setShowEditNameModal] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState(null);

  // Password State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState(null);

  // Addresses State
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
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [linkGoogleToken, setLinkGoogleToken] = useState('');
  const [linkGoogleLoading, setLinkGoogleLoading] = useState(false);
  const [linkGoogleMsg, setLinkGoogleMsg] = useState(null);

  // Dashboards & Statistics State
  const [buyerDashboard, setBuyerDashboard] = useState(null);
  const [sellerDashboard, setSellerDashboard] = useState(null);
  const [sellerProfile, setSellerProfile] = useState(null);
  const [sellerOrdersSummary, setSellerOrdersSummary] = useState(null);
  const [sellerProductsCount, setSellerProductsCount] = useState(0);
  const [walletData, setWalletData] = useState(null);
  const [walletEnabled, setWalletEnabled] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);

  // Seller Dispatch Settings Modal State
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [showDispatchMapPicker, setShowDispatchMapPicker] = useState(false);
  const [dispatchCity, setDispatchCity] = useState(isRTL ? 'القاهرة' : 'Cairo');
  const [dispatchAddress, setDispatchAddress] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [dispatchSaving, setDispatchSaving] = useState(false);
  const [dispatchMsg, setDispatchMsg] = useState(null);
  const [showPersonalAddresses, setShowPersonalAddresses] = useState(false);

  // Help Center FAQ Modal State
  const [showHelpModal, setShowHelpModal] = useState(false);

  // PDPL 151/2020 State
  const [exportingData, setExportingData] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteAuthMethod, setDeleteAuthMethod] = useState('password'); // 'password' | 'google'
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteGoogleToken, setDeleteGoogleToken] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  // Initial Data Loading
  const loadProfile = async () => {
    try {
      const res = await getMyProfile();
      if (res?.data) {
        setProfile(res.data);
        setName(res.data.name || '');
      }
    } catch (e) {
      console.warn('Failed to load profile', e);
    }
  };

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

  const loadBuyerData = async () => {
    try {
      const [dashRes, walletRes] = await Promise.allSettled([
        getBuyerDashboard(),
        getMyWallet(),
      ]);
      if (dashRes.status === 'fulfilled' && dashRes.value?.data) {
        setBuyerDashboard(dashRes.value.data);
      }
      if (walletRes.status === 'fulfilled' && walletRes.value?.data) {
        setWalletData(walletRes.value.data);
      }
    } catch (e) {
      console.warn('Failed to load buyer data', e);
    }
  };

  const loadSellerData = async () => {
    try {
      const [dashRes, productsRes, profileRes, ordersRes] = await Promise.allSettled([
        getSellerDashboard(),
        client.get('/products/my-products'),
        getMySellerProfile(),
        client.get('/orders/seller'),
      ]);
      if (dashRes.status === 'fulfilled' && dashRes.value?.data) {
        setSellerDashboard(dashRes.value.data);
      }
      if (productsRes.status === 'fulfilled' && Array.isArray(productsRes.value?.data)) {
        setSellerProductsCount(productsRes.value.data.length);
      }
      if (profileRes.status === 'fulfilled' && profileRes.value?.data) {
        setSellerProfile(profileRes.value.data);
        setDispatchCity(profileRes.value.data.dispatchCity || (isRTL ? 'القاهرة' : 'Cairo'));
        setDispatchAddress(profileRes.value.data.dispatchAddress || '');
        setContactPhone(profileRes.value.data.contactPhone || '');
      }
      if (ordersRes.status === 'fulfilled' && Array.isArray(ordersRes.value?.data)) {
        const orders = ordersRes.value.data;
        const summary = {
          processingCount: orders.filter((o) => o.status === 'Processing').length,
          inTransitCount: orders.filter((o) => o.status === 'InTransit').length,
          readyForPickupCount: orders.filter((o) => o.status === 'ReadyForPickup').length,
          deliveredCount: orders.filter((o) => o.status === 'Delivered').length,
          returnedCount: orders.filter((o) => o.status === 'Returned').length,
        };
        setSellerOrdersSummary(summary);
      }
    } catch (e) {
      console.warn('Failed to load seller data', e);
    }
  };

  useEffect(() => {
    loadProfile();
    loadAddresses();

    if (isBuyer) {
      loadBuyerData();
    } else if (isSeller) {
      loadSellerData();
    }

    fetchSafeAppConfig().then((cfg) => {
      setGoogleEnabled(Boolean(cfg?.googleEnabled));
      setWalletEnabled(Boolean(cfg?.walletEnabled));
    });
  }, [isBuyer, isSeller]);

  // Update Profile Name
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      await updateMyProfile({ name: name.trim() });
      setProfileMsg({ type: 'success', text: isRTL ? 'تم حفظ التعديلات بنجاح' : 'Profile updated successfully' });
      await loadProfile();
      setTimeout(() => setShowEditNameModal(false), 900);
    } catch (err) {
      setProfileMsg({ type: 'error', text: isRTL ? 'فشل حفظ التعديلات' : 'Failed to update profile' });
    } finally {
      setProfileSaving(false);
    }
  };

  // Update Seller Dispatch Settings
  const handleSaveDispatch = async (e) => {
    e.preventDefault();
    if (!dispatchCity.trim()) {
      setDispatchMsg({ type: 'error', text: isRTL ? 'يرجى تحديد محافظة الشحن' : 'Please select dispatch city' });
      return;
    }
    if (contactPhone && !isValidEgyptianPhone(contactPhone)) {
      setDispatchMsg({ type: 'error', text: isRTL ? 'يرجى إدخال رقم موبايل مصري صحيح (010, 011, 012, 015)' : 'Please enter valid Egyptian phone' });
      return;
    }
    try {
      setDispatchSaving(true);
      setDispatchMsg(null);
      await updateMySellerProfile({
        dispatchCity: dispatchCity.trim(),
        dispatchAddress: dispatchAddress.trim() || null,
        contactPhone: contactPhone ? normalizeEgyptianPhone(contactPhone) : null,
      });
      setDispatchMsg({ type: 'success', text: isRTL ? 'تم حفظ بيانات المخزن والشحن بنجاح' : 'Dispatch settings saved successfully' });
      await loadSellerData();
      setTimeout(() => setShowDispatchModal(false), 900);
    } catch (err) {
      setDispatchMsg({ type: 'error', text: isRTL ? 'فشل حفظ بيانات الشحن' : 'Failed to save dispatch settings' });
    } finally {
      setDispatchSaving(false);
    }
  };

  // Change Password
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordMsg(null);

    if (newPassword !== confirmPassword) {
      setPasswordMsg({
        type: 'error',
        text: isRTL ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match',
      });
      return;
    }

    setPasswordLoading(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setPasswordMsg({ type: 'success', text: t('profile.passwordChanged') });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setShowPasswordModal(false), 1200);
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
      setTimeout(() => setShowGoogleModal(false), 1200);
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
    setAddrRecipient(profile?.name || userName || '');
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

  // Save Address
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

  // Set Default Address
  const handleSetDefaultAddress = async (addr) => {
    try {
      await updateMyAddress(addr.id, { ...addr, isDefault: true });
      await loadAddresses();
    } catch (e) {
      alert(t('common.error'));
    }
  };

  // PDPL Data Export
  const handleExportData = async () => {
    setExportingData(true);
    try {
      const res = await exportMyData();
      if (res?.data) {
        const jsonStr = `data:text/json;charset=utf-8,${encodeURIComponent(
          JSON.stringify(res.data, null, 2)
        )}`;
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute('href', jsonStr);
        downloadAnchor.setAttribute('download', `marketplace-personal-data-${profile?.id || 'export'}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
      }
    } catch (e) {
      alert(isRTL ? 'تعذر تصدير البيانات الشخصية' : 'Failed to export personal data');
    } finally {
      setExportingData(false);
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

  // Open WhatsApp Support
  const handleOpenSupportWhatsApp = () => {
    const defaultSupportPhone = '201000000000';
    const message = encodeURIComponent(
      isRTL
        ? `مرحباً، أود الاستفسار بخصوص حسابي في سوق مصر (${profile?.email || ''})`
        : `Hello, I have an inquiry regarding my Egypt Shop account (${profile?.email || ''})`
    );
    window.open(`https://wa.me/${defaultSupportPhone}?text=${message}`, '_blank');
  };

  // Language Change
  const handleLanguageChange = (lang) => {
    if (i18n.language === lang) return;
    i18n.changeLanguage(lang);
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  };

  // Logout
  const handleLogout = () => {
    if (window.confirm(t('profile.logoutConfirm'))) {
      logout();
      window.location.href = '/';
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      {/* ─── 1. Profile Header Identity Card ─── */}
      <ProfileHeaderCard
        profile={profile}
        userRole={userRole}
        sellerDashboard={sellerDashboard}
        onEditProfile={() => setShowEditNameModal(true)}
        onOpenSettings={() => {
          settingsRef.current?.scrollIntoView({ behavior: 'smooth' });
        }}
      />

      {/* ─── 2. Account Statistics Cards ─── */}
      <AccountStatistics
        role={userRole}
        buyerDashboard={buyerDashboard}
        sellerDashboard={sellerDashboard}
        sellerProductsCount={sellerProductsCount}
        addressesCount={addresses.length}
        onAddressClick={handleOpenAddAddress}
      />

      {/* ─── 3. Order Tracking Hub (Buyers & Sellers) ─── */}
      <OrderTrackingCard
        role={userRole}
        buyerDashboard={buyerDashboard}
        sellerDashboard={sellerDashboard}
        sellerOrdersSummary={sellerOrdersSummary}
      />

      {/* ─── 4. Logistics & Address Hub ─── */}
      {isSeller ? (
        <div className="space-y-4">
          <SellerDispatchCard
            sellerProfile={sellerProfile}
            onEditDispatch={() => setShowDispatchModal(true)}
            onLocateOnMap={() => {
              setShowDispatchModal(true);
              setShowDispatchMapPicker(true);
            }}
          />

          {/* Optional Personal Addresses for Shopping */}
          <div className="bg-white rounded-3xl p-5 border border-[#ECE9E6] shadow-sm">
            <button
              type="button"
              onClick={() => setShowPersonalAddresses((prev) => !prev)}
              className="w-full flex items-center justify-between text-start"
            >
              <div>
                <h3 className="text-xs font-black text-[#1F2329]">
                  {t('profile.sellerPersonalAddresses', 'العناوين الشخصية للتسوق')} ({addresses.length})
                </h3>
                <p className="text-[11px] text-[#595F69] mt-0.5">
                  {t('profile.sellerPersonalAddressesDesc', 'عناوينك الخاصة في حال قمت بالشراء من تجار آخرين')}
                </p>
              </div>
              <span className="text-xs font-bold text-[#C8102E] hover:underline">
                {showPersonalAddresses ? (isRTL ? 'إخفاء' : 'Hide') : (isRTL ? 'عرض العناوين' : 'Show')}
              </span>
            </button>

            {showPersonalAddresses && (
              <div className="mt-4 pt-4 border-t border-[#ECE9E6]">
                <AddressBookCard
                  addresses={addresses}
                  loading={addressesLoading}
                  onAddNewAddress={handleOpenAddAddress}
                  onEditAddress={handleOpenEditAddress}
                  onDeleteAddress={handleDeleteAddress}
                  onSetDefault={handleSetDefaultAddress}
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        <AddressBookCard
          addresses={addresses}
          loading={addressesLoading}
          onAddNewAddress={handleOpenAddAddress}
          onEditAddress={handleOpenEditAddress}
          onDeleteAddress={handleDeleteAddress}
          onSetDefault={handleSetDefaultAddress}
        />
      )}

      {/* ─── 5. Account Settings & Grouped Quick Services ─── */}
      <div ref={settingsRef}>
        <AccountSettingsSection
          role={userRole}
          walletEnabled={walletEnabled}
          walletBalance={walletData?.balance || 0}
          onOpenWalletTab={() => setShowWalletModal(true)}
          onEditName={() => setShowEditNameModal(true)}
          onChangePassword={() => setShowPasswordModal(true)}
          googleEnabled={googleEnabled}
          onLinkGoogle={() => setShowGoogleModal(true)}
          linkGoogleLoading={linkGoogleLoading}
          isArabicActive={isRTL}
          onLanguageChange={handleLanguageChange}
          onOpenSupportWhatsApp={handleOpenSupportWhatsApp}
          onOpenHelpCenter={() => setShowHelpModal(true)}
          onExportData={handleExportData}
          exportingData={exportingData}
          onDeleteAccount={() => setShowDeleteModal(true)}
          onLogout={handleLogout}
        />
      </div>

      {/* ─── MODAL 1: Edit Name ─── */}
      {showEditNameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#ECE9E6] space-y-4">
            <div className="flex items-center justify-between border-b border-[#ECE9E6] pb-3">
              <h3 className="font-black text-sm text-[#1F2329] flex items-center gap-2">
                <User className="w-4 h-4 text-[#C8102E]" />
                <span>{t('profile.editName')}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowEditNameModal(false)}
                className="text-[#595F69] hover:text-[#1F2329]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

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

              <div className="flex justify-end gap-2 pt-2 border-t border-[#ECE9E6]">
                <button
                  type="button"
                  onClick={() => setShowEditNameModal(false)}
                  className="px-4 py-2 bg-[#FAF8F5] hover:bg-[#ECE9E6] text-[#595F69] text-xs font-bold rounded-xl transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="px-5 py-2 bg-[#C8102E] hover:bg-[#A80D26] text-white text-xs font-bold rounded-xl shadow-md shadow-[#C8102E]/20 disabled:opacity-50 transition-all"
                >
                  {profileSaving ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: Change Password ─── */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#ECE9E6] space-y-4">
            <div className="flex items-center justify-between border-b border-[#ECE9E6] pb-3">
              <h3 className="font-black text-sm text-[#1F2329] flex items-center gap-2">
                <Key className="w-4 h-4 text-[#C8102E]" />
                <span>{t('profile.changePassword')}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                className="text-[#595F69] hover:text-[#1F2329]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

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

            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#1F2329] mb-1">
                  {t('profile.currentPassword')} *
                </label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#ECE9E6] bg-[#FAF8F5] text-xs text-[#1F2329] outline-none focus:border-[#C8102E]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1F2329] mb-1">
                  {t('profile.newPassword')} *
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#ECE9E6] bg-[#FAF8F5] text-xs text-[#1F2329] outline-none focus:border-[#C8102E]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1F2329] mb-1">
                  {t('profile.confirmNewPassword')} *
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#ECE9E6] bg-[#FAF8F5] text-xs text-[#1F2329] outline-none focus:border-[#C8102E]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#ECE9E6]">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2 bg-[#FAF8F5] hover:bg-[#ECE9E6] text-[#595F69] text-xs font-bold rounded-xl transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="px-5 py-2 bg-[#C8102E] hover:bg-[#A80D26] text-white text-xs font-bold rounded-xl shadow-md shadow-[#C8102E]/20 disabled:opacity-50 transition-all"
                >
                  {passwordLoading ? (isRTL ? 'جاري التحديث...' : 'Updating...') : t('profile.updatePassword')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 3: Egyptian Address Book Create / Edit ─── */}
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
              <button
                type="button"
                onClick={() => setShowAddressModal(false)}
                className="text-[#595F69] hover:text-[#1F2329]"
              >
                <X className="w-5 h-5" />
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

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#1F2329] mb-1">
                    {isRTL ? 'رقم العمارة' : 'Bldg #'}
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
                    {isRTL ? 'رقم الشقة' : 'Apt #'}
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

      {/* ─── MODAL 4: Help Center & FAQs ─── */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-[#ECE9E6] space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#ECE9E6] pb-3">
              <h3 className="font-black text-sm text-[#1F2329] flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-[#C8102E]" />
                <span>{t('profile.helpCenter')}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="text-[#595F69] hover:text-[#1F2329]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* FAQ 1: Shipping */}
              <div className="p-4 bg-[#FAF8F5] rounded-2xl border border-[#ECE9E6] space-y-1">
                <h4 className="font-bold text-[#1F2329] flex items-center gap-2">
                  <Truck className="w-4 h-4 text-[#C8102E]" />
                  <span>{t('profile.faqShipping')}</span>
                </h4>
                <p className="text-[#595F69] leading-relaxed text-[11px]">
                  {t('profile.faqShippingAnswer')}
                </p>
              </div>

              {/* FAQ 2: 14-day Returns */}
              <div className="p-4 bg-[#FAF8F5] rounded-2xl border border-[#ECE9E6] space-y-1">
                <h4 className="font-bold text-[#1F2329] flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-amber-600" />
                  <span>{t('profile.faqReturns')}</span>
                </h4>
                <p className="text-[#595F69] leading-relaxed text-[11px]">
                  {t('profile.faqReturnsAnswer')}
                </p>
              </div>

              {/* FAQ 3: COD */}
              <div className="p-4 bg-[#FAF8F5] rounded-2xl border border-[#ECE9E6] space-y-1">
                <h4 className="font-bold text-[#1F2329] flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-emerald-600" />
                  <span>{t('profile.faqCod')}</span>
                </h4>
                <p className="text-[#595F69] leading-relaxed text-[11px]">
                  {t('profile.faqCodAnswer')}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowHelpModal(false);
                handleOpenSupportWhatsApp();
              }}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-md transition-all mt-4"
            >
              <Headphones className="w-4 h-4" />
              <span>{t('profile.customerSupport')}</span>
            </button>
          </div>
        </div>
      )}

      {/* ─── MODAL 5: Store Credit Wallet ─── */}
      {showWalletModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-[#ECE9E6] space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#ECE9E6] pb-3">
              <h3 className="font-black text-sm text-[#1F2329] flex items-center gap-2">
                <Wallet className="w-5 h-5 text-[#D6A33A]" />
                <span>{t('profile.walletTxModalTitle')}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowWalletModal(false)}
                className="text-[#595F69] hover:text-[#1F2329]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current Balance Card */}
            <div className="bg-amber-50/60 rounded-2xl p-4 border border-amber-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-amber-900 block">
                  {t('profile.availableBalanceLabel')}
                </span>
                <span className="text-2xl font-black text-[#1F2329] font-mono mt-0.5 block">
                  {formatCurrency(walletData?.balance || 0)}
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-100 text-[#D6A33A] flex items-center justify-center">
                <Coins className="w-6 h-6" />
              </div>
            </div>

            <p className="text-[11px] text-[#595F69] leading-relaxed">
              {t('profile.buyerWalletNotice')}
            </p>

            <div className="border-t border-[#ECE9E6] pt-3">
              <h4 className="text-xs font-bold text-[#1F2329] mb-2">
                {t('profile.previousTxLabel', { count: walletData?.transactions?.length || 0 })}
              </h4>

              {!walletData?.transactions || walletData.transactions.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#595F69]">
                  {t('profile.noPreviousTx')}
                </div>
              ) : (
                <div className="divide-y divide-[#ECE9E6] max-h-60 overflow-y-auto">
                  {walletData.transactions.map((tx) => {
                    const isPositive = Number(tx.amount) > 0;
                    return (
                      <div
                        key={`modal-tx-${tx.id}`}
                        className="py-2.5 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                              isPositive
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-red-50 text-red-600'
                            }`}
                          >
                            {isPositive ? (
                              <ArrowDownLeft className="w-3.5 h-3.5" />
                            ) : (
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            )}
                          </div>
                          <div>
                            <span className="font-bold text-[#1F2329] block text-[11px]">
                              {tx.description || (isPositive ? t('profile.refundCredit') : t('profile.orderRedemption'))}
                            </span>
                            <span className="text-[10px] text-[#8C929B]">
                              {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US') : ''}
                            </span>
                          </div>
                        </div>

                        <span
                          className={`font-mono font-bold text-xs ${
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
        </div>
      )}

      {/* ─── MODAL 6: Google SSO Account Linking ─── */}
      {showGoogleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#ECE9E6] space-y-4">
            <div className="flex items-center justify-between border-b border-[#ECE9E6] pb-3">
              <h3 className="font-black text-sm text-[#1F2329] flex items-center gap-2">
                <Link2 className="w-4 h-4 text-blue-600" />
                <span>{t('profile.googleLinkingTitle')}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowGoogleModal(false)}
                className="text-[#595F69] hover:text-[#1F2329]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#595F69] leading-relaxed">
              {t('profile.googleLinkingDesc')}
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

            <form onSubmit={handleLinkGoogleAccount} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#1F2329] mb-1">
                  {t('profile.googleIdTokenLabel')}:
                </label>
                <textarea
                  rows={3}
                  required
                  value={linkGoogleToken}
                  onChange={(e) => setLinkGoogleToken(e.target.value)}
                  placeholder={t('profile.googleIdTokenPlaceholder')}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#ECE9E6] bg-[#FAF8F5] text-xs font-mono text-[#1F2329] outline-none focus:border-[#C8102E]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#ECE9E6]">
                <button
                  type="button"
                  onClick={() => setShowGoogleModal(false)}
                  className="px-4 py-2 bg-[#FAF8F5] hover:bg-[#ECE9E6] text-[#595F69] text-xs font-bold rounded-xl transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={linkGoogleLoading}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md disabled:opacity-50 transition-all flex items-center gap-1.5"
                >
                  <Link2 className="w-4 h-4" />
                  <span>{linkGoogleLoading ? t('common.loading') : t('profile.linkGoogleBtn')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 7: Delete Account Confirmation (PDPL 151/2020) ─── */}
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
                  {isRTL ? 'إجراء لا يمكن التراجع عنه (قانون 151/2020)' : 'Irreversible Action (PDPL 151/2020)'}
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
      {/* ─── MODAL 8: Edit Seller Dispatch Warehouse Settings ─── */}
      {showDispatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-[#ECE9E6] space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#ECE9E6] pb-3">
              <h3 className="font-black text-sm text-[#1F2329] flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#D6A33A]" />
                <span>{t('profile.editDispatchSettings', 'تعديل بيانات المخزن والشحن')}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowDispatchModal(false)}
                className="text-[#595F69] hover:text-[#1F2329]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {dispatchMsg && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  dispatchMsg.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                <span>{dispatchMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleSaveDispatch} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#1F2329] mb-1">
                  {t('profile.mainDispatchCity', 'محافظة الشحن الرئيسية *')}
                </label>
                <input
                  type="text"
                  required
                  value={dispatchCity}
                  onChange={(e) => setDispatchCity(e.target.value)}
                  placeholder={isRTL ? 'مثال: القاهرة، الجيزة، الإسكندرية' : 'e.g., Cairo, Giza, Alexandria'}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#ECE9E6] bg-[#FAF8F5] text-xs text-[#1F2329] outline-none focus:ring-2 focus:ring-[#D6A33A]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1F2329] mb-1">
                  {t('profile.detailedDispatchAddress', 'عنوان المخزن أو المعرض بالتفصيل')}
                </label>
                <textarea
                  rows={2}
                  value={dispatchAddress}
                  onChange={(e) => setDispatchAddress(e.target.value)}
                  placeholder={isRTL ? 'الشارع، رقم المبنى، الحي، أقرب علامة مميزة لمندوب بوسطة' : 'Street, building, area, landmark for courier pickup'}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#ECE9E6] bg-[#FAF8F5] text-xs text-[#1F2329] outline-none focus:ring-2 focus:ring-[#D6A33A]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1F2329] mb-1">
                  {t('profile.contactPhoneRepresentative', 'موبايل مندوب الاستلام')}
                </label>
                <input
                  type="tel"
                  dir="ltr"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="01012345678"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#ECE9E6] bg-[#FAF8F5] text-xs text-[#1F2329] font-mono outline-none focus:ring-2 focus:ring-[#D6A33A]"
                />
              </div>

              {/* Map Address Picker Toggle */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowDispatchMapPicker((prev) => !prev)}
                  className="text-xs font-bold text-[#C8102E] hover:underline flex items-center gap-1.5"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>
                    {showDispatchMapPicker
                      ? (isRTL ? 'إخفاء الخريطة' : 'Hide Map')
                      : (isRTL ? 'تحديد وتأكيد موقع المخزن على خريطة Google 📍' : 'Pin warehouse on Google Map 📍')}
                  </span>
                </button>

                {showDispatchMapPicker && (
                  <div className="rounded-2xl overflow-hidden border border-[#ECE9E6] h-60 w-full mt-2">
                    <MapAddressPicker
                      initialLat={addrLat}
                      initialLng={addrLng}
                      height="100%"
                      onLocationSelect={({ lat, lng, addressData }) => {
                        setAddrLat(lat);
                        setAddrLng(lng);
                        if (addressData?.governorate) setDispatchCity(addressData.governorate);
                        if (addressData?.street) {
                          setDispatchAddress((prev) =>
                            prev ? `${prev} - ${addressData.street}` : addressData.street
                          );
                        }
                      }}
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#ECE9E6]">
                <button
                  type="button"
                  onClick={() => setShowDispatchModal(false)}
                  className="px-4 py-2 bg-[#FAF8F5] hover:bg-[#ECE9E6] text-[#595F69] text-xs font-bold rounded-xl transition-colors"
                >
                  {t('common.cancel', 'إلغاء')}
                </button>
                <button
                  type="submit"
                  disabled={dispatchSaving}
                  className="px-5 py-2 bg-[#C8102E] hover:bg-[#A50D25] text-white text-xs font-bold rounded-xl shadow-md disabled:opacity-50 transition-all flex items-center gap-2"
                >
                  {dispatchSaving ? (
                    <span>{t('common.loading', 'جاري الحفظ...')}</span>
                  ) : (
                    <span>{t('common.save', 'حفظ الإعدادات')}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
