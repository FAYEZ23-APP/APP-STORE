import React from 'react';
import { View, Text, Switch, StyleSheet, Platform, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';
import AccountQuickAction from './AccountQuickAction';
import ProfileSectionHeader from './ProfileSectionHeader';

export default function AccountSettingsSection({
  role = 'Buyer',
  navigation,
  // Wallet
  walletEnabled = false,
  walletBalance = 0,
  onOpenWalletModal,
  // Passwords & Security
  isChangingPassword,
  onToggleChangePassword,
  biometricSupport = { available: false },
  biometricsEnabled = false,
  onToggleBiometrics,
  // Edit Name
  onEditName,
  // Google
  googleEnabled = false,
  onLinkGoogle,
  linkGoogleLoading = false,
  // Language
  isArabicActive = true,
  onLanguageChange,
  // Support
  onOpenSupportWhatsApp,
  onOpenHelpCenter,
  // PDPL & Auth
  onExportData,
  exportingData = false,
  onDeleteAccount,
  onLogout,
}) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language?.startsWith('ar');
  const isSeller = role === 'Seller';

  return (
    <View style={styles.container}>
      {/* ─── GROUP: Shopping & Commerce (Buyer Only) ─── */}
      {!isSeller && (
        <>
          <ProfileSectionHeader
            title={t('profile.groupShopping', 'التسوق والطلبات')}
            icon="shopping-outline"
          />
          <View style={styles.cardGroup}>
            <AccountQuickAction
              icon="clipboard-list-outline"
              title={t('profile.myOrdersCount', 'طلباتي')}
              subtitle={isRTL ? 'متابعة الشحنات وسجل الطلبات' : 'Track shipments & order history'}
              iconColor="#2563EB"
              iconBgColor="#EFF6FF"
              onPress={() => navigation?.navigate('MyOrders', { filterStatus: 'All' })}
            />

            <AccountQuickAction
              icon="heart-outline"
              title={t('profile.myFavorites', 'قائمة المفضلة')}
              subtitle={t('profile.myFavoritesDesc', 'المنتجات المحفوظة للشراء لاحقاً')}
              iconColor="#E11D48"
              iconBgColor="#FFF1F2"
              onPress={() => navigation?.navigate('Wishlist')}
            />

            <AccountQuickAction
              icon="cart-outline"
              title={t('profile.myCart', 'عربة التسوق')}
              subtitle={t('profile.myCartDesc', 'عرض المنتجات الجاهزة للشراء')}
              iconColor="#D97706"
              iconBgColor="#FEF3C7"
              onPress={() => navigation?.navigate('Cart')}
            />

            <AccountQuickAction
              icon="keyboard-return"
              title={t('profile.returnsExchanges', 'المرتجعات والاستبدال')}
              subtitle={t('profile.returnsExchangesDesc', 'متابعة طلبات المرتجعات وحالتها')}
              iconColor="#DC2626"
              iconBgColor="#FEE2E2"
              onPress={() => navigation?.navigate('MyOrders', { filterStatus: 'Returned' })}
            />

            {/* Buyer Wallet Store Credit (Strictly Gated by Feature Flag) */}
            {walletEnabled && (
              <AccountQuickAction
                icon="wallet-outline"
                title={t('profile.buyerWalletTitle', 'محفظة المشتري')}
                subtitle={t('profile.availableBalanceLabel', 'الرصيد المتاح:')}
                value={`${walletBalance} EGP`}
                iconColor={colors.gold}
                iconBgColor="rgba(214, 163, 58, 0.15)"
                onPress={onOpenWalletModal}
                showBottomDivider={false}
              />
            )}
          </View>
        </>
      )}

      {/* ─── GROUP: Seller Store Management Shortcuts (Seller Only) ─── */}
      {isSeller && (
        <>
          <ProfileSectionHeader
            title={t('profile.groupSellerTools', 'أدوات التاجر وإدارة المتجر')}
            icon="store-outline"
          />
          <View style={styles.cardGroup}>
            <AccountQuickAction
              icon="package-variant-closed"
              title={t('profile.sellerMyProducts', 'كتالوج المنتجات')}
              subtitle={isRTL ? 'إدارة وتحديث مخزون منتجاتك' : 'Manage catalog & stock levels'}
              iconColor="#7C3AED"
              iconBgColor="#F3E8FF"
              onPress={() => navigation?.navigate('MyProducts')}
            />

            <AccountQuickAction
              icon="plus-box-outline"
              title={t('profile.sellerAddProduct', 'إضافة منتج جديد')}
              subtitle={isRTL ? 'إضافة منتج جديد للبيع بالمنصة' : 'List a new item for sale'}
              iconColor="#16A34A"
              iconBgColor="#DCFCE7"
              onPress={() => navigation?.navigate('AddEditProduct')}
            />

            <AccountQuickAction
              icon="clipboard-check-outline"
              title={t('profile.sellerOrdersAction', 'طلبات المتجر والشحنات')}
              subtitle={isRTL ? 'تجهيز الشحنات ومتابعة المناديب' : 'Prepare shipments & dispatch'}
              iconColor="#2563EB"
              iconBgColor="#EFF6FF"
              onPress={() => navigation?.navigate('SellerOrders')}
            />

            {walletEnabled && (
              <AccountQuickAction
                icon="wallet-outline"
                title={t('profile.sellerWalletAction', 'محفظة التاجر والأرباح')}
                subtitle={isRTL ? 'رصيد المبيعات وطلبات السحب' : 'Sales balance & payout requests'}
                iconColor={colors.gold}
                iconBgColor="rgba(214, 163, 58, 0.15)"
                onPress={() => navigation?.navigate('SellerWallet')}
              />
            )}

            <AccountQuickAction
              icon="ticket-percent-outline"
              title={t('profile.sellerCouponsAction', 'كوبونات الخصم والعروض')}
              subtitle={isRTL ? 'إدارة قسائم التخفيض لمتجرك' : 'Create store discount vouchers'}
              iconColor="#EA580C"
              iconBgColor="#FFF7ED"
              onPress={() => navigation?.navigate('SellerCoupons')}
              showBottomDivider={false}
            />
          </View>
        </>
      )}

      {/* ─── GROUP: Personal Account & Security ─── */}
      <ProfileSectionHeader
        title={t('profile.groupPersonal', 'الحساب الشخصي')}
        icon="account-cog-outline"
      />
      <View style={styles.cardGroup}>
        {/* Edit Personal Name */}
        <AccountQuickAction
          icon="account-edit-outline"
          title={t('profile.editName', 'تعديل الاسم')}
          subtitle={t('profile.editProfileDesc', 'تعديل الاسم والبيانات الأساسية')}
          iconColor="#2563EB"
          iconBgColor="#EFF6FF"
          onPress={onEditName}
        />

        {/* Change Password */}
        <AccountQuickAction
          icon="lock-reset"
          title={t('profile.changePassword', 'تغيير كلمة المرور')}
          subtitle={t('profile.changePasswordDesc', 'تحديث كلمة مرور الحساب')}
          iconColor="#D97706"
          iconBgColor="#FEF3C7"
          onPress={onToggleChangePassword}
        />

        {/* Biometrics App Lock Toggle */}
        <AccountQuickAction
          icon="fingerprint"
          title={t('biometrics.securitySection', 'الأمان والدخول البيومتري')}
          subtitle={
            biometricSupport.available
              ? t('profile.biometricSecurityDesc', 'تأمين التطبيق بالبصمة البيومترية')
              : t(biometricSupport.messageKey || 'biometrics.hardwareUnavailable', 'البصمة غير متوفرة بهذا الجهاز')
          }
          iconColor={colors.primary}
          iconBgColor="#FDF2F4"
          showChevron={false}
          rightElement={
            biometricSupport.available ? (
              <Switch
                value={biometricsEnabled}
                onValueChange={onToggleBiometrics}
                trackColor={{ false: '#CBD5E1', true: colors.primary }}
                thumbColor={colors.white}
              />
            ) : null
          }
          showBottomDivider={false}
        />
      </View>

      {/* ─── GROUP: Customer Support & Help ─── */}
      <ProfileSectionHeader
        title={t('profile.groupSupport', 'المساعدة والدعم')}
        icon="help-circle-outline"
      />
      <View style={styles.cardGroup}>
        {/* Contact Us Support Entry */}
        <AccountQuickAction
          icon="headset"
          title={t('profile.contactUs', 'تواصل معنا')}
          subtitle={t('profile.contactUsDesc', 'فريق الدعم الفني وخدمة العملاء في خدمتك')}
          iconColor="#C8102E"
          iconBgColor="rgba(200, 16, 46, 0.08)"
          onPress={onOpenHelpCenter}
        />

        {/* Help Center FAQs */}
        <AccountQuickAction
          icon="frequently-asked-questions"
          title={t('profile.helpCenter', 'مركز المساعدة والأسئلة الشائعة')}
          subtitle={t('profile.helpCenterDesc', 'سياسات الشحن والاسترجاع والضمان')}
          iconColor="#7C3AED"
          iconBgColor="#F3E8FF"
          onPress={onOpenHelpCenter}
        />

        {/* App Notifications */}
        <AccountQuickAction
          icon="bell-outline"
          title={t('profile.notificationsAction', 'إشعارات التطبيق')}
          subtitle={t('profile.notificationsActionDesc', 'تنبيهات العروض والشحنات والحساب')}
          iconColor="#2563EB"
          iconBgColor="#EFF6FF"
          onPress={() => navigation?.navigate('Notifications')}
          showBottomDivider={false}
        />
      </View>

      {/* ─── GROUP: Preferences, Legal & Session ─── */}
      <ProfileSectionHeader
        title={t('profile.groupSettings', 'الإعدادات والأمان')}
        icon="tune"
      />
      <View style={styles.cardGroup}>
        {/* Language Switcher */}
        <View style={styles.langRow}>
          <View style={[styles.langTextGroup, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <View style={[styles.iconWrap, { backgroundColor: '#F3E8FF' }, isRTL ? { marginLeft: 12 } : { marginRight: 12 }]}>
              <MaterialCommunityIcons name="translate" size={18} color="#7C3AED" />
            </View>
            <View style={{ alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
              <Text style={styles.settingTitle}>{t('profile.appLanguageAndDir', 'لغة التطبيق واتجاه الواجهة')}</Text>
              <Text style={styles.settingSubtitle}>
                {isArabicActive ? 'العربية 🇪🇬 (RTL)' : 'English (LTR)'}
              </Text>
            </View>
          </View>

          <View style={[styles.langPillContainer, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <TouchableOpacity
              accessible={true}
              accessibilityRole="button"
              onPress={() => onLanguageChange('ar')}
              style={[styles.langBtn, isArabicActive && styles.langBtnActive]}
              activeOpacity={0.8}
            >
              <Text style={[styles.langBtnText, isArabicActive && styles.langBtnTextActive]}>
                العربية
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              accessible={true}
              accessibilityRole="button"
              onPress={() => onLanguageChange('en')}
              style={[styles.langBtn, !isArabicActive && styles.langBtnActive]}
              activeOpacity={0.8}
            >
              <Text style={[styles.langBtnText, !isArabicActive && styles.langBtnTextActive]}>
                EN
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.divider} />

        {/* Google SSO Linking (when googleEnabled is true) */}
        {googleEnabled && (
          <>
            <AccountQuickAction
              icon="google"
              title={t('profile.googleLinkingTitle', 'ربط الحساب بـ Google')}
              subtitle={t('profile.googleLinkingDesc', 'تسجيل الدخول السريع بأمان')}
              iconColor="#2563EB"
              iconBgColor="#EFF6FF"
              onPress={onLinkGoogle}
              rightElement={
                linkGoogleLoading ? (
                  <ActivityIndicator size="small" color="#2563EB" />
                ) : null
              }
            />
          </>
        )}

        {/* Sign Out */}
        <AccountQuickAction
          icon="logout"
          title={t('profile.logoutAccount', 'تسجيل الخروج من الحساب')}
          subtitle={isRTL ? 'إنهاء الجلسة الحالية بأمان' : 'Securely end your active session'}
          isDestructive={true}
          onPress={onLogout}
          showChevron={false}
          showBottomDivider={false}
        />
      </View>

      {/* Delete Account Discreet Action (PDPL Right to Erasure) */}
      <TouchableOpacity
        accessible={true}
        accessibilityRole="button"
        onPress={onDeleteAccount}
        style={styles.deleteAccountLink}
        activeOpacity={0.7}
      >
        <Text style={styles.deleteAccountLinkText}>
          {t('profile.deleteAccountTitle', 'حذف الحساب نهائياً')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  cardGroup: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 5,
      },
      android: {
        elevation: 1,
      },
      default: {},
    }),
  },
  langRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  langTextGroup: {
    alignItems: 'center',
    flex: 1,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  settingSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  langPillContainer: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 2,
  },
  langBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  langBtnActive: {
    backgroundColor: colors.primary,
  },
  langBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  langBtnTextActive: {
    color: colors.white,
    fontWeight: '800',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginHorizontal: 16,
  },
  deleteAccountLink: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginTop: 6,
  },
  deleteAccountLinkText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
    opacity: 0.8,
  },
});
