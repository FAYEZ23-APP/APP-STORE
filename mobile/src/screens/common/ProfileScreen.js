import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Modal,
  Switch,
  Platform,
  I18nManager,
  StatusBar,
  StyleSheet,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useIsFocused } from '@react-navigation/native';
import { AuthContext } from '../../context/AuthContext';
import {
  getMyProfile,
  updateMyProfile,
  changePassword,
  getMySellerProfile,
  updateMySellerProfile,
  getMyAddresses,
  createMyAddress,
  updateMyAddress,
  deleteMyAddress,
  getBuyerDashboard,
  getSellerDashboard,
  exportMyData,
  deleteMyAccount,
  getMyWallet,
} from '../../api/usersApi';
import { getMyProducts } from '../../api/productsApi';
import { getAppConfig } from '../../api/configApi';
import { changeAppLanguage } from '../../locales/i18n';
import { linkGoogle } from '../../api/authApi';
import { useGoogleAuth } from '../../utils/googleAuth';
import { isValidEgyptianPhone } from '../../utils/egyptianPhone';
import { formatCurrency } from '../../utils/currency';
import { openWhatsApp } from '../../utils/whatsapp';
import { colors } from '../../theme/colors';
import { shadows } from '../../theme/shadows';
import AnimatedPressable from '../../components/common/AnimatedPressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { checkBiometricSupport, promptBiometricAuth } from '../../utils/biometrics';
import { isBiometricsEnabled, setBiometricsEnabled, removeRefreshToken } from '../../utils/storage';

import {
  ProfileHeaderCard,
  AccountStatistics,
  OrderTrackingCard,
  AddressBookCard,
  SellerDispatchCard,
  AccountSettingsSection,
  ProfileSectionHeader,
  AccountEmptyState,
} from '../../components/profile';

const cardShadow = shadows.cardElevated;

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString();
  } catch {
    return String(dateStr);
  }
};

