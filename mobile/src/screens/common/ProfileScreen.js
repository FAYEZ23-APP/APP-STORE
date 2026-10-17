import tw from 'twrnc';
import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  Switch,
  Platform,
  I18nManager,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
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
} from '../../api/usersApi';
import { changeAppLanguage } from '../../locales/i18n';
import { isValidEgyptianPhone, formatEgyptianPhone } from '../../utils/egyptianPhone';
import { colors } from '../../theme/colors';

const cardShadow = Platform.select({
  ios: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  android: {
    elevation: 1,
  },
  default: {},
});

const getInitials = (name) => {
  if (!name || typeof name !== 'string') return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { logout, reloadUser } = useContext(AuthContext);

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Edit Name State
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);

  // Change Password State
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  // Addresses State
  const [addresses, setAddresses] = useState([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
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
    isDefault: false,
  });
  const [savingAddress, setSavingAddress] = useState(false);

  // Seller Profile State
  const [sellerProfile, setSellerProfile] = useState({
    dispatchCity: '',
    dispatchAddress: '',
    contactPhone: '',
  });
  const [loadingSellerProfile, setLoadingSellerProfile] = useState(false);
  const [savingSellerProfile, setSavingSellerProfile] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getMyProfile();
      if (res?.data) {
        setProfile(res.data);
        setNameInput(res.data.name || '');

        // If seller, load seller profile
        if (res.data.role === 'Seller') {
          loadSellerProfile();
        }
      }
      loadAddresses();
    } catch (err) {
      console.error('Failed to load profile', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAddresses = async () => {
    try {
      setLoadingAddresses(true);
      const res = await getMyAddresses();
      if (Array.isArray(res?.data)) {
        setAddresses(res.data);
      }
    } catch (err) {
      console.error('Failed to load addresses', err);
    } finally {
      setLoadingAddresses(false);
    }
  };

  const loadSellerProfile = async () => {
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
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveName = async () => {
    const trimmed = nameInput.trim();
    if (trimmed.length < 2 || trimmed.length > 100) {
      Alert.alert(t('common.error'), t('profile.nameMinLength', 'الاسم يجب أن يكون بين حرفين و 100 حرف'));
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
        Alert.alert(t('common.save'), t('profile.nameUpdated', 'تم تحديث الاسم بنجاح'));
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
      Alert.alert(t('common.error'), t('profile.passwordMinLength', 'كلمة المرور يجب ألا تقل عن 6 أحرف'));
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert(t('common.error'), t('profile.passwordMismatch', 'كلمتا المرور غير متطابقتين'));
      return;
    }

    try {
      setSavingPassword(true);
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setIsChangingPassword(false);
      Alert.alert(t('common.save'), t('profile.passwordChanged'));
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || t('common.error');
      Alert.alert(t('common.error'), msg);
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSaveSellerProfile = async () => {
    if (!sellerProfile.dispatchCity?.trim()) {
      Alert.alert(t('common.error'), 'يرجى تحديد محافظة أو مدينة الشحن للتاجر');
      return;
    }

    try {
      setSavingSellerProfile(true);
      await updateMySellerProfile({
        dispatchCity: sellerProfile.dispatchCity.trim(),
        dispatchAddress: sellerProfile.dispatchAddress?.trim() || null,
        contactPhone: sellerProfile.contactPhone?.trim() || null,
      });
      Alert.alert(t('common.save'), t('profile.sellerProfileSaved'));
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
        isDefault: addressForm.isDefault,
      };

      if (editingAddressId) {
        await updateMyAddress(editingAddressId, payload);
      } else {
        await createMyAddress(payload);
      }

      setAddressModalVisible(false);
      await loadAddresses();
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || t('common.error');
      Alert.alert(t('common.error'), msg);
    } finally {
      setSavingAddress(false);
    }
  };

  const handleDeleteAddress = (id) => {
    Alert.alert(
      t('common.delete'),
      t('profile.deleteAddressConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMyAddress(id);
              await loadAddresses();
            } catch (err) {
              Alert.alert(t('common.error'), err?.message || t('common.error'));
            }
          },
        },
      ]
    );
  };

  const handleSetDefaultAddress = async (address) => {
    try {
      await updateMyAddress(address.id, {
        ...address,
        isDefault: true,
      });
      await loadAddresses();
    } catch (err) {
      Alert.alert(t('common.error'), err?.message || t('common.error'));
    }
  };

  const handleLanguageChange = async (lang) => {
    if (i18n.language === lang) return;
    await changeAppLanguage(lang);
  };

  const handleLogout = () => {
    Alert.alert(
      t('profile.logout'),
      t('profile.logoutConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('auth.logout'),
          style: 'destructive',
          onPress: () => logout(),
        },
      ]
    );
  };

  if (loading && !profile) {
    return (
      <View
        style={[
          tw`flex-1 justify-center items-center`,
          { backgroundColor: colors.screenBg },
        ]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const isRTL = I18nManager.isRTL;
  const isArabicActive = i18n.language?.startsWith('ar');

  return (
    <ScrollView
      style={[tw`flex-1`, { backgroundColor: colors.screenBg }]}
      contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      {/* 1. Header Card: Avatar, Name, Email & Role */}
      <View
        style={[
          cardShadow,
          tw`rounded-2xl p-5 mb-3 items-center border`,
          { backgroundColor: colors.cardBg, borderColor: colors.border },
        ]}
      >
        <View
          style={[
            tw`w-20 h-20 rounded-full items-center justify-center mb-3`,
            { backgroundColor: colors.primarySoft },
          ]}
        >
          <Text style={[tw`font-bold text-2xl`, { color: colors.primary }]}>
            {getInitials(profile?.name)}
          </Text>
        </View>

        <Text style={[tw`text-xl font-bold text-center`, { color: colors.textPrimary }]}>
          {profile?.name || 'User'}
        </Text>

        <Text style={[tw`text-sm text-center mt-0.5`, { color: colors.textSecondary }]}>
          {profile?.email || ''}
        </Text>

        <View
          style={[
            tw`mt-3 px-3.5 py-1 rounded-full`,
            { backgroundColor: colors.primarySoft },
          ]}
        >
          <Text style={[tw`text-xs font-bold`, { color: colors.primary }]}>
            {profile?.role === 'Seller' ? t('profile.sellerBadge') : t('profile.buyerBadge')}
          </Text>
        </View>
      </View>

      {/* 2. Edit Name Card */}
      <View
        style={[
          cardShadow,
          tw`rounded-2xl p-4 mb-3 border`,
          { backgroundColor: colors.cardBg, borderColor: colors.border },
        ]}
      >
        <View style={tw`flex-row items-center justify-between mb-2`}>
          <View style={tw`flex-row items-center`}>
            <MaterialCommunityIcons
              name="account-edit-outline"
              size={20}
              color={colors.primary}
            />
            <Text
              style={[
                tw`font-bold text-base ${isRTL ? 'mr-2' : 'ml-2'}`,
                { color: colors.textPrimary },
              ]}
            >
              {t('profile.editName')}
            </Text>
          </View>

          {!isEditingName && (
            <TouchableOpacity
              onPress={() => {
                setNameInput(profile?.name || '');
                setIsEditingName(true);
              }}
              style={[
                tw`px-3 py-1 rounded-lg`,
                { backgroundColor: colors.primarySoft },
              ]}
            >
              <Text style={[tw`text-xs font-semibold`, { color: colors.primary }]}>
                {t('common.edit')}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {isEditingName ? (
          <View style={tw`mt-2`}>
            <TextInput
              style={[
                tw`border rounded-xl px-3.5 py-2.5 text-base mb-3`,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.screenBg,
                  color: colors.textPrimary,
                  textAlign: isRTL ? 'right' : 'left',
                },
              ]}
              value={nameInput}
              onChangeText={setNameInput}
              placeholder={t('auth.name')}
              placeholderTextColor={colors.textSecondary}
              autoFocus
            />

            <View style={tw`flex-row items-center justify-end`}>
              <TouchableOpacity
                onPress={() => setIsEditingName(false)}
                style={[
                  tw`px-4 py-2 rounded-xl ${isRTL ? 'ml-2' : 'mr-2'}`,
                  { backgroundColor: colors.screenBg },
                ]}
              >
                <Text style={[tw`text-sm font-semibold`, { color: colors.textSecondary }]}>
                  {t('common.cancel')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSaveName}
                disabled={savingName}
                style={[
                  tw`px-4 py-2 rounded-xl flex-row items-center`,
                  { backgroundColor: colors.primary },
                ]}
              >
                {savingName ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={[tw`text-sm font-bold`, { color: colors.white }]}>
                    {t('common.save')}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <Text
            style={[
              tw`text-sm mt-1`,
              { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' },
            ]}
          >
            {profile?.name}
          </Text>
        )}
      </View>

      {/* 3. Egyptian Addresses Section */}
      <View
        style={[
          cardShadow,
          tw`rounded-2xl p-4 mb-3 border`,
          { backgroundColor: colors.cardBg, borderColor: colors.border },
        ]}
      >
        <View style={tw`flex-row items-center justify-between mb-3`}>
          <View style={tw`flex-row items-center`}>
            <MaterialCommunityIcons
              name="map-marker-outline"
              size={20}
              color={colors.primary}
            />
            <Text
              style={[
                tw`font-bold text-base ${isRTL ? 'mr-2' : 'ml-2'}`,
                { color: colors.textPrimary },
              ]}
            >
              {t('profile.addressesSection')}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => openAddressModal()}
            style={[
              tw`px-3 py-1.5 rounded-lg flex-row items-center`,
              { backgroundColor: colors.primarySoft },
            ]}
          >
            <MaterialCommunityIcons name="plus" size={16} color={colors.primary} />
            <Text
              style={[
                tw`text-xs font-bold ${isRTL ? 'mr-1' : 'ml-1'}`,
                { color: colors.primary },
              ]}
            >
              {t('profile.addAddress')}
            </Text>
          </TouchableOpacity>
        </View>

        {loadingAddresses ? (
          <ActivityIndicator size="small" color={colors.primary} style={tw`py-4`} />
        ) : addresses.length === 0 ? (
          <Text
            style={[
              tw`text-xs py-2`,
              { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' },
            ]}
          >
            لا توجد عناوين مسجلة بعد. أضف عنوانك لسهولة وسرعة التوصيل.
          </Text>
        ) : (
          addresses.map((addr) => (
            <View
              key={`profile-addr-${addr.id}`}
              style={[
                tw`p-3.5 rounded-xl mb-2.5 border`,
                {
                  borderColor: addr.isDefault ? colors.primary : colors.border,
                  backgroundColor: addr.isDefault ? colors.primarySoft : colors.screenBg,
                },
              ]}
            >
              <View style={tw`flex-row items-center justify-between mb-1.5`}>
                <View style={tw`flex-row items-center`}>
                  <Text style={[tw`font-bold text-sm`, { color: colors.textPrimary }]}>
                    {addr.label || 'عنوان التوصيل'}
                  </Text>
                  {addr.isDefault && (
                    <View
                      style={[
                        tw`px-2 py-0.5 rounded-full ${isRTL ? 'mr-2' : 'ml-2'}`,
                        { backgroundColor: colors.primary },
                      ]}
                    >
                      <Text style={tw`text-white text-[10px] font-bold`}>
                        {t('profile.defaultBadge')}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Edit & Delete Icons */}
                <View style={tw`flex-row items-center`}>
                  <TouchableOpacity
                    onPress={() => openAddressModal(addr)}
                    style={tw`p-1`}
                  >
                    <MaterialCommunityIcons
                      name="pencil-outline"
                      size={18}
                      color={colors.primary}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteAddress(addr.id)}
                    style={[tw`p-1`, { [isRTL ? 'marginRight' : 'marginLeft']: 6 }]}
                  >
                    <MaterialCommunityIcons
                      name="trash-can-outline"
                      size={18}
                      color={colors.discount}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <Text
                style={[
                  tw`text-xs font-semibold`,
                  { color: colors.textPrimary, textAlign: isRTL ? 'right' : 'left' },
                ]}
              >
                {addr.recipientName} • {formatEgyptianPhone(addr.recipientPhone)}
              </Text>

              <Text
                style={[
                  tw`text-xs mt-1`,
                  { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' },
                ]}
              >
                {`${addr.governorate}، ${addr.city}، ${addr.area}، ${addr.streetBuilding}`}
              </Text>

              {!addr.isDefault && (
                <TouchableOpacity
                  onPress={() => handleSetDefaultAddress(addr)}
                  style={tw`mt-2 pt-1 border-t border-gray-200`}
                >
                  <Text
                    style={[
                      tw`text-xs font-semibold`,
                      { color: colors.primary, textAlign: isRTL ? 'right' : 'left' },
                    ]}
                  >
                    {t('profile.setDefault')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
      </View>

      {/* 4. Seller Dispatch Profile (Only for Sellers) */}
      {profile?.role === 'Seller' && (
        <View
          style={[
            cardShadow,
            tw`rounded-2xl p-4 mb-3 border`,
            { backgroundColor: colors.cardBg, borderColor: colors.border },
          ]}
        >
          <View style={tw`flex-row items-center mb-3`}>
            <MaterialCommunityIcons
              name="store-outline"
              size={20}
              color={colors.accent}
            />
            <Text
              style={[
                tw`font-bold text-base ${isRTL ? 'mr-2' : 'ml-2'}`,
                { color: colors.textPrimary },
              ]}
            >
              {t('profile.sellerProfileSection')}
            </Text>
          </View>

          {loadingSellerProfile ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <View>
              {/* Dispatch City (Required) */}
              <Text
                style={[
                  tw`text-xs font-semibold mb-1`,
                  { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' },
                ]}
              >
                {t('profile.dispatchCity')} *
              </Text>
              <TextInput
                style={[
                  tw`border rounded-xl px-3.5 py-2.5 text-sm mb-2.5`,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.screenBg,
                    color: colors.textPrimary,
                    textAlign: isRTL ? 'right' : 'left',
                  },
                ]}
                value={sellerProfile.dispatchCity}
                onChangeText={(text) =>
                  setSellerProfile((prev) => ({ ...prev, dispatchCity: text }))
                }
                placeholder="مثال: القاهرة، الجيزة، الإسكندرية"
                placeholderTextColor={colors.textSecondary}
              />

              {/* Dispatch Address */}
              <Text
                style={[
                  tw`text-xs font-semibold mb-1`,
                  { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' },
                ]}
              >
                {t('profile.dispatchAddress')}
              </Text>
              <TextInput
                style={[
                  tw`border rounded-xl px-3.5 py-2.5 text-sm mb-2.5`,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.screenBg,
                    color: colors.textPrimary,
                    textAlign: isRTL ? 'right' : 'left',
                  },
                ]}
                value={sellerProfile.dispatchAddress}
                onChangeText={(text) =>
                  setSellerProfile((prev) => ({ ...prev, dispatchAddress: text }))
                }
                placeholder="عنوان المخزن أو المعرض بالتفصيل"
                placeholderTextColor={colors.textSecondary}
              />

              {/* Contact Phone */}
              <Text
                style={[
                  tw`text-xs font-semibold mb-1`,
                  { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' },
                ]}
              >
                {t('profile.contactPhone')}
              </Text>
              <TextInput
                style={[
                  tw`border rounded-xl px-3.5 py-2.5 text-sm mb-3`,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.screenBg,
                    color: colors.textPrimary,
                    textAlign: isRTL ? 'right' : 'left',
                  },
                ]}
                keyboardType="phone-pad"
                value={sellerProfile.contactPhone}
                onChangeText={(text) =>
                  setSellerProfile((prev) => ({ ...prev, contactPhone: text }))
                }
                placeholder="010xxxxxxxx"
                placeholderTextColor={colors.textSecondary}
              />

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleSaveSellerProfile}
                disabled={savingSellerProfile}
                style={[
                  tw`py-2.5 rounded-xl items-center justify-center flex-row`,
                  { backgroundColor: colors.accent },
                ]}
              >
                {savingSellerProfile ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={[tw`font-bold text-sm text-white`]}>
                    {t('common.save')}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* 5. Change Password Card */}
      <View
        style={[
          cardShadow,
          tw`rounded-2xl p-4 mb-3 border`,
          { backgroundColor: colors.cardBg, borderColor: colors.border },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setIsChangingPassword((prev) => !prev)}
          style={tw`flex-row items-center justify-between`}
        >
          <View style={tw`flex-row items-center`}>
            <MaterialCommunityIcons
              name="lock-reset"
              size={20}
              color={colors.primary}
            />
            <Text
              style={[
                tw`font-bold text-base ${isRTL ? 'mr-2' : 'ml-2'}`,
                { color: colors.textPrimary },
              ]}
            >
              {t('profile.changePassword')}
            </Text>
          </View>

          <MaterialCommunityIcons
            name={isChangingPassword ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={colors.textSecondary}
          />
        </TouchableOpacity>

        {isChangingPassword && (
          <View style={tw`mt-3 border-t border-gray-100 pt-3`}>
            <Text
              style={[
                tw`text-xs font-semibold mb-1`,
                { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' },
              ]}
            >
              {t('profile.currentPassword')}
            </Text>
            <TextInput
              secureTextEntry
              style={[
                tw`border rounded-xl px-3.5 py-2.5 text-sm mb-2.5`,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.screenBg,
                  color: colors.textPrimary,
                  textAlign: isRTL ? 'right' : 'left',
                },
              ]}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.textSecondary}
            />

            <Text
              style={[
                tw`text-xs font-semibold mb-1`,
                { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' },
              ]}
            >
              {t('profile.newPassword')}
            </Text>
            <TextInput
              secureTextEntry
              style={[
                tw`border rounded-xl px-3.5 py-2.5 text-sm mb-2.5`,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.screenBg,
                  color: colors.textPrimary,
                  textAlign: isRTL ? 'right' : 'left',
                },
              ]}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.textSecondary}
            />

            <Text
              style={[
                tw`text-xs font-semibold mb-1`,
                { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' },
              ]}
            >
              {t('profile.confirmNewPassword')}
            </Text>
            <TextInput
              secureTextEntry
              style={[
                tw`border rounded-xl px-3.5 py-2.5 text-sm mb-3`,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.screenBg,
                  color: colors.textPrimary,
                  textAlign: isRTL ? 'right' : 'left',
                },
              ]}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.textSecondary}
            />

            <View style={tw`flex-row items-center justify-end`}>
              <TouchableOpacity
                onPress={() => {
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                  setIsChangingPassword(false);
                }}
                style={[
                  tw`px-4 py-2 rounded-xl ${isRTL ? 'ml-2' : 'mr-2'}`,
                  { backgroundColor: colors.screenBg },
                ]}
              >
                <Text style={[tw`text-sm font-semibold`, { color: colors.textSecondary }]}>
                  {t('common.cancel')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSavePassword}
                disabled={savingPassword}
                style={[
                  tw`px-4 py-2 rounded-xl flex-row items-center`,
                  { backgroundColor: colors.primary },
                ]}
              >
                {savingPassword ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={[tw`text-sm font-bold`, { color: colors.white }]}>
                    {t('common.save')}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* 6. Language Switch Card (Arabic / English ONLY - Russian dropped) */}
      <View
        style={[
          cardShadow,
          tw`rounded-2xl p-4 mb-3 border`,
          { backgroundColor: colors.cardBg, borderColor: colors.border },
        ]}
      >
        <View style={tw`flex-row items-center mb-3`}>
          <MaterialCommunityIcons
            name="translate"
            size={20}
            color={colors.primary}
          />
          <Text
            style={[
              tw`font-bold text-base ${isRTL ? 'mr-2' : 'ml-2'}`,
              { color: colors.textPrimary },
            ]}
          >
            {t('profile.language')}
          </Text>
        </View>

        <View style={tw`flex-row items-center justify-between`}>
          {/* Arabic Button (Primary) */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => handleLanguageChange('ar')}
            style={[
              tw`flex-1 py-2.5 rounded-xl items-center justify-center ${isRTL ? 'ml-2' : 'mr-2'} border`,
              {
                backgroundColor: isArabicActive ? colors.primary : colors.screenBg,
                borderColor: isArabicActive ? colors.primary : colors.border,
              },
            ]}
          >
            <Text
              style={[
                tw`font-bold text-sm`,
                { color: isArabicActive ? colors.white : colors.textPrimary },
              ]}
            >
              {t('profile.arabic')}
            </Text>
          </TouchableOpacity>

          {/* English Button (Secondary) */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => handleLanguageChange('en')}
            style={[
              tw`flex-1 py-2.5 rounded-xl items-center justify-center ${isRTL ? 'mr-2' : 'ml-2'} border`,
              {
                backgroundColor: !isArabicActive ? colors.primary : colors.screenBg,
                borderColor: !isArabicActive ? colors.primary : colors.border,
              },
            ]}
          >
            <Text
              style={[
                tw`font-bold text-sm`,
                { color: !isArabicActive ? colors.white : colors.textPrimary },
              ]}
            >
              {t('profile.english')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 7. Logout Button */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={handleLogout}
        style={[
          cardShadow,
          tw`rounded-2xl p-4 flex-row items-center justify-center border mt-2`,
          {
            backgroundColor: colors.dangerSoft,
            borderColor: colors.discount,
          },
        ]}
      >
        <MaterialCommunityIcons
          name="logout"
          size={20}
          color={colors.discount}
        />
        <Text
          style={[
            tw`font-bold text-base ${isRTL ? 'mr-2' : 'ml-2'}`,
            { color: colors.discount },
          ]}
        >
          {t('profile.logout')}
        </Text>
      </TouchableOpacity>

      {/* ─── Address Form Modal (4 Egyptian Fields) ─── */}
      <Modal
        visible={addressModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAddressModalVisible(false)}
      >
        <View style={tw`flex-1 justify-end bg-black/40`}>
          <View
            style={[
              tw`rounded-t-3xl p-5 max-h-[85%]`,
              { backgroundColor: colors.cardBg },
            ]}
          >
            <View style={tw`flex-row items-center justify-between pb-3 border-b border-gray-100`}>
              <Text style={[tw`font-bold text-lg`, { color: colors.textPrimary }]}>
                {editingAddressId
                  ? t('profile.addressModal.titleEdit')
                  : t('profile.addressModal.titleNew')}
              </Text>
              <TouchableOpacity onPress={() => setAddressModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={tw`mt-3`}>
              {/* Label */}
              <Text
                style={[
                  tw`text-xs font-semibold mb-1`,
                  { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' },
                ]}
              >
                {t('profile.addressModal.label')}
              </Text>
              <TextInput
                style={[
                  tw`border rounded-xl px-3 py-2 text-sm mb-2.5`,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.screenBg,
                    color: colors.textPrimary,
                    textAlign: isRTL ? 'right' : 'left',
                  },
                ]}
                value={addressForm.label}
                onChangeText={(text) => setAddressForm((p) => ({ ...p, label: text }))}
                placeholder="المنزل، العمل..."
                placeholderTextColor={colors.textSecondary}
              />

              {/* Recipient Name */}
              <Text
                style={[
                  tw`text-xs font-semibold mb-1`,
                  { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' },
                ]}
              >
                {t('profile.addressModal.recipientName')} *
              </Text>
              <TextInput
                style={[
                  tw`border rounded-xl px-3 py-2 text-sm mb-2.5`,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.screenBg,
                    color: colors.textPrimary,
                    textAlign: isRTL ? 'right' : 'left',
                  },
                ]}
                value={addressForm.recipientName}
                onChangeText={(text) => setAddressForm((p) => ({ ...p, recipientName: text }))}
                placeholder="اسم المستلم الثلاثي"
                placeholderTextColor={colors.textSecondary}
              />

              {/* Recipient Phone */}
              <Text
                style={[
                  tw`text-xs font-semibold mb-1`,
                  { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' },
                ]}
              >
                {t('profile.addressModal.recipientPhone')} *
              </Text>
              <TextInput
                style={[
                  tw`border rounded-xl px-3 py-2 text-sm mb-2.5`,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.screenBg,
                    color: colors.textPrimary,
                    textAlign: isRTL ? 'right' : 'left',
                  },
                ]}
                keyboardType="phone-pad"
                value={addressForm.recipientPhone}
                onChangeText={(text) => setAddressForm((p) => ({ ...p, recipientPhone: text }))}
                placeholder="010xxxxxxxx"
                placeholderTextColor={colors.textSecondary}
              />

              {/* 1. Governorate */}
              <Text
                style={[
                  tw`text-xs font-semibold mb-1`,
                  { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' },
                ]}
              >
                {t('profile.addressModal.governorate')} *
              </Text>
              <TextInput
                style={[
                  tw`border rounded-xl px-3 py-2 text-sm mb-2.5`,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.screenBg,
                    color: colors.textPrimary,
                    textAlign: isRTL ? 'right' : 'left',
                  },
                ]}
                value={addressForm.governorate}
                onChangeText={(text) => setAddressForm((p) => ({ ...p, governorate: text }))}
                placeholder="مثال: القاهرة، الجيزة، الإسكندرية"
                placeholderTextColor={colors.textSecondary}
              />

              {/* 2. City */}
              <Text
                style={[
                  tw`text-xs font-semibold mb-1`,
                  { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' },
                ]}
              >
                {t('profile.addressModal.city')} *
              </Text>
              <TextInput
                style={[
                  tw`border rounded-xl px-3 py-2 text-sm mb-2.5`,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.screenBg,
                    color: colors.textPrimary,
                    textAlign: isRTL ? 'right' : 'left',
                  },
                ]}
                value={addressForm.city}
                onChangeText={(text) => setAddressForm((p) => ({ ...p, city: text }))}
                placeholder="مثال: مدينة نصر، المعادي، الدقي"
                placeholderTextColor={colors.textSecondary}
              />

              {/* 3. Area */}
              <Text
                style={[
                  tw`text-xs font-semibold mb-1`,
                  { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' },
                ]}
              >
                {t('profile.addressModal.area')} *
              </Text>
              <TextInput
                style={[
                  tw`border rounded-xl px-3 py-2 text-sm mb-2.5`,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.screenBg,
                    color: colors.textPrimary,
                    textAlign: isRTL ? 'right' : 'left',
                  },
                ]}
                value={addressForm.area}
                onChangeText={(text) => setAddressForm((p) => ({ ...p, area: text }))}
                placeholder="مثال: الحي السابع، المنطقة الأولى"
                placeholderTextColor={colors.textSecondary}
              />

              {/* 4. Street & Building */}
              <Text
                style={[
                  tw`text-xs font-semibold mb-1`,
                  { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' },
                ]}
              >
                {t('profile.addressModal.streetBuilding')} *
              </Text>
              <TextInput
                style={[
                  tw`border rounded-xl px-3 py-2 text-sm mb-3`,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.screenBg,
                    color: colors.textPrimary,
                    textAlign: isRTL ? 'right' : 'left',
                  },
                ]}
                value={addressForm.streetBuilding}
                onChangeText={(text) => setAddressForm((p) => ({ ...p, streetBuilding: text }))}
                placeholder="الشارع ورقم العمارة والدور والشقة"
                placeholderTextColor={colors.textSecondary}
              />

              {/* Default Address Switch */}
              <View style={tw`flex-row items-center justify-between py-2 mb-4`}>
                <Text style={[tw`text-sm font-semibold`, { color: colors.textPrimary }]}>
                  {t('profile.addressModal.isDefault')}
                </Text>
                <Switch
                  value={addressForm.isDefault}
                  onValueChange={(val) => setAddressForm((p) => ({ ...p, isDefault: val }))}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.white}
                />
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                activeOpacity={0.85}
                disabled={savingAddress}
                onPress={handleSaveAddress}
                style={[
                  tw`py-3 rounded-xl items-center justify-center flex-row mb-6`,
                  { backgroundColor: colors.primary },
                ]}
              >
                {savingAddress ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={tw`text-white font-bold text-base`}>
                    {t('common.save')}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
