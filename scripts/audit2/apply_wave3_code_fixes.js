const fs = require('fs');

function update(file, s, r) {
  let content = fs.readFileSync(file, 'utf8');
  const isCrlf = content.includes('\r\n');
  content = content.replace(/\r\n/g, '\n');
  const normS = s.replace(/\r\n/g, '\n');
  const normR = r.replace(/\r\n/g, '\n');
  if (!content.includes(normS)) {
    console.error(`FAILED to find in ${file}:\n${normS.substring(0, 100)}`);
    return false;
  }
  content = content.replace(normS, normR);
  if (isCrlf) content = content.replace(/\n/g, '\r\n');
  fs.writeFileSync(file, content, 'utf8');
  console.log(`Updated ${file}`);
  return true;
}

// 1. BrandLogo.js
update('mobile/src/components/common/BrandLogo.js',
`  const { i18n } = useTranslation();`,
`  const { t, i18n } = useTranslation();`
);

update('mobile/src/components/common/BrandLogo.js',
`          {isRTL ? (
            <>
              سوق <Text style={{ color: colors.primary }}>مصر</Text>
            </>
          ) : (
            <>
              Egypt <Text style={{ color: colors.primary }}>Shop</Text>
            </>
          )}`,
`          {isRTL ? (
            <>
              {t('brand.shop')} <Text style={{ color: colors.primary }}>{t('brand.egypt')}</Text>
            </>
          ) : (
            <>
              {t('brand.egypt')} <Text style={{ color: colors.primary }}>{t('brand.shop')}</Text>
            </>
          )}`
);

update('mobile/src/components/common/BrandLogo.js',
`            {isRTL ? 'المتجر المصري الرائد' : 'PREMIUM MARKETPLACE'}`,
`            {t('brand.tagline')}`
);

// 2. UnlockScreen.js
update('mobile/src/screens/auth/UnlockScreen.js',
`          <Text style={styles.appTitle}>سوق مصر</Text>
          <Text style={styles.appSubtitle}>Marketplace</Text>`,
`          <Text style={styles.appTitle}>{t('unlock.appName')}</Text>
          <Text style={styles.appSubtitle}>{t('unlock.subtitle')}</Text>`
);

update('mobile/src/screens/auth/UnlockScreen.js',
`              {userName || userEmail || 'مستخدم مسجل'}`,
`              {userName || userEmail || t('unlock.registeredUser')}`
);

// 3. LoginScreen.js
update('mobile/src/screens/auth/LoginScreen.js',
`          <Text style={styles.brandName}>Marketplace</Text>`,
`          <Text style={styles.brandName}>{t('common.appName')}</Text>`
);

// 4. CatalogScreen.js
update('mobile/src/screens/buyer/CatalogScreen.js',
`            <Text style={styles.brandTitle}>Marketplace</Text>
            <Text style={styles.brandBadge}>{isRTL ? 'مصر 🇪🇬' : 'Egypt 🇪🇬'}</Text>
          </View>
          <View style={styles.deliveryBadge}>
            <MaterialCommunityIcons name="truck-fast-outline" size={13} color="#FED7AA" />
            <Text style={styles.deliveryBadgeText}>
              {isRTL ? 'شحن لكافة المحافظات' : 'Delivery Across Egypt'}
            </Text>`,
`            <Text style={styles.brandTitle}>{t('common.appName')}</Text>
            <Text style={styles.brandBadge}>{t('catalog.brandBadge')}</Text>
          </View>
          <View style={styles.deliveryBadge}>
            <MaterialCommunityIcons name="truck-fast-outline" size={13} color="#FED7AA" />
            <Text style={styles.deliveryBadgeText}>
              {t('catalog.deliveryBadge')}
            </Text>`
);

// 5. RegisterScreen.js
update('mobile/src/screens/auth/RegisterScreen.js',
`import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  StyleSheet,
  StatusBar,
} from 'react-native';`,
`import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  StyleSheet,
  StatusBar,
  Linking,
} from 'react-native';
import Constants from 'expo-constants';`
);

update('mobile/src/screens/auth/RegisterScreen.js',
`                    <Text style={styles.registerButtonText}>{t('auth.register')}</Text>
                    <Ionicons name="arrow-forward" size={20} color="#fff" style={{ marginLeft: 8 }} />`,
`                    <Text style={styles.registerButtonText}>{t('auth.register')}</Text>
                    <Ionicons name={isRTL ? "arrow-back" : "arrow-forward"} size={20} color="#fff" style={{ marginStart: 8 }} />`
);

update('mobile/src/screens/auth/RegisterScreen.js',
`            {/* Terms */}
            <Text style={styles.termsText}>{t('auth.agreeTerms')}</Text>`,
`            {/* Terms */}
            <TouchableOpacity
              onPress={() => {
                const url = Constants.expoConfig?.extra?.privacyPolicyUrl || 'https://egyptianmarketplace.eg/privacy';
                Linking.openURL(url).catch(() => {});
              }}
              accessible={true}
              accessibilityRole="link"
              accessibilityLabel={t('auth.agreeTerms')}
            >
              <Text style={styles.termsText}>{t('auth.agreeTerms')}</Text>
            </TouchableOpacity>`
);

update('mobile/src/screens/auth/RegisterScreen.js',
`  inputIcon: {
    marginRight: 10,
  },`,
`  inputIcon: {
    marginEnd: 10,
  },`
);

update('mobile/src/screens/auth/RegisterScreen.js',
`    marginRight: 10,
    marginTop: 2,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.textSecondary,
    textAlign: 'left',
  },`,
`    marginEnd: 10,
    marginTop: 2,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.textSecondary,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },`
);

// 6. ResetPasswordScreen.js
update('mobile/src/screens/auth/ResetPasswordScreen.js',
`import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  StyleSheet,
  StatusBar,
} from 'react-native';`,
`import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  StyleSheet,
  StatusBar,
  I18nManager,
} from 'react-native';`
);

update('mobile/src/screens/auth/ResetPasswordScreen.js',
`  const { t } = useTranslation();`,
`  const { t, i18n } = useTranslation();
  const isRTL = i18n.language?.startsWith('ar') || I18nManager.isRTL;`
);

update('mobile/src/screens/auth/ResetPasswordScreen.js',
`            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>`,
`            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={t('common.back')}
            >
              <Ionicons name={isRTL ? "arrow-forward" : "arrow-back"} size={24} color="#fff" />
            </TouchableOpacity>`
);

// 7. VerifyScreen.js
update('mobile/src/screens/auth/VerifyScreen.js',
`import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  StyleSheet,
  StatusBar,
} from 'react-native';`,
`import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  StyleSheet,
  StatusBar,
  I18nManager,
} from 'react-native';`
);

update('mobile/src/screens/auth/VerifyScreen.js',
`  const { t } = useTranslation();`,
`  const { t, i18n } = useTranslation();
  const isRTL = i18n.language?.startsWith('ar') || I18nManager.isRTL;`
);

update('mobile/src/screens/auth/VerifyScreen.js',
`            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>`,
`            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={t('common.back')}
            >
              <Ionicons name={isRTL ? "arrow-forward" : "arrow-back"} size={24} color="#fff" />
            </TouchableOpacity>`
);