export default function ProfileScreen({ navigation }) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { logout, reloadUser, userId } = useContext(AuthContext);
  const scrollViewRef = useRef(null);
  const floatingNavClearance = 64 + Math.max(insets.bottom, Platform.OS === 'android' ? 14 : 10) + 16;

  const [biometricSupport, setBiometricSupport] = useState({ available: false });
  const [biometricsEnabled, setBiometricsEnabledState] = useState(false);
  const isFocused = useIsFocused();
  const isArabicActive = i18n.language?.startsWith('ar');
  const isRTL = isArabicActive;

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Buyer Dashboard Hub State
  const [buyerDashboard, setBuyerDashboard] = useState({
    processingCount: 0,
    inTransitCount: 0,
    readyForPickupCount: 0,
    deliveredCount: 0,
    returnedCount: 0,
    activeShipment: null,
    totalSpent: 0,
    totalOrdersPlaced: 0,
    savedAddressesCount: 0,
    codEligibilityStatus: {
      isCodBlocked: false,
      refusedDeliveriesCount: 0,
      maxRefusalTolerance: 3,
      remainingTolerance: 3,
      statusMessage: isArabicActive ? 'الدفع عند الاستلام متاح' : 'Cash on delivery available',
    },
  });

  // Seller Dashboard State
  const [sellerDashboard, setSellerDashboard] = useState(null);
  const [sellerProductsCount, setSellerProductsCount] = useState(0);

  // Edit Name Modal State
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);

  // Change Password Modal State
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  // Addresses State
  const [addresses, setAddresses] = useState([]);
  const [addressModalVisible, setAddressModalVisible] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [addressForm, setAddressForm] = useState({
    label: '',
    recipientName: '',
    recipientPhone: '',
    governorate: '',
    city: '',
    area: '',
    streetBuilding: '',
    latitude: 0,
    longitude: 0,
    isDefault: false,
  });
  const [savingAddress, setSavingAddress] = useState(false);

  // Seller Profile State (for sellers)
  const [sellerProfile, setSellerProfile] = useState({
    dispatchCity: '',
    dispatchAddress: '',
    contactPhone: '',
  });
  const [sellerOrdersSummary, setSellerOrdersSummary] = useState(null);
  const [isEditingSellerDispatch, setIsEditingSellerDispatch] = useState(false);
  const [showPersonalAddresses, setShowPersonalAddresses] = useState(false);
  const [loadingSellerProfile, setLoadingSellerProfile] = useState(false);
  const [savingSellerProfile, setSavingSellerProfile] = useState(false);

  // Help Center FAQ Modal State
  const [helpModalVisible, setHelpModalVisible] = useState(false);

  // PDPL 151/2020 State
  const [exportingData, setExportingData] = useState(false);
  const [deleteAccountModalVisible, setDeleteAccountModalVisible] = useState(false);
  const [deletePasswordInput, setDeletePasswordInput] = useState('');
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [deleteAuthMethod, setDeleteAuthMethod] = useState('password'); // 'password' | 'google'
  const [deleteGoogleTokenInput, setDeleteGoogleTokenInput] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Buyer Wallet (Store Credit) State
  const [walletData, setWalletData] = useState({ balance: 0, transactions: [] });
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletEnabled, setWalletEnabled] = useState(false);

  // Google Account Linking Flow
  const [linkGoogleLoading, setLinkGoogleLoading] = useState(false);
  const { signIn: startGoogleLink, isLoading: googleLinking } = useGoogleAuth({
    onIdToken: async (idToken) => {
      setLinkGoogleLoading(true);
      try {
        await linkGoogle(idToken);
        Alert.alert(t('common.success'), t('profile.linkGoogleSuccess', 'تم ربط حسابك بـ Google بنجاح.'));
      } catch (err) {
        const msg = err.response?.data?.message || t('profile.linkGoogleError', 'فشل ربط حساب Google');
        Alert.alert(t('common.error'), msg);
      } finally {
        setLinkGoogleLoading(false);
      }
    },
    onError: (err) => Alert.alert(t('common.error'), err),
  });

  const loadSellerProfile = useCallback(async () => {
    try {
      setLoadingSellerProfile(true);
      const res = await getMySellerProfile();
      if (res?.data) {
        setSellerProfile({
          dispatchCity: res.data.dispatchCity || '',
          dispatchAddress: res.data.dispatchAddress || '',
          contactPhone: res.data.contactPhone || '',
        });
      }
    } catch (err) {
      console.error('Failed to load seller profile', err);
    } finally {
      setLoadingSellerProfile(false);
    }
  }, []);

  const loadData = useCallback(async (isPull = false) => {
    if (!userId) {
      setLoading(false);
      setRefreshing(false);
      setProfile(null);
      return;
    }
    try {
      if (isPull) setRefreshing(true);
      else setLoading(true);

      const [profileRes, addressesRes] = await Promise.allSettled([
        getMyProfile(),
        getMyAddresses(),
      ]);

      if (profileRes.status === 'fulfilled' && profileRes.value?.data) {
        const u = profileRes.value.data;
        setProfile(u);
        setNameInput(u.name || '');

        if (u.role === 'Seller') {
          loadSellerProfile();
          // Load seller dashboard & product count & orders
          try {
            const [sellerDashRes, productsRes, configRes, ordersRes] = await Promise.allSettled([
              getSellerDashboard(),
              getMyProducts(),
              getAppConfig(),
              client.get('/orders/seller'),
            ]);
            if (sellerDashRes.status === 'fulfilled' && sellerDashRes.value?.data) {
              setSellerDashboard(sellerDashRes.value.data);
            }
            if (productsRes.status === 'fulfilled' && Array.isArray(productsRes.value?.data)) {
              setSellerProductsCount(productsRes.value.data.length);
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
            if (configRes.status === 'fulfilled') {
              if (configRes.value?.data?.googleEnabled) setGoogleEnabled(true);
              if (configRes.value?.data?.walletEnabled || configRes.value?.data?.vendorPayoutsEnabled) {
                setWalletEnabled(true);
              }
            }
          } catch (e) {
            console.error('Failed to load seller dashboard details', e);
          }
        } else if (u.role !== 'Admin') {
          // Fetch Buyer Dashboard & Config/Wallet
          try {
            const [bDashRes, configRes] = await Promise.allSettled([
              getBuyerDashboard(),
              getAppConfig(),
            ]);
            if (bDashRes.status === 'fulfilled' && bDashRes.value?.data) {
              setBuyerDashboard(bDashRes.value.data);
            }
            if (configRes.status === 'fulfilled') {
              if (configRes.value?.data?.googleEnabled) setGoogleEnabled(true);
              if (configRes.value?.data?.walletEnabled) {
                setWalletEnabled(true);
                try {
                  const walletRes = await getMyWallet();
                  if (walletRes?.data) {
                    setWalletData(walletRes.data);
                  }
                } catch (we) {
                  console.warn('Failed to load wallet data', we);
                }
              }
            }
          } catch (e) {
            console.error('Failed to load buyer dashboard/wallet', e);
          }
        }
      }

      if (addressesRes.status === 'fulfilled' && Array.isArray(addressesRes.value?.data)) {
        setAddresses(addressesRes.value.data);
      }
    } catch (err) {
      console.error('Failed to load profile data', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadSellerProfile, userId]);

  useEffect(() => {
    if (isFocused) {
      Promise.resolve().then(() => {
        loadData();
      });
    }
  }, [isFocused, loadData]);

  useEffect(() => {
    let isMounted = true;
    const loadBiometrics = async () => {
      const support = await checkBiometricSupport();
      if (isMounted) {
        setBiometricSupport(support);
      }
      if (userId && isMounted) {
        const enabled = await isBiometricsEnabled(userId);
        if (isMounted) {
          setBiometricsEnabledState(enabled);
        }
      }
    };
    loadBiometrics();
    return () => {
      isMounted = false;
    };
  }, [userId, isFocused]);

  const handleToggleBiometrics = async (value) => {
    if (!userId) return;

    if (value) {
      const promptRes = await promptBiometricAuth({
        promptMessage: t('biometrics.authenticateToEnable', 'تأكيد البصمة لتفعيل الميزة'),
        fallbackLabel: t('biometrics.usePasscode', 'استخدم رمز الهاتف'),
      });

      if (promptRes.success) {
        await setBiometricsEnabled(userId, true);
        setBiometricsEnabledState(true);
        Alert.alert(t('common.success', 'تم بنجاح'), t('biometrics.enabledSuccess', 'تم تفعيل الدخول بالبصمة بنجاح'));
      } else {
        setBiometricsEnabledState(false);
      }
    } else {
      await setBiometricsEnabled(userId, false);
      setBiometricsEnabledState(false);
      Alert.alert(t('common.success', 'تم بنجاح'), t('biometrics.disabledSuccess', 'تم إيقاف الدخول بالبصمة'));
    }
  };

  const handleSaveName = async () => {
    const trimmed = nameInput.trim();
    if (trimmed.length < 2 || trimmed.length > 100) {
      Alert.alert(
        t('common.error'),
        isRTL ? 'الاسم يجب أن يكون بين حرفين و 100 حرف' : 'Name must be between 2 and 100 characters'
      );
      return;
    }

    try {
      setSavingName(true);
      const res = await updateMyProfile({ name: trimmed });
      if (res?.data) {
        setProfile(res.data);
        setNameInput(res.data.name);
        setIsEditingName(false);
        if (reloadUser) await reloadUser();
        Alert.alert(t('common.save'), isRTL ? 'تم تحديث الاسم بنجاح' : 'Name updated successfully');
      }
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || t('common.error');
      Alert.alert(t('common.error'), msg);
    } finally {
      setSavingName(false);
    }
  };

  const handleSavePassword = async () => {
    if (!currentPassword) {
      Alert.alert(t('common.error'), t('common.fillAllFields'));
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert(
        t('common.error'),
        isRTL ? 'كلمة المرور يجب ألا تقل عن 6 أحرف' : 'Password must be at least 6 characters'
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert(t('common.error'), isRTL ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match');
      return;
    }

    try {
      setSavingPassword(true);
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setIsChangingPassword(false);
      if (userId) {
        await removeRefreshToken(userId);
      }
      Alert.alert(t('common.success', 'تم بنجاح'), t('profile.passwordChanged', 'تم تغيير كلمة المرور بنجاح'), [
        { text: t('common.ok', 'حسناً'), onPress: () => logout() },
      ]);
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || t('common.error');
      Alert.alert(t('common.error'), msg);
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSaveSellerProfile = async () => {
    if (!sellerProfile.dispatchCity?.trim()) {
      Alert.alert(
        t('common.error'),
        isRTL ? 'يرجى تحديد محافظة أو مدينة الشحن للتاجر' : 'Please select dispatch city for seller'
      );
      return;
    }

    try {
      setSavingSellerProfile(true);
      await updateMySellerProfile({
        dispatchCity: sellerProfile.dispatchCity.trim(),
        dispatchAddress: sellerProfile.dispatchAddress?.trim() || null,
        contactPhone: sellerProfile.contactPhone?.trim() || null,
      });
      Alert.alert(t('common.save'), t('profile.sellerProfileSaved', 'تم حفظ بيانات شحن التاجر بنجاح'));
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || t('common.error');
      Alert.alert(t('common.error'), msg);
    } finally {
      setSavingSellerProfile(false);
    }
  };

  const openAddressModal = (address = null) => {
    if (address) {
      setEditingAddressId(address.id);
      setAddressForm({
        label: address.label || '',
        recipientName: address.recipientName || '',
        recipientPhone: address.recipientPhone || '',
        governorate: address.governorate || '',
        city: address.city || '',
        area: address.area || '',
        streetBuilding: address.streetBuilding || '',
        latitude: address.latitude || 0,
        longitude: address.longitude || 0,
        isDefault: Boolean(address.isDefault),
      });
    } else {
      setEditingAddressId(null);
      setAddressForm({
        label: '',
        recipientName: profile?.name || '',
        recipientPhone: '',
        governorate: '',
        city: '',
        area: '',
        streetBuilding: '',
        latitude: 0,
        longitude: 0,
        isDefault: addresses.length === 0,
      });
    }
    setAddressModalVisible(true);
  };

  const handleSaveAddress = async () => {
    if (
      !addressForm.recipientName.trim() ||
      !addressForm.recipientPhone.trim() ||
      !addressForm.governorate.trim() ||
      !addressForm.city.trim() ||
      !addressForm.area.trim() ||
      !addressForm.streetBuilding.trim()
    ) {
      Alert.alert(t('common.error'), t('common.fillAllFields'));
      return;
    }

    if (!isValidEgyptianPhone(addressForm.recipientPhone)) {
      Alert.alert(t('common.error'), t('common.invalidPhone'));
      return;
    }

    try {
      setSavingAddress(true);
      const payload = {
        label: addressForm.label.trim() || null,
        recipientName: addressForm.recipientName.trim(),
        recipientPhone: addressForm.recipientPhone.trim(),
        governorate: addressForm.governorate.trim(),
        city: addressForm.city.trim(),
        area: addressForm.area.trim(),
        streetBuilding: addressForm.streetBuilding.trim(),
        latitude: addressForm.latitude || 0,
        longitude: addressForm.longitude || 0,
        isDefault: addressForm.isDefault,
      };

      if (editingAddressId) {
        await updateMyAddress(editingAddressId, payload);
      } else {
        await createMyAddress(payload);
      }

      setAddressModalVisible(false);
      const refreshed = await getMyAddresses();
      if (Array.isArray(refreshed?.data)) setAddresses(refreshed.data);
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || t('common.error');
      Alert.alert(t('common.error'), msg);
    } finally {
      setSavingAddress(false);
    }
  };

  const handleDeleteAddress = (id) => {
    Alert.alert(t('common.delete'), t('profile.deleteAddressConfirm', 'هل تريد بالتأكيد حذف هذا العنوان؟'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMyAddress(id);
            const refreshed = await getMyAddresses();
            if (Array.isArray(refreshed?.data)) setAddresses(refreshed.data);
          } catch (err) {
            Alert.alert(t('common.error'), err?.message || t('common.error'));
          }
        },
      },
    ]);
  };

  const handleSetDefaultAddress = async (address) => {
    try {
      await updateMyAddress(address.id, { ...address, isDefault: true });
      const refreshed = await getMyAddresses();
      if (Array.isArray(refreshed?.data)) setAddresses(refreshed.data);
    } catch (err) {
      Alert.alert(t('common.error'), err?.message || t('common.error'));
    }
  };

  const handleOpenMapPicker = () => {
    try {
      navigation?.navigate('LocationPicker', {
        onConfirmLocation: (loc) => {
          if (loc?.latitude && loc?.longitude) {
            setAddressForm((p) => ({
              ...p,
              latitude: loc.latitude,
              longitude: loc.longitude,
              governorate: loc.governorate || p.governorate,
              city: loc.city || p.city,
              area: loc.area || p.area,
              streetBuilding: loc.streetBuilding || p.streetBuilding,
            }));
          }
        },
      });
    } catch (e) {
      console.warn('Map picker launch fallback', e);
    }
  };

  const handleOpenSellerMapPicker = () => {
    try {
      navigation?.navigate('LocationPicker', {
        onConfirmLocation: (loc) => {
          if (loc?.city || loc?.governorate) {
            setSellerProfile((p) => ({
              ...p,
              dispatchCity: loc.city || loc.governorate || p.dispatchCity,
              dispatchAddress: loc.address ? `${p.dispatchAddress ? p.dispatchAddress + ' - ' : ''}${loc.address}` : p.dispatchAddress,
            }));
          }
        },
      });
    } catch (e) {
      console.warn('Seller map picker launch fallback', e);
    }
  };

  const handleLanguageChange = async (lang) => {
    if (i18n.language === lang) return;
    await changeAppLanguage(lang);
  };

  const handleExportData = async () => {
    try {
      setExportingData(true);
      const res = await exportMyData();
      if (res?.data) {
        Alert.alert(
          isRTL ? 'تصدير البيانات الشخصية (PDPL 151/2020)' : 'Personal Data Export (PDPL 151/2020)',
          isRTL
            ? `تم تجهيز وتصدير بياناتك بنجاح:\n• الحساب: ${res.data.name} (${res.data.email})\n• العناوين المسجلة: ${res.data.addresses?.length || 0}\n• الطلبات والشحنات: ${res.data.orders?.length || 0}\n• سجل الموافقات القانونية: ${res.data.consents?.length || 0}`
            : `Your data has been successfully prepared and exported:\n• Account: ${res.data.name} (${res.data.email})\n• Saved Addresses: ${res.data.addresses?.length || 0}\n• Orders & Shipments: ${res.data.orders?.length || 0}\n• Legal Consents: ${res.data.consents?.length || 0}`,
          [{ text: isRTL ? 'حسناً' : 'OK' }]
        );
      }
    } catch (err) {
      Alert.alert(t('common.error'), isRTL ? 'تعذر تصدير البيانات الشخصية' : 'Failed to export personal data');
    } finally {
      setExportingData(false);
    }
  };

  const handleDeleteAccountConfirm = async () => {
    if (deleteAuthMethod === 'password') {
      if (!deletePasswordInput) {
        Alert.alert(
          t('common.error'),
          isRTL ? 'يرجى إدخال كلمة المرور لتأكيد حذف الحساب' : 'Please enter your password to confirm account deletion'
        );
        return;
      }
    } else {
      if (!deleteGoogleTokenInput.trim()) {
        Alert.alert(
          t('common.error'),
          isRTL ? 'يرجى إدخال رمز Google ID Token لتأكيد حذف الحساب' : 'Please enter your Google ID token to confirm account deletion'
        );
        return;
      }
    }

    try {
      setDeletingAccount(true);
      if (deleteAuthMethod === 'password') {
        await deleteMyAccount(deletePasswordInput);
      } else {
        await deleteMyAccount(null, deleteGoogleTokenInput.trim());
      }
      if (userId) {
        await removeRefreshToken(userId);
      }
      setDeleteAccountModalVisible(false);
      Alert.alert(
        isRTL ? 'تم حذف الحساب' : 'Account Deleted',
        isRTL
          ? 'تم محو بياناتك الشخصية بنجاح وفقاً للقانون 151 لسنة 2020.'
          : 'Your personal data has been erased in accordance with Law 151/2020.',
        [{ text: isRTL ? 'حسناً' : 'OK', onPress: () => logout() }]
      );
    } catch (err) {
      const msg =
        err?.response?.data?.error || err?.message || (isRTL ? 'تعذر حذف الحساب' : 'Failed to delete account');
      Alert.alert(isRTL ? 'خطأ في الحذف' : 'Deletion Error', msg);
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(t('profile.logout', 'تسجيل الخروج'), t('profile.logoutConfirm', 'هل أنت متأكد من رغبتك في تسجيل الخروج؟'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('auth.logout'), style: 'destructive', onPress: () => logout() },
    ]);
  };

  const handleSupportWhatsApp = async () => {
    const defaultSupportPhone = '01000000000';
    const message = isRTL
      ? `مرحباً، أود الاستفسار بخصوص حسابي في سوق مصر (${profile?.email || ''})`
      : `Hello, I have an inquiry regarding my Egypt Shop account (${profile?.email || ''})`;
    const opened = await openWhatsApp(defaultSupportPhone, message);
    if (!opened) {
      Alert.alert(
        t('profile.customerSupport', 'خدمة العملاء (واتساب)'),
        isRTL
          ? 'تواصل معنا مباشرة عبر البريد support@marketplace.com أو عبر واتساب: 01000000000'
          : 'Contact us directly at support@marketplace.com or on WhatsApp: +201000000000'
      );
    }
  };

  // Guest State Render
  if (!userId) {
    return (
      <View style={[styles.root, { backgroundColor: colors.screenBg }]}>
        <StatusBar barStyle="light-content" backgroundColor="#1F2329" />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1 }}
        >
          <AccountEmptyState
            navigation={navigation}
            onLanguageChange={handleLanguageChange}
            isArabicActive={isArabicActive}
          />
        </ScrollView>
      </View>
    );
  }

  // Initial Loading State
  if (loading && !profile) {
    return (
      <View style={[styles.centerLoading, { backgroundColor: colors.screenBg }]}>
        <StatusBar barStyle="dark-content" />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const role = profile?.role || 'Buyer';
  const isSeller = role === 'Seller';

  return (
    <View style={[styles.root, { backgroundColor: colors.screenBg }]}>
      <StatusBar barStyle="light-content" backgroundColor="#1F2329" />

      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: floatingNavClearance }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadData(true)}
            colors={[colors.primary]}
          />
        }
      >
        {/* ─── 1. Profile Header Identity Card ─── */}
        <ProfileHeaderCard
          profile={profile}
          sellerDashboard={sellerDashboard}
          navigation={navigation}
          onEditProfile={() => setIsEditingName(true)}
          onOpenSettings={() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }}
        />

        {/* ─── 2. Account Statistics Cards ─── */}
        <AccountStatistics
          role={role}
          buyerDashboard={buyerDashboard}
          sellerDashboard={sellerDashboard}
          sellerProductsCount={sellerProductsCount}
          addressesCount={addresses.length}
          loading={loading}
          navigation={navigation}
          onAddressPress={() => openAddressModal()}
        />

        {/* ─── 3. Order Tracking Hub (Buyers & Sellers) ─── */}
        <ProfileSectionHeader
          title={
            isSeller
              ? t('profile.sellerOrdersHubTitle', 'متابعة طلبات وشحنات المتجر')
              : t('profile.buyerHubTitle', 'متابعة طلباتي وشحناتي')
          }
          actionLabel={t('profile.viewAllOrders', 'عرض كل الطلبات')}
          onActionPress={() => {
            if (isSeller) {
              navigation?.navigate('SellerOrders');
            } else {
              navigation?.navigate('MyOrders', { filterStatus: 'All' });
            }
          }}
          icon="clipboard-pulse-outline"
        />
        <OrderTrackingCard
          role={role}
          buyerDashboard={buyerDashboard}
          sellerDashboard={sellerDashboard}
          sellerOrdersSummary={sellerOrdersSummary}
          navigation={navigation}
        />

        {/* ─── 4. Logistics & Address Hub ─── */}
        {isSeller ? (
          <>
            <ProfileSectionHeader
              title={t('profile.sellerWarehouseHub', 'مركز شحن ومخزن التاجر (بوسطة)')}
              actionLabel={t('profile.editDispatchSettings', 'تعديل')}
              onActionPress={() => setIsEditingSellerDispatch(true)}
              icon="storefront-outline"
            />
            <SellerDispatchCard
              sellerProfile={sellerProfile}
              onEditDispatch={() => setIsEditingSellerDispatch(true)}
              onLocateOnMap={handleOpenSellerMapPicker}
            />

            {/* Collapsible Personal Addresses for Shopping */}
            <ProfileSectionHeader
              title={`${t('profile.sellerPersonalAddresses', 'العناوين الشخصية')} (${addresses.length})`}
              actionLabel={showPersonalAddresses ? (isRTL ? 'إخفاء' : 'Hide') : (isRTL ? 'عرض' : 'Show')}
              onActionPress={() => setShowPersonalAddresses((p) => !p)}
              icon="map-marker-radius-outline"
            />
            {showPersonalAddresses && (
              <AddressBookCard
                addresses={addresses}
                onAddNewAddress={() => openAddressModal()}
                onEditAddress={(addr) => openAddressModal(addr)}
                onDeleteAddress={(id) => handleDeleteAddress(id)}
                onSetDefault={(addr) => handleSetDefaultAddress(addr)}
                onLocateOnMap={handleOpenMapPicker}
              />
            )}
          </>
        ) : (
          <>
            <ProfileSectionHeader
              title={t('profile.addressesSection', 'دفتر العناوين المحفوظة')}
              actionLabel={t('profile.addAddress', 'إضافة عنوان')}
              onActionPress={() => openAddressModal()}
              icon="map-marker-radius-outline"
            />
            <AddressBookCard
              addresses={addresses}
              onAddNewAddress={() => openAddressModal()}
              onEditAddress={(addr) => openAddressModal(addr)}
              onDeleteAddress={(id) => handleDeleteAddress(id)}
              onSetDefault={(addr) => handleSetDefaultAddress(addr)}
              onLocateOnMap={handleOpenMapPicker}
            />
          </>
        )}

        {/* ─── 6. Account Services & Settings Groups ─── */}
        <AccountSettingsSection
          role={role}
          navigation={navigation}
          walletEnabled={walletEnabled}
          walletBalance={walletData?.balance || 0}
          onOpenWalletModal={() => setShowWalletModal(true)}
          isChangingPassword={isChangingPassword}
          onToggleChangePassword={() => setIsChangingPassword(true)}
          biometricSupport={biometricSupport}
          biometricsEnabled={biometricsEnabled}
          onToggleBiometrics={handleToggleBiometrics}
          onEditName={() => setIsEditingName(true)}
          googleEnabled={googleEnabled}
          onLinkGoogle={startGoogleLink}
          linkGoogleLoading={linkGoogleLoading || googleLinking}
          isArabicActive={isArabicActive}
          onLanguageChange={handleLanguageChange}
          onOpenSupportWhatsApp={handleSupportWhatsApp}
          onOpenHelpCenter={() => setHelpModalVisible(true)}
          onExportData={handleExportData}
          exportingData={exportingData}
          onDeleteAccount={() => setDeleteAccountModalVisible(true)}
          onLogout={handleLogout}
        />
      </ScrollView>

      {/* ─── MODAL 1: Edit Name ─── */}
      <Modal
        visible={isEditingName}
        transparent
        animationType="fade"
        onRequestClose={() => setIsEditingName(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.dialogBox, cardShadow]}>
            <View style={[styles.modalHeaderRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <Text style={styles.dialogTitle}>{t('profile.editName', 'تعديل الاسم')}</Text>
              <TouchableOpacity accessible={true} accessibilityRole="button" onPress={() => setIsEditingName(false)}>
                <MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.fieldLabel, { textAlign: isRTL ? 'right' : 'left' }]}>
              {t('profile.namePlaceholder', 'أدخل اسمك بالكامل')}
            </Text>
            <TextInput
              accessible={true}
              accessibilityLabel={t('profile.namePlaceholder', 'أدخل اسمك بالكامل')}
              style={[styles.fieldInput, { textAlign: isRTL ? 'right' : 'left' }]}
              value={nameInput}
              onChangeText={setNameInput}
              placeholder={t('profile.namePlaceholder', 'أدخل اسمك بالكامل')}
              placeholderTextColor="#94A3B8"
              autoFocus
            />

            <View style={[styles.dialogBtnRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <TouchableOpacity
                accessible={true}
                accessibilityRole="button"
                onPress={() => setIsEditingName(false)}
                style={styles.cancelBtn}
              >
                <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                accessible={true}
                accessibilityRole="button"
                onPress={handleSaveName}
                disabled={savingName}
                style={[styles.saveActionBtn, { backgroundColor: colors.primary }]}
              >
                {savingName ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.saveActionBtnText}>{t('common.save')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL 2: Change Password ─── */}
      <Modal
        visible={isChangingPassword}
        transparent
        animationType="slide"
        onRequestClose={() => setIsChangingPassword(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.sheetBox, cardShadow]}>
            <View style={[styles.modalHeaderRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <View style={[styles.modalTitleGroup, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <MaterialCommunityIcons name="lock-reset" size={22} color={colors.primary} />
                <Text style={[styles.sheetTitle, isRTL ? { marginRight: 8 } : { marginLeft: 8 }]}>
                  {t('profile.changePassword', 'تغيير كلمة المرور')}
                </Text>
              </View>
              <TouchableOpacity accessible={true} accessibilityRole="button" onPress={() => setIsChangingPassword(false)}>
                <MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 8 }}>
              <Text style={[styles.fieldLabel, { textAlign: isRTL ? 'right' : 'left' }]}>
                {t('profile.currentPassword', 'كلمة المرور الحالية')} *
              </Text>
              <TextInput
                secureTextEntry
                accessible={true}
                accessibilityLabel={t('profile.currentPassword', 'كلمة المرور الحالية')}
                style={[styles.fieldInput, { textAlign: isRTL ? 'right' : 'left' }]}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="••••••••"
                placeholderTextColor="#94A3B8"
              />

              <Text style={[styles.fieldLabel, { textAlign: isRTL ? 'right' : 'left' }]}>
                {t('profile.newPassword', 'كلمة المرور الجديدة')} *
              </Text>
              <TextInput
                secureTextEntry
                accessible={true}
                accessibilityLabel={t('profile.newPassword', 'كلمة المرور الجديدة')}
                style={[styles.fieldInput, { textAlign: isRTL ? 'right' : 'left' }]}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="••••••••"
                placeholderTextColor="#94A3B8"
              />

              <Text style={[styles.fieldLabel, { textAlign: isRTL ? 'right' : 'left' }]}>
                {t('profile.confirmNewPassword', 'تأكيد كلمة المرور الجديدة')} *
              </Text>
              <TextInput
                secureTextEntry
                accessible={true}
                accessibilityLabel={t('profile.confirmNewPassword', 'تأكيد كلمة المرور الجديدة')}
                style={[styles.fieldInput, { textAlign: isRTL ? 'right' : 'left' }]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="••••••••"
                placeholderTextColor="#94A3B8"
              />

              <TouchableOpacity
                accessible={true}
                accessibilityRole="button"
                onPress={handleSavePassword}
                disabled={savingPassword}
                style={[styles.fullWidthSaveBtn, { backgroundColor: colors.primary, marginTop: 16 }]}
                activeOpacity={0.85}
              >
                {savingPassword ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.fullWidthSaveText}>{t('profile.updatePassword', 'تحديث كلمة المرور')}</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL 3: Egyptian Address Book Create / Edit ─── */}
      <Modal
        visible={addressModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAddressModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.sheetBox, cardShadow]}>
            <View style={[styles.modalHeaderRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <Text style={styles.sheetTitle}>
                {editingAddressId ? t('profile.addressModal.titleEdit', 'تعديل العنوان') : t('profile.addressModal.titleNew', 'إضافة عنوان مصري جديد')}
              </Text>
              <TouchableOpacity accessible={true} accessibilityRole="button" onPress={() => setAddressModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 6 }}>
              {/* Optional Locate on Map Nudge */}
              <TouchableOpacity
                accessible={true}
                accessibilityRole="button"
                onPress={() => {
                  setAddressModalVisible(false);
                  setTimeout(() => {
                    handleOpenMapPicker();
                  }, 300);
                }}
                style={[styles.mapPickerNudge, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="crosshairs-gps" size={18} color={colors.primary} />
                <Text style={styles.mapPickerNudgeText}>{t('profile.locateOnMap', 'تحديد على الخريطة')}</Text>
              </TouchableOpacity>

              <Text style={[styles.fieldLabel, { textAlign: isRTL ? 'right' : 'left' }]}>
                {t('profile.addressModal.label', 'اسم العنوان (مثال: المنزل، العمل)')}
              </Text>
              <TextInput
                accessible={true}
                accessibilityLabel={t('profile.addressModal.label', 'اسم العنوان (مثال: المنزل، العمل)')}
                style={[styles.fieldInput, { textAlign: isRTL ? 'right' : 'left' }]}
                value={addressForm.label}
                onChangeText={(text) => setAddressForm((p) => ({ ...p, label: text }))}
                placeholder={isRTL ? 'مثال: المنزل، العمل' : 'e.g. Home, Office'}
                placeholderTextColor="#94A3B8"
              />

              <Text style={[styles.fieldLabel, { textAlign: isRTL ? 'right' : 'left' }]}>
                {t('profile.addressModal.recipientName', 'اسم المستلم')} *
              </Text>
              <TextInput
                accessible={true}
                accessibilityLabel={t('profile.addressModal.recipientName', 'اسم المستلم')}
                style={[styles.fieldInput, { textAlign: isRTL ? 'right' : 'left' }]}
                value={addressForm.recipientName}
                onChangeText={(text) => setAddressForm((p) => ({ ...p, recipientName: text }))}
                placeholder={isRTL ? 'الاسم الكامل كما بالبطاقة' : 'Full recipient name'}
                placeholderTextColor="#94A3B8"
              />

              <Text style={[styles.fieldLabel, { textAlign: isRTL ? 'right' : 'left' }]}>
                {t('profile.addressModal.recipientPhone', 'رقم الموبايل المصري (010, 011, 012, 015)')} *
              </Text>
              <TextInput
                accessible={true}
                accessibilityLabel={t('profile.addressModal.recipientPhone', 'رقم الموبايل المصري (010, 011, 012, 015)')}
                style={[styles.fieldInput, { textAlign: isRTL ? 'right' : 'left' }]}
                keyboardType="phone-pad"
                value={addressForm.recipientPhone}
                onChangeText={(text) => setAddressForm((p) => ({ ...p, recipientPhone: text }))}
                placeholder="010xxxxxxxx"
                placeholderTextColor="#94A3B8"
              />

              {/* 1. Governorate */}
              <Text style={[styles.fieldLabel, { textAlign: isRTL ? 'right' : 'left' }]}>
                {t('profile.addressModal.governorate', 'المحافظة (مثال: القاهرة، الجيزة، الإسكندرية)')} *
              </Text>
              <TextInput
                accessible={true}
                accessibilityLabel={t('profile.addressModal.governorate', 'المحافظة (مثال: القاهرة، الجيزة، الإسكندرية)')}
                style={[styles.fieldInput, { textAlign: isRTL ? 'right' : 'left' }]}
                value={addressForm.governorate}
                onChangeText={(text) => setAddressForm((p) => ({ ...p, governorate: text }))}
                placeholder={isRTL ? 'القاهرة، الإسكندرية، الجيزة...' : 'Cairo, Giza, Alexandria...'}
                placeholderTextColor="#94A3B8"
              />

              {/* 2. City / Center */}
              <Text style={[styles.fieldLabel, { textAlign: isRTL ? 'right' : 'left' }]}>
                {t('profile.addressModal.city', 'المدينة أو المركز (مثال: الدقي، مدينة نصر)')} *
              </Text>
              <TextInput
                accessible={true}
                accessibilityLabel={t('profile.addressModal.city', 'المدينة أو المركز (مثال: الدقي، مدينة نصر)')}
                style={[styles.fieldInput, { textAlign: isRTL ? 'right' : 'left' }]}
                value={addressForm.city}
                onChangeText={(text) => setAddressForm((p) => ({ ...p, city: text }))}
                placeholder={isRTL ? 'مدينة نصر، المعادي، الدقي...' : 'Nasr City, Maadi, Dokki...'}
                placeholderTextColor="#94A3B8"
              />

              {/* 3. Area / District */}
              <Text style={[styles.fieldLabel, { textAlign: isRTL ? 'right' : 'left' }]}>
                {t('profile.addressModal.area', 'الحي أو المنطقة')} *
              </Text>
              <TextInput
                accessible={true}
                accessibilityLabel={t('profile.addressModal.area', 'الحي أو المنطقة')}
                style={[styles.fieldInput, { textAlign: isRTL ? 'right' : 'left' }]}
                value={addressForm.area}
                onChangeText={(text) => setAddressForm((p) => ({ ...p, area: text }))}
                placeholder={isRTL ? 'الحي السابع، الزهراء...' : '7th District, Zahraa...'}
                placeholderTextColor="#94A3B8"
              />

              {/* 4. Street & Building */}
              <Text style={[styles.fieldLabel, { textAlign: isRTL ? 'right' : 'left' }]}>
                {t('profile.addressModal.streetBuilding', 'الشارع ورقم العمارة / رقم الشقة')} *
              </Text>
              <TextInput
                accessible={true}
                accessibilityLabel={t('profile.addressModal.streetBuilding', 'الشارع ورقم العمارة / رقم الشقة')}
                style={[styles.fieldInput, { textAlign: isRTL ? 'right' : 'left' }]}
                value={addressForm.streetBuilding}
                onChangeText={(text) => setAddressForm((p) => ({ ...p, streetBuilding: text }))}
                placeholder={isRTL ? 'اسم الشارع، رقم العمارة، الدور، رقم الشقة' : 'Street, building, floor, apartment'}
                placeholderTextColor="#94A3B8"
              />

              {/* Default Address Switch */}
              <View style={[styles.switchRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <Text style={styles.switchLabel}>
                  {t('profile.addressModal.isDefault', 'تعيين كعنوان افتراضي رئيسي')}
                </Text>
                <Switch
                  value={addressForm.isDefault}
                  onValueChange={(val) => setAddressForm((p) => ({ ...p, isDefault: val }))}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.white}
                />
              </View>

              <TouchableOpacity
                accessible={true}
                accessibilityRole="button"
                onPress={handleSaveAddress}
                disabled={savingAddress}
                style={[styles.fullWidthSaveBtn, { backgroundColor: colors.primary, marginBottom: 24 }]}
                activeOpacity={0.85}
              >
                {savingAddress ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.fullWidthSaveText}>{t('common.save')}</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL 4: Help Center & FAQs ─── */}
      <Modal
        visible={helpModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setHelpModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.sheetBox, cardShadow]}>
            <View style={[styles.modalHeaderRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <View style={[styles.modalTitleGroup, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <MaterialCommunityIcons name="frequently-asked-questions" size={24} color={colors.primary} />
                <Text style={[styles.sheetTitle, isRTL ? { marginRight: 8 } : { marginLeft: 8 }]}>
                  {t('profile.helpCenter', 'مركز المساعدة والأسئلة الشائعة')}
                </Text>
              </View>
              <TouchableOpacity accessible={true} accessibilityRole="button" onPress={() => setHelpModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 10 }}>
              {/* FAQ 1 */}
              <View style={styles.faqCard}>
                <View style={[styles.faqHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  <MaterialCommunityIcons name="truck-fast-outline" size={18} color={colors.primary} />
                  <Text style={[styles.faqQuestion, isRTL ? { marginRight: 6 } : { marginLeft: 6 }]}>
                    {t('profile.faqShipping', 'الشحن والتوصيل')}
                  </Text>
                </View>
                <Text style={[styles.faqAnswer, { textAlign: isRTL ? 'right' : 'left' }]}>
                  {t('profile.faqShippingAnswer', 'نوفر شحن سريع لجميع محافظات جمهورية مصر العربية بالتعاون مع بوسطة إكسبريس خلال 2 إلى 5 أيام عمل.')}
                </Text>
              </View>

              {/* FAQ 2 */}
              <View style={styles.faqCard}>
                <View style={[styles.faqHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  <MaterialCommunityIcons name="keyboard-return" size={18} color="#D97706" />
                  <Text style={[styles.faqQuestion, isRTL ? { marginRight: 6 } : { marginLeft: 6 }]}>
                    {t('profile.faqReturns', 'سياسة الاسترجاع 14 يوماً')}
                  </Text>
                </View>
                <Text style={[styles.faqAnswer, { textAlign: isRTL ? 'right' : 'left' }]}>
                  {t('profile.faqReturnsAnswer', 'يحق لك استرجاع المنتجات خلال 14 يوماً من الاستلام وفقاً لقانون حماية المستهلك المصري، ويتم إيداع القيمة في محفظتك.')}
                </Text>
              </View>

              {/* FAQ 3 */}
              <View style={styles.faqCard}>
                <View style={[styles.faqHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  <MaterialCommunityIcons name="cash-multiple" size={18} color="#16A34A" />
                  <Text style={[styles.faqQuestion, isRTL ? { marginRight: 6 } : { marginLeft: 6 }]}>
                    {t('profile.faqCod', 'الدفع عند الاستلام')}
                  </Text>
                </View>
                <Text style={[styles.faqAnswer, { textAlign: isRTL ? 'right' : 'left' }]}>
                  {t('profile.faqCodAnswer', 'يمكنك الدفع كاش عند استلام الشحنة من مندوب التوصيل بعد فحص الطرد ظاهرياً.')}
                </Text>
              </View>

              {/* Direct Support CTA */}
              <TouchableOpacity
                accessible={true}
                accessibilityRole="button"
                onPress={() => {
                  setHelpModalVisible(false);
                  handleSupportWhatsApp();
                }}
                style={[styles.whatsappSupportBtn, { flexDirection: isRTL ? 'row-reverse' : 'row', backgroundColor: colors.primary }]}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="headset" size={20} color={colors.white} />
                <Text style={styles.whatsappSupportBtnText}>{t('profile.contactSupportTeam', 'تواصل مع الدعم الفني')}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL 5: Buyer Wallet Transaction History ─── */}
      <Modal
        visible={showWalletModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowWalletModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.sheetBox, { maxHeight: '80%' }, cardShadow]}>
            <View style={[styles.modalHeaderRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <View style={[styles.modalTitleGroup, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <MaterialCommunityIcons name="wallet" size={24} color={colors.gold} />
                <Text style={[styles.sheetTitle, isRTL ? { marginRight: 8 } : { marginLeft: 8 }]}>
                  {t('profile.walletTxModalTitle', 'محفظة المشتري وسجل المعاملات')}
                </Text>
              </View>
              <TouchableOpacity accessible={true} accessibilityRole="button" onPress={() => setShowWalletModal(false)}>
                <MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Current Balance Banner */}
            <View style={[styles.walletBalanceBanner, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <Text style={styles.walletBalanceLabel}>{t('profile.availableBalanceLabel', 'الرصيد المتاح:')}</Text>
              <Text style={styles.walletBalanceAmount}>
                {formatCurrency(walletData?.balance || 0)}
              </Text>
            </View>

            <Text style={[styles.txListHeader, { textAlign: isRTL ? 'right' : 'left' }]}>
              {t('profile.previousTxLabel', { count: walletData?.transactions?.length || 0 })}
            </Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              {!walletData?.transactions || walletData.transactions.length === 0 ? (
                <View style={styles.noTxContainer}>
                  <MaterialCommunityIcons name="history" size={36} color={colors.textSecondary} />
                  <Text style={styles.noTxText}>{t('profile.noPreviousTx', 'لا توجد معاملات سابقة في محفظتك حتى الآن.')}</Text>
                </View>
              ) : (
                walletData.transactions.map((tx, idx) => {
                  const isCredit = tx.amount > 0;
                  return (
                    <View
                      key={`wallet-tx-${tx.id || idx}`}
                      style={[styles.txItemRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
                    >
                      <View style={[styles.txInfoGroup, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                        <View
                          style={[
                            styles.txIconWrap,
                            { backgroundColor: isCredit ? colors.newBadgeSoft : colors.primarySoft },
                            isRTL ? { marginLeft: 10 } : { marginRight: 10 },
                          ]}
                        >
                          <MaterialCommunityIcons
                            name={isCredit ? 'arrow-down-left' : 'arrow-up-right'}
                            size={18}
                            color={isCredit ? colors.newBadge : colors.primary}
                          />
                        </View>
                        <View style={{ alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
                          <Text style={styles.txTitle}>
                            {tx.type === 'RefundCredit'
                              ? t('profile.refundCredit', 'إيداع استرداد مرتجع')
                              : tx.type === 'OrderRedemption'
                              ? t('profile.orderRedemption', 'خصم مشتريات بالرصيد')
                              : tx.type || t('profile.balanceTx', 'معاملة رصيد')}
                          </Text>
                          <Text style={styles.txDate}>
                            {tx.description || formatDate(tx.createdAt)}
                          </Text>
                        </View>
                      </View>

                      <Text
                        style={[
                          styles.txAmount,
                          { color: isCredit ? colors.newBadge : colors.discount },
                        ]}
                      >
                        {isCredit ? `+${formatCurrency(tx.amount)}` : formatCurrency(tx.amount)}
                      </Text>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL 6: Delete Account Confirmation (PDPL 151/2020) ─── */}
      <Modal
        visible={deleteAccountModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteAccountModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.dialogBox, cardShadow]}>
            <View style={styles.deleteIconBox}>
              <MaterialCommunityIcons name="alert-octagon" size={32} color="#DC2626" />
            </View>

            <Text style={styles.deleteModalTitle}>{t('profile.deleteAccountTitle', 'حذف الحساب نهائياً')}</Text>
            <Text style={styles.deleteModalDesc}>{t('profile.deleteWarning', 'سيتم حذف بياناتك وتشفيرها نهائياً. لا يمكن التراجع عن هذا الإجراء.')}</Text>

            {googleEnabled && (
              <View style={[styles.authSwitchRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <TouchableOpacity
                  accessible={true}
                  accessibilityRole="button"
                  onPress={() => setDeleteAuthMethod('password')}
                  style={[
                    styles.authMethodBtn,
                    deleteAuthMethod === 'password' && styles.authMethodBtnActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.authMethodBtnText,
                      deleteAuthMethod === 'password' && styles.authMethodBtnTextActive,
                    ]}
                  >
                    {isRTL ? 'كلمة المرور' : 'Password'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  accessible={true}
                  accessibilityRole="button"
                  onPress={() => setDeleteAuthMethod('google')}
                  style={[
                    styles.authMethodBtn,
                    deleteAuthMethod === 'google' && styles.authMethodBtnActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.authMethodBtnText,
                      deleteAuthMethod === 'google' && styles.authMethodBtnTextActive,
                    ]}
                  >
                    {isRTL ? 'حساب Google' : 'Google Token'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {deleteAuthMethod === 'password' ? (
              <>
                <Text style={[styles.fieldLabel, { textAlign: isRTL ? 'right' : 'left' }]}>
                  {t('profile.deleteConfirmText', 'أدخل كلمة المرور الحالية لتأكيد حذف حسابك نهائياً:')}
                </Text>
                <TextInput
                  secureTextEntry
                  accessible={true}
                  accessibilityLabel={t('profile.deleteConfirmText', 'أدخل كلمة المرور الحالية لتأكيد حذف حسابك نهائياً:')}
                  style={[styles.fieldInput, { textAlign: isRTL ? 'right' : 'left' }]}
                  value={deletePasswordInput}
                  onChangeText={setDeletePasswordInput}
                  placeholder={isRTL ? 'أدخل كلمة المرور الحالية' : 'Enter current password'}
                  placeholderTextColor="#94A3B8"
                />
              </>
            ) : (
              <>
                <Text style={[styles.fieldLabel, { textAlign: isRTL ? 'right' : 'left' }]}>
                  {isRTL ? 'رمز Google ID Token لتأكيد الهوية' : 'Google ID Token for Verification'}
                </Text>
                <TextInput
                  accessible={true}
                  accessibilityLabel="Google ID Token"
                  style={[styles.fieldInput, { textAlign: isRTL ? 'right' : 'left' }, styles.monoFont]}
                  value={deleteGoogleTokenInput}
                  onChangeText={setDeleteGoogleTokenInput}
                  placeholder={isRTL ? 'ألصق رمز Google ID Token' : 'Paste Google ID Token'}
                  placeholderTextColor="#94A3B8"
                />
              </>
            )}

            <View style={[styles.dialogBtnRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <TouchableOpacity
                accessible={true}
                accessibilityRole="button"
                onPress={() => setDeleteAccountModalVisible(false)}
                style={styles.cancelBtn}
              >
                <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                accessible={true}
                accessibilityRole="button"
                onPress={handleDeleteAccountConfirm}
                disabled={deletingAccount}
                style={[styles.saveActionBtn, { backgroundColor: '#DC2626', minWidth: 100 }]}
              >
                {deletingAccount ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.saveActionBtnText}>{t('common.delete')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL 6: Edit Seller Dispatch Warehouse Settings ─── */}
      <Modal
        visible={isEditingSellerDispatch}
        transparent
        animationType="slide"
        onRequestClose={() => setIsEditingSellerDispatch(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.sheetBox, cardShadow]}>
            <View style={[styles.modalHeaderRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <View style={[styles.modalTitleGroup, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <MaterialCommunityIcons name="store-cog-outline" size={22} color={colors.gold} />
                <Text style={[styles.sheetTitle, isRTL ? { marginRight: 8 } : { marginLeft: 8 }]}>
                  {t('profile.editDispatchSettings', 'تعديل بيانات المخزن والشحن')}
                </Text>
              </View>
              <TouchableOpacity
                accessible={true}
                accessibilityRole="button"
                onPress={() => setIsEditingSellerDispatch(false)}
              >
                <MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 8 }}>
              <Text style={[styles.fieldLabel, { textAlign: isRTL ? 'right' : 'left' }]}>
                {t('profile.mainDispatchCity', 'محافظة الشحن الرئيسية *')}
              </Text>
              <TextInput
                accessible={true}
                accessibilityLabel={t('profile.mainDispatchCity', 'محافظة الشحن الرئيسية *')}
                style={[styles.fieldInput, { textAlign: isRTL ? 'right' : 'left' }]}
                value={sellerProfile.dispatchCity}
                onChangeText={(text) => setSellerProfile((p) => ({ ...p, dispatchCity: text }))}
                placeholder={isRTL ? 'مثال: القاهرة، الجيزة، الإسكندرية' : 'e.g. Cairo, Giza'}
                placeholderTextColor="#94A3B8"
              />

              <Text style={[styles.fieldLabel, { textAlign: isRTL ? 'right' : 'left' }]}>
                {t('profile.detailedDispatchAddress', 'عنوان المخزن أو المعرض بالتفصيل')}
              </Text>
              <TextInput
                accessible={true}
                accessibilityLabel={t('profile.detailedDispatchAddress', 'عنوان المخزن أو المعرض بالتفصيل')}
                style={[styles.fieldInput, { textAlign: isRTL ? 'right' : 'left' }]}
                value={sellerProfile.dispatchAddress}
                onChangeText={(text) => setSellerProfile((p) => ({ ...p, dispatchAddress: text }))}
                placeholder={isRTL ? 'عنوان المخزن أو المتجر بالتفصيل' : 'Detailed warehouse/store address'}
                placeholderTextColor="#94A3B8"
              />

              <Text style={[styles.fieldLabel, { textAlign: isRTL ? 'right' : 'left' }]}>
                {t('profile.contactPhoneRepresentative', 'موبايل مندوب الاستلام')}
              </Text>
              <TextInput
                accessible={true}
                accessibilityLabel={t('profile.contactPhoneRepresentative', 'رقم هاتف التواصل مع المندوب')}
                style={[styles.fieldInput, { textAlign: isRTL ? 'right' : 'left' }]}
                keyboardType="phone-pad"
                value={sellerProfile.contactPhone}
                onChangeText={(text) => setSellerProfile((p) => ({ ...p, contactPhone: text }))}
                placeholder="010xxxxxxxx"
                placeholderTextColor="#94A3B8"
              />

              {/* Map Address Picker Button */}
              <TouchableOpacity
                accessible={true}
                accessibilityRole="button"
                onPress={handleOpenSellerMapPicker}
                style={[styles.mapNudgeBtn, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="crosshairs-gps" size={16} color={colors.primary} />
                <Text style={styles.mapNudgeText}>
                  {t('profile.locateOnMap', 'تحديد موقع المخزن بدقة على الخريطة 📍')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                accessible={true}
                accessibilityRole="button"
                onPress={async () => {
                  await handleSaveSellerProfile();
                  setIsEditingSellerDispatch(false);
                }}
                disabled={savingSellerProfile}
                style={[styles.fullWidthSaveBtn, { backgroundColor: colors.accent, marginTop: 16 }]}
                activeOpacity={0.85}
              >
                {savingSellerProfile ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.fullWidthSaveText}>{t('profile.saveSellerSettings', 'حفظ الإعدادات')}</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 36,
  },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sellerDispatchContainer: {
    marginBottom: 6,
  },
  sellerDispatchCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    marginHorizontal: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
    marginTop: 8,
  },
  fieldInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: colors.textPrimary,
  },
  monoFont: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
  },
  sellerSaveBtn: {
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  sellerSaveBtnText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheetBox: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 18,
    maxHeight: '85%',
  },
  dialogBox: {
    width: '90%',
    backgroundColor: colors.cardBg,
    borderRadius: 20,
    padding: 18,
    alignSelf: 'center',
    marginBottom: 'auto',
    marginTop: 'auto',
  },
  modalHeaderRow: {
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitleGroup: {
    alignItems: 'center',
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  dialogTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  dialogBtnRow: {
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 14,
    gap: 8,
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  saveActionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveActionBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '800',
  },
  fullWidthSaveBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidthSaveText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 14,
  },
  switchRow: {
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    marginVertical: 4,
  },
  switchLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  mapPickerNudge: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    gap: 6,
  },
  mapPickerNudgeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  faqCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  faqHeader: {
    alignItems: 'center',
    marginBottom: 6,
  },
  faqQuestion: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  faqAnswer: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  whatsappSupportBtn: {
    backgroundColor: '#25D366',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 20,
    gap: 8,
  },
  whatsappSupportBtnText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '800',
  },
  walletBalanceBanner: {
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(214, 163, 58, 0.15)',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(214, 163, 58, 0.3)',
    marginVertical: 10,
  },
  walletBalanceLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  walletBalanceAmount: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.goldText,
  },
  txListHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  noTxContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  noTxText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 6,
  },
  txItemRow: {
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 8,
  },
  txInfoGroup: {
    alignItems: 'center',
    flex: 1,
  },
  txIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  txTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  txDate: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
  },
  txAmount: {
    fontSize: 13,
    fontWeight: '800',
  },
  deleteIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 8,
  },
  deleteModalTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#DC2626',
    textAlign: 'center',
  },
  deleteModalDesc: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 4,
    marginBottom: 10,
  },
  authSwitchRow: {
    gap: 8,
    marginBottom: 10,
  },
  authMethodBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  authMethodBtnActive: {
    backgroundColor: '#1F2329',
    borderColor: '#1F2329',
  },
  authMethodBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  authMethodBtnTextActive: {
    color: colors.white,
    fontWeight: '800',
  },
  mapNudgeBtn: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  mapNudgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
});
