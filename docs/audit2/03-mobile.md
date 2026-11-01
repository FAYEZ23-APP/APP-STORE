# تقرير التدقيق الفني لتطبيق الهاتف المحمول (React Native / Expo)

**المعرف**: AUDIT-2026-MOBILE-03  
**تاريخ الفحص**: 2026-11-01  
**الدور**: مدقق استشاري مستقل (قراءة فقط - Read-Only)  
**النطاق**: تطبيق الهاتف في المجلد `mobile/` ومطابقة العقود مع الواجهة الخلفية `backend/`  
**دليل التوثيق**: كل عبارة معلمة بـ:
- `[V]` تم التحقق منها عبر قراءة الكود المصدري أو تشغيل أمر فعلي ومرفق مساره ورقمه وسجله.
- `[I]` استنتاج تحليلي مدعوم بالأدلة.
- `[G]` معرفة عامة في هندسة البرمجيات وأمن التطبيقات.

---

## 1. الحكم العام وأبرز المخاطر (Verdict & Top Risks)

### الحكم العام (Overall Verdict)
التطبيق مبني بهيكل حديث مستند إلى Expo SDK 58 و React Native 0.88 مع دعم لغوي ثنائي كامل عبر `i18next` والتزام كامل بقواعد عدم طباعة الأسرار وتخزين التوكنات في التخزين الآمن [V]. ومع ذلك، **التطبيق غير جاهز للإطلاق الإنتاجي على المتاجر (Not Release-Ready)** بسبب مجموعة من المخاطر المعمارية والأمنية ومخاطر إمكانية الوصول التي تعرضه لرفض المتجر ومشاكل تجربة المستخدم عند تذبذب الشبكة [I].

### أبرز خمسة مخاطر حرجة (Top 5 Risks)
1. **تزامن ملفي تهيئة متعارضين وتضارب حزمة المعرف (MOB-001) [HIGH]**: وجود `app.json` و `app.config.js` معاً، حيث يحدد الأول المعرف `com.marketplace.app` بينما يحدد الثاني `com.egyptianmarketplace.app` مع أخطاء هيكلية في المخطط رصدتها أداة `npx expo-doctor` [V].
2. **غياب مهلة زمنية للشبكة وسياسة إعادة المحاولة (MOB-002) [HIGH]**: كائن `axios` الأساسي لا يحدد خاصية `timeout` (تساوي صفر افتراضياً)، مما يؤدي لتعليق واجهة المستخدم إلى أجل غير مسمى عند انقطاع الاتصال بالخادم [V].
3. **قصور فادح في إمكانية الوصول (Accessibility Void) (MOB-003) [HIGH]**: 98.9% من العناصر التفاعلية القابلة للنقر (259 من أصل 262) تفتقر إلى `accessibilityLabel` أو `accessibilityRole`، مما يمنع قارئات الشاشة (TalkBack و VoiceOver) من مساعدة ذوي الإعاقة البصرية ويعرض التطبيق لمخالفة سياسات متجر Google Play [V].
4. **فشل نسبة التباين للألوان وفق معيار WCAG AA (MOB-004) [MEDIUM]**: تباين النص الأبيض على اللون الذهبي `#D6A33A` هو 2.29:1 فقط، والذهبي على خلفية الشاشة هو 2.16:1، وكلاهما يفشل في تحقيق الحد الأدنى للمعيار (4.5:1 للنص العادي و 3.0:1 للنص الكبير) [V].
5. **غياب مسار التحقق بخطوتين (2FA) في الواجهة (MOB-005) [HIGH]**: الواجهة الخلفية تدعم التحقق الثنائي عبر `RequiresTwoFactor` و `TwoFactorToken`، لكن كود الهاتف يتجاهل هذا الحقل تماماً ولا يمتلك أي شاشة لإدخال رمز OTP، مما يترك المستخدم الإداري أو الموثق معلقاً [V].

---

## 2. الحصر الشامل للأصول والمكونات (Inventory)

### 2.1 إصدارات الحزم الأساسية (Package Versions)
تم التحقق عبر فحص `package.json` ومقارنته بـ `package-lock.json` عبر الأمر المنفذ `node scripts/audit2/check_mobile_inventory.js` [V]:

| الحزمة (Package) | الإصدار المصرح به (package.json) | الإصدار الفعلي المقفل (package-lock.json) | التقييم |
| :--- | :--- | :--- | :--- |
| `expo` | `^58.0.0` [V] | `58.0.19` [V] | متوافق مع SDK 58 |
| `react` | `19.3.0` [V] | `19.3.0` [V] | مطابق تماماً |
| `react-native` | `0.88.0` [V] | `0.88.0` [V] | إشعار Expo Doctor يوصي بـ 0.88.1 |
| `expo-secure-store` | `~58.0.2` [V] | `58.0.2` [V] | مطابق |
| `expo-updates` | `~58.0.18` [V] | `58.0.18` [V] | مطابق |
| `axios` | `^1.20.0` [V] | `1.20.0` [V] | مطابق |
| `i18next` | `^26.4.2` [V] | `26.4.2` [V] | مطابق |
| `react-i18next` | `^17.0.16` [V] | `17.0.16` [V] | مطابق |

- إجمالي الحزم الاعتمادية المباشرة (Dependencies): 30 حزمة [V].
- إجمالي حزم التطوير (DevDependencies): 2 حزمة (`eslint`, `eslint-config-expo`) [V].

### 2.2 ملفات التهيئة (Configuration Files)
- وجود ملفين متزامنين: `mobile/app.json` و `mobile/app.config.js` [V].
- تقرير `npx expo-doctor` أظهر الخطأ: `"You have an app.json file in your project, but your app.config.js is not using the values from it"` بالإضافة لخطأ `"Field: splash - Additional property splash is not allowed"` في `app.json` [V].
- الفروق الجوهرية بين الملفين [V]:
  - اسم الحزمة في أندرويد: `app.json` يحدد `com.marketplace.app`، بينما `app.config.js` يحدد `com.egyptianmarketplace.app`.
  - الصلاحيات: `app.json` يفتقر إلى `android.permission.CAMERA` و `blockedPermissions`.
  - المكونات الإضافية (Plugins): `app.config.js` يحتوي على منطق ديناميكي لحقن `withCleartextTraffic` و `expo-image-picker`، بينما `app.json` جامد.
  - المعرف الإضافي: `eas.projectId` معرف فقط في `app.config.js` بالقيمة `'29c03258-b731-4ab9-870f-ea3571f77f3f'`.

### 2.3 الصلاحيات ومبرراتها (Permissions & Justification)
تم استخراج الصلاحيات الفعلية المجمعة عبر الأمر `npx expo config --type public` [V]:

| الصلاحية (Permission) | المنصة (Platform) | مبرر الاستخدام المصرح به | الحالة والتقييم |
| :--- | :--- | :--- | :--- |
| `android.permission.INTERNET` | Android | الاتصال بخوادم الواجهة الخلفية لتبادل البيانات | ضرورية وأساسية [V] |
| `android.permission.CAMERA` | Android / iOS | التقاط صور المنتجات (للبائع) وصور عيوب الشحنات لطلبات الاسترجاع | مبررة بمبرر واضح [V] |
| `android.permission.ACCESS_FINE_LOCATION` | Android | تحديد إحداثيات موقع التوصيل بدقة على الخريطة لحساب الشحن | مبررة [V] |
| `android.permission.ACCESS_COARSE_LOCATION` | Android | تحديد المدينة التقريبية كبديل عند تعذر التحديد الدقيق | مبررة [V] |
| `android.permission.USE_BIOMETRIC` | Android | فتح قفل التطبيق عبر بصمة الإصبع أو الوجه | مبررة وتُحقن آلياً [V] |
| `android.permission.USE_FINGERPRINT` | Android (Legacy) | دعم البصمة على الأجهزة القديمة (Android 8/9) | مبررة [V] |
| `NSFaceIDUsageDescription` | iOS InfoPlist | السماح بالدخول السريع بالبصمة | نص عربي وإنجليزي ثنائي [V] |
| `NSPhotoLibraryUsageDescription` | iOS InfoPlist | رفع صور المنتجات واسترجاع الشحنات | نص ثنائي واضح [V] |
| `NSCameraUsageDescription` | iOS InfoPlist | التقاط صور المنتجات واسترجاع الشحنات | نص ثنائي واضح [V] |
| `NSLocationWhenInUseUsageDescription` | iOS InfoPlist | تحديد عنوان التوصيل وحساب الشحن | نص ثنائي واضح [V] |

- الصلاحيات المحظورة صراحة في أندرويد عبر `blockedPermissions` لمنع الاستدعاء التلقائي للمكتبات [V]:
  - `android.permission.READ_EXTERNAL_STORAGE` [V]
  - `android.permission.WRITE_EXTERNAL_STORAGE` [V]
  - `android.permission.READ_MEDIA_IMAGES` [V]
  - `android.permission.RECORD_AUDIO` [V]

### 2.4 الهياكل الملاحية والشاشات (Navigators & Screens)
تم الفحص من خلال `AppNavigator.js` و `BuyerTabs.js` و `SellerTabs.js` و `AdminTabs.js` [V]:

| الشاشة (Screen) | الملف المصدري (File Path) | الدور المسموح (Role) | بوابة الميزة (Feature Flag) |
| :--- | :--- | :--- | :--- |
| `Login` | `screens/auth/LoginScreen.js` | Unauthenticated (null) | لا توجد |
| `Register` | `screens/auth/RegisterScreen.js` | Unauthenticated (null) | لا توجد |
| `Verify` | `screens/auth/VerifyScreen.js` | Unauthenticated (null) | لا توجد |
| `ForgotPassword` | `screens/auth/ForgotPasswordScreen.js` | Unauthenticated (null) | لا توجد |
| `ResetPassword` | `screens/auth/ResetPasswordScreen.js` | Unauthenticated (null) | لا توجد |
| `UnlockScreen` | `screens/auth/UnlockScreen.js` | All (Locked State) | تفعيل البصمة محلياً [V] |
| **Buyer Stack**: | | | |
| `Catalog` (Tab) | `screens/buyer/CatalogScreen.js` | Buyer | لا توجد |
| `Categories` (Tab) | `screens/buyer/CategoriesScreen.js` | Buyer | لا توجد |
| `Cart` (Tab) | `screens/buyer/CartScreen.js` | Buyer | لا توجد |
| `MyOrders` (Tab) | `screens/buyer/MyOrdersScreen.js` | Buyer | لا توجد |
| `Profile` (Tab) | `screens/common/ProfileScreen.js` | Buyer / Seller / Admin | مشتركة مع أقسام شرطية [V] |
| `Wishlist` | `screens/buyer/WishlistScreen.js` | Buyer | لا توجد |
| `Notifications` | `screens/common/NotificationsScreen.js` | All Roles | لا توجد |
| `Search` | `screens/buyer/MobileSearchScreen.js` | Buyer | لا توجد |
| `ProductDetails` | `screens/buyer/ProductDetailsScreen.js` | Buyer | لا توجد |
| `SellerStore` | `screens/buyer/SellerStoreScreen.js` | Buyer | لا توجد |
| `Checkout` | `screens/buyer/CheckoutScreen.js` | Buyer | `couponsEnabled`, `walletEnabled` [V] |
| `LocationPicker` | `components/MobileLocationPicker.js` | Buyer | لا توجد |
| **Seller Stack**: | | | |
| `Dashboard` (Tab) | `screens/seller/DashboardScreen.js` | Seller | لا توجد |
| `MyProducts` (Tab) | `screens/seller/MyProductsScreen.js` | Seller | لا توجد |
| `SellerOrders` (Tab) | `screens/seller/SellerOrdersScreen.js` | Seller | لا توجد |
| `SellerWalletTab` | `screens/seller/SellerWalletScreen.js` | Seller | `walletEnabled \|\| vendorPayoutsEnabled` [V] |
| `AddEditProduct` | `screens/seller/AddEditProductScreen.js` | Seller | لا توجد |
| `SellerWallet` | `screens/seller/SellerWalletScreen.js` | Seller | لا توجد حماية على مستوى Stack [V] |
| `SellerCoupons` | `screens/seller/SellerCouponsScreen.js` | Seller | لا توجد حماية على مستوى Stack [V] |
| **Admin Stack**: | | | |
| `AdminStats` (Tab) | `screens/admin/AdminStatsScreen.js` | Admin | لا توجد |
| `AdminUsers` (Tab) | `screens/admin/AdminUsersScreen.js` | Admin | لا توجد |
| `AdminPayouts` (Tab) | `screens/admin/AdminPayoutsScreen.js` | Admin | `vendorPayoutsEnabled \|\| walletEnabled` [V] |
| `AdminReviews` (Tab) | `screens/admin/AdminReviewsScreen.js` | Admin | لا توجد |
| `AdminCategories` (Tab) | `screens/admin/AdminCategoriesScreen.js` | Admin | لا توجد |

### 2.5 السياقات وإدارة الحالة (Contexts & State)
1. `AuthContext` (`src/context/AuthContext.js`): إدارة حالة المصادقة، التوكنات، فتح القفل البيومتري، والتحكم بالأدوار [V].
2. `CartContext` (`src/context/CartContext.js`): سلة المشتريات وتخزينها محلياً في `AsyncStorage` تحت مفتاح مرتبط بمعرف المستخدم [V].
3. `WishlistContext` (`src/context/WishlistContext.js`): قائمة الرغبات والتحديث التفاؤلي (Optimistic update) [V].

### 2.6 مفاتيح التخزين المحلي ومستوى حساسيتها (Storage Keys)
تم حصر جميع المفاتيح عبر مسح الكود المصدري [V]:

| المفتاح (Storage Key) | آلية التخزين (Storage Engine) | البيانات المخزنة (Data Stored) | مستوى الحساسية (Sensitivity) |
| :--- | :--- | :--- | :--- |
| `jwt_token` | `expo-secure-store` [V] | Access Token (JWT) | سرية للغاية (High) |
| `refresh_token_${userId}` | `expo-secure-store` [V] | Refresh Token الخاص بكل مستخدم | سرية للغاية (High) |
| `app_device_id` | `AsyncStorage` [V] | معرف فريد دائم للجهاز (UUID v4) | متوسطة (Pseudonymous) |
| `last_auth_user_id` | `AsyncStorage` [V] | معرف آخر مستخدم مسجل | منخفضة إلى متوسطة |
| `biometrics_enabled_${userId}` | `AsyncStorage` [V] | حالة تفعيل القفل البيومتري ('true'/'false') | منخفضة |
| `biometrics_offered_${userId}` | `AsyncStorage` [V] | تسجيل عرض الميزة سابقاً | منخفضة |
| `app_installed_initialized` | `AsyncStorage` [V] | راية فحص التثبيت النظيف لمسح المفاتيح القديمة | تشغيلية |
| `cart_items_${userId}` | `AsyncStorage` [V] | محتويات سلة التسوق للمستخدم | منخفضة |
| `cart_items_guest` | `AsyncStorage` [V] | محتويات سلة الزائر | منخفضة |
| `@marketplace_recent_searches` | `AsyncStorage` [V] | سجل آخر عمليات البحث | منخفضة إلى شخصية |
| `app_language` | `AsyncStorage` [V] | لغة التطبيق المحددة ('ar'/'en') | تشغيلية |
| `marketplace_device_push_token_v1`| `AsyncStorage` [V] | رمز الإشعار المحاكى للجهاز | تشغيلية |

### 2.7 متغيرات البيئة العامة (EXPO_PUBLIC_* Variables)
- `EXPO_PUBLIC_API_URL`: مسجل في `.env` بقيمة محلية `http://192.168.1.6:5209/api` [V].
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`: فارغ في `.env` [V].
- `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`: فارغ في `.env` [V].
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`: فارغ في `.env` [V].
- التقييم: لا توجد مفاتيح سرية خاصة أو أسرار واجهة خلفية مسربة في حزمة المتغيرات العامة [V].

### 2.8 مكتبات الطرف الثالث والبيانات المستلمة (Third-Party SDKs)
- `react-native-maps`: تستلم إحداثيات خطوط الطول والعرض وتتصل بخدمات Google Maps عبر مفتاح `apiKey` [V].
- `expo-location`: تستلم بيانات نظام تحديد المواقع العالمي (GPS) عبر أذونات الجهاز [V].
- `expo-image-picker`: تستلم الصور والملفات المختارة من معرض الصور أو الكاميرا [V].
- `expo-local-authentication`: واجهة تخاطب مع مستشعر البصمة بنظام التشغيل، لا تستلم بيانات البصمة نفسها بل تستلم نتيجة التحقق فقط `{ success: boolean }` [V].
- `expo-web-browser` و `expo-auth-session`: تستلم رمز `idToken` الصادر من خوادم Google [V].
- الإشعارات: لا توجد مكتبة خارجية مثل `expo-notifications`، ويتم توليد رمز UUID محلي وحفظه في `AsyncStorage` [V].

---

## 3. جدول الملاحظات والثغرات (Findings Table)

| المعرف | الخطورة | ملخص الملاحظة | الموقع المصدري | الجهد |
| :--- | :--- | :--- | :--- | :--- |
| **MOB-001** | **HIGH** | تضارب ملفات التهيئة واختلاف معرف التطبيق بين `app.json` و `app.config.js` | `mobile/app.json`, `mobile/app.config.js` [V] | S |
| **MOB-002** | **HIGH** | غياب مهلة انتهاء الطلب (Timeout) وإعادة المحاولة في عميل Axios | `mobile/src/api/client.js:39-44` [V] | S |
| **MOB-003** | **HIGH** | غياب شامل لتسميات إمكانية الوصول في 98.9% من العناصر التفاعلية | `mobile/src/**` [V] | M |
| **MOB-004** | **MEDIUM** | فشل تباين الألوان الأساسية للواجهة وفق معيار WCAG AA | `mobile/src/theme/colors.js` [V] | S |
| **MOB-005** | **HIGH** | عدم دعم التحقق بخطوتين (2FA) في عميل الهاتف | `mobile/src/context/AuthContext.js:352-376` [V] | M |
| **MOB-006** | **HIGH** | القفل البيومتري مجرد واجهة وهمية ولا يربط التوكن تشفيرياً بالعتاد | `mobile/src/utils/storage.js:72` [V] | M |
| **MOB-007** | **MEDIUM** | عواصف إعادة تصيير (Re-render Storms) لعدم استخدام `useMemo` في سياقات التطبيق | `mobile/src/context/AuthContext.js:509`, `WishlistContext.js:84` [V] | S |
| **MOB-008** | **MEDIUM** | غياب خصائص تحسين الأداء ونافذة العرض (Windowing) في جميع قوائم `FlatList` | `mobile/src/screens/**/*.js` (15 شاشة) [V] | M |
| **MOB-009** | **MEDIUM** | انعدام مراقبة اتصال الشبكة (NetInfo) وغياب شاشات حالة عدم الاتصال | `mobile/src/screens/**/*.js` [V] | M |
| **MOB-010** | **LOW** | تسريب تفاصيل مسار مكدس الأخطاء (Stack Trace) في واجهة `ErrorBoundary` بالإنتاج | `mobile/src/components/ErrorBoundary.js:43-49` [V] | S |
| **MOB-011** | **LOW** | غياب إعدادات التحديثات الهوائية (OTA) في `app.config.js` بالرغم من تثبيت الحزمة | `mobile/app.config.js`, `mobile/package.json:25` [V] | S |
| **MOB-012** | **MEDIUM** | عدم تعطيل النسخ الاحتياطي التلقائي لأندرويد صراحة (`android:allowBackup`) | `mobile/app.config.js:38-64` [V] | S |
| **MOB-013** | **LOW** | حقل لصق رمز Google ID Token يدوياً في الملف الشخصي غير ملائم للمستخدم | `mobile/src/screens/common/ProfileScreen.js:164-178` [V] | S |
| **MOB-014** | **LOW** | عدم تطابق إصدارات الحزم مع متطلبات SDK 58 ووجود 16 ثغرة تابعة | `mobile/package-lock.json`, `npx expo-doctor` [V] | M |
| **MOB-015** | **LOW** | نصوص ثابتة غير مترجمة في `ErrorBoundary` و `BrandLogo` تتجاوز ملفات التعريب | `components/ErrorBoundary.js:32-55`, `BrandLogo.js:91` [V] | S |

---

### تفاصيل الملاحظات الفنية (Detailed Findings)

#### MOB-001: تضارب ملفات التهيئة واختلاف معرف التطبيق
- **الخطورة**: HIGH
- **الدليل**: `app.json` يحدد المعرف `"com.marketplace.app"` بينما `app.config.js` يحدد `"com.egyptianmarketplace.app"` [V]. تشغيل `npx expo-doctor` أسفر عن خطأ فشل التحقق من المخطط بسبب حقل `splash` غير المسموح به في `app.json` [V].
- **الأثر**: تشتت أدوات البناء مثل EAS Build وأدوات الفحص التلقائي، واحتمالية بناء التطبيق بمعرف حزمة خاطئ عند الاستناد لـ `app.json`.
- **خطوات إعادة الإنتاج**: تشغيل `cd mobile; npx expo-doctor` وملاحظة الخطأين الصادرين.
- **مقترح الإصلاح**: حذف ملف `app.json` نهائياً والاكتفاء الكامل بـ `app.config.js`، أو توحيد القيم وحذف حقل `splash` المكرر.
- **الاختبار المقترح**: إضافة اختبار فحص تكاملي للتحقق من وجود ملف تهيئة واحد فقط في جذر المشروع.
- **الجهد**: S

#### MOB-002: غياب مهلة انتهاء الطلب (Timeout) وسياسة إعادة المحاولة
- **الخطورة**: HIGH
- **الدليل**: في `mobile/src/api/client.js:39-44` تم إنشاء عميل Axios بدون تحديد `timeout`:
```javascript
const client = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});
```
- **الأثر**: عند انقطاع الاتصال أو تذبذب شبكات المحمول المصرية (3G/4G)، تظل طلبات الواجهة معلقة إلى أجل غير مسمى دون أن يدخل التطبيق في كتلة الخطأ `catch`، مما يجمد واجهة المستخدم.
- **خطوات إعادة الإنتاج**: محاكاة طلب إلى مسار معطل وإيقاف استجابة الخادم؛ لا تنتهي صلاحية الطلب مطلقاً.
- **مقترح الإصلاح**: تحديد مهلة `timeout: 15000` (15 ثانية) في إعدادات Axios وإضافة معالج لإعادة المحاولة للطلبات التي تفشل بسبب مشاكل الشبكة.
- **الاختبار المقترح**: اختبار وحدة للتحقق من أن كائن Axios يحتوي على خاصية `timeout` موجبة أكبر من 5000 مللي ثانية.
- **الجهد**: S

#### MOB-003: قصور فادح في إمكانية الوصول (Accessibility Void)
- **الخطورة**: HIGH
- **الدليل**: نتج عن تشغيل أداة الفحص `scripts/audit2/audit_ux_a11y_rtl.js` رصد 262 زراً وعنصراً تفاعلياً (`TouchableOpacity`/`Pressable`)، منها 3 عناصر فقط تحتوي على `accessibilityLabel` أو `accessibilityRole` بنسبة تغطية 1.1% فقط [V].
- **الأثر**: التطبيق شبه مستحيل الاستخدام للأشخاص ذوي الإعاقة الذين يعتمدون على قارئات الشاشة (TalkBack على أندرويد و VoiceOver على iOS)، ومخالفة واضحة لإرشادات Google Play Accessibility.
- **خطوات إعادة الإنتاج**: تفعيل TalkBack في جهاز أندرويد والتنقل بين بطاقات المنتجات وأزرار الشراء؛ سيقرأ النظام "Button" مبهمة دون أي توضيح لمحتوى الزر أو وظيفته.
- **مقترح الإصلاح**: إضافة `accessibilityLabel={t('...')}` و `accessibilityRole="button"` لكافة الأزرار وحقول الإدخال.
- **الاختبار المقترح**: إضافة اختبار فحص ثابت في CI يتحقق من احتواء كل عنصر `TouchableOpacity` على خاصية `accessibilityLabel`.
- **الجهد**: M

#### MOB-004: فشل تباين الألوان الأساسية للواجهة وفق معيار WCAG AA
- **الخطورة**: MEDIUM
- **الدليل**: الحساب الدقيق لنسب التباين في `scripts/audit2/audit_ux_a11y_rtl.js` أظهر [V]:
  - النص الأبيض على الزر الذهبي (`#FFFFFF` على `#D6A33A`): **2.29:1** (الحد الأدنى المطلوب 4.5:1 للنص العادي و 3.0:1 للنص الكبير) [V].
  - النص الذهبي على خلفية الشاشة (`#D6A33A` على `#FAF8F5`): **2.16:1** [V].
  - النص الرمادي المشطوب على خلفية الشاشة (`#8C929B` على `#FAF8F5`): **2.96:1** [V].
- **الأثر**: صعوبة بالغة في قراءة النصوص والأسعار والأزرار الذهبية تحت ضوء الشمس المباشر وضعف تجربة المستخدم لضعاف البصر.
- **خطوات إعادة الإنتاج**: فحص عناصر الشراء الذهبية على جهاز حقيقي تحت إضاءة قوية.
- **مقترح الإصلاح**: تعديل اللون الذهبي إلى درجة أغمق بدرجة كافية (مثل `#996B00` أو استخدام نص داكن `#1F2329` فوق الأزرار الذهبية بدلاً من النص الأبيض لتحقيق تباين 6.88:1 الموثق في التقرير) [V].
- **الاختبار المقترح**: اختبار تلقائي يضمن عدم نزول أي تركيبة ألوان نص وخلفية عن 4.5:1.
- **الجهد**: S

#### MOB-005: غياب مسار التحقق بخطوتين (2FA) في عميل الهاتف
- **الخطورة**: HIGH
- **الدليل**: كود الواجهة الخلفية في `Marketplace.Application\DTOs\Auth\AuthDtos.cs:111-116` و `AuthController.cs:197` يدعم التحقق الثنائي عبر الحقول `RequiresTwoFactor` و `TwoFactorToken` [V]. بينما فحص كود `mobile/src` بالكامل لم يظهر أي وجود لكلمات `twoFactor` أو `2FA` أو `totp` [V].
- **الأثر**: إذا قام أي مستخدم بتفعيل ميزة 2FA، فلن يتمكن من تسجيل الدخول عبر تطبيق الهاتف إطلاقاً، حيث يفشل الدخول بصمت ويتجمد زر الدخول دون توجيهه لأي شاشة لإدخال رمز التحقق.
- **خطوات إعادة الإنتاج**: تفعيل 2FA لحساب ومحاولة الدخول عبر التطبيق؛ لا يحدث انتقال ويظل التطبيق في شاشة الدخول.
- **مقترح الإصلاح**: معالجة راية `RequiresTwoFactor` في `AuthContext.js` وإنشاء شاشة مخصصة لإدخال رمز OTP الخاص بتطبيق المصادقة واستدعاء مسار التحقق المناسب.
- **الاختبار المقترح**: اختبار محاكاة لعملية تسجيل الدخول عند استلام `RequiresTwoFactor: true`.
- **الجهد**: M

#### MOB-006: القفل البيومتري واجهة فقط بدون ربط عتادي
- **الخطورة**: HIGH
- **الدليل**: في `mobile/src/utils/storage.js:72`، يتم حفظ رمز التحديث عبر `SecureStore.setItemAsync` بدون الخيار `{ requireAuthentication: true }` [V]:
```javascript
export const setRefreshToken = async (userId, refreshToken) => {
  if (!userId || !refreshToken) return;
  try {
    await SecureStore.setItemAsync(getRefreshTokenKey(userId), refreshToken);
  } catch (error) { ... }
};
```
- **الأثر**: بالرغم من أن واجهة `UnlockScreen` توحي بأمان تام، إلا أن المفتاح غير مقفل على مستوى العتاد (Hardware Keystore/Keychain). إضافة أو إزالة بصمات أصابع جديدة من إعدادات الهاتف لا يُبطل صلاحية المفتاح المخزن، ويمكن لتطبيقات خبيثة أو إجراءات تصحيح الذاكرة استرجاع الرمز دون إذن عتادي.
- **خطوات إعادة الإنتاج**: تفعيل البصمة في التطبيق، ثم الدخول لإعدادات أندرويد وإضافة بصمة إصبع جديدة لشخص آخر، ثم فتح التطبيق؛ سيتم قبول البصمة الجديدة فوراً دون إعادة طلب كلمة المرور.
- **مقترح الإصلاح**: تفعيل الخيار `{ requireAuthentication: true }` عند حفظ واسترجاع التوكن الحساس في الحالات الداعمة مع معالجة واجهة الرجوع.
- **الاختبار المقترح**: اختبار سلوك التخزين الآمن مع اشتراط المصادقة العتادية.
- **الجهد**: M

#### MOB-007: عواصف إعادة تصيير ناتجة عن غياب `useMemo` في السياقات
- **الخطورة**: MEDIUM
- **الدليل**: في `mobile/src/context/AuthContext.js:509-530` و `mobile/src/context/WishlistContext.js:84-97`، يتم تمرير كائن جديد (Object Literal) إلى خاصية `value` في كل دورة تصيير بدون استخدام `useMemo` [V].
- **الأثر**: إعادة تصيير كامل شجرة المكونات التابعة لـ `AuthContext` و `WishlistContext` عند أي تغيير طفيف في الحالة، مما يسبب بطء ملحوظ واستهلاك بطارية زائد على أجهزة أندرويد الاقتصادية.
- **خطوات إعادة الإنتاج**: وضع `console.log` داخل مكون يستهلك `useContext(AuthContext)` وملاحظة تكرار التصيير دون تغير بياناته الخاصة.
- **مقترح الإصلاح**: تغليف كائن `value` بـ `useMemo` مع تحديد مصفوفة الاعتماديات بدقة كما هو مطبق بالفعل في `CartContext.js` [V].
- **الاختبار المقترح**: قياس عدد مرات تصيير المكونات التابعة باستخدام React Profiler.
- **الجهد**: S

#### MOB-008: غياب تحسينات النوافذ والتفريغ في قوائم `FlatList`
- **الخطورة**: MEDIUM
- **الدليل**: رصد 15 شاشة تستخدم `FlatList`، وتبيّن أن **صفر** شاشات تضبط الخصائص `initialNumToRender` أو `maxToRenderPerBatch` أو `windowSize` أو `removeClippedSubviews` [V]. علاوة على ذلك، 9 شاشات تعرّف `renderItem` كدالة سهمية مجهولة ومضمنة (Inline Arrow Function) تُعاد صياغتها مع كل تصيير [V].
- **الأثر**: احتفاظ الذاكرة بجميع العناصر السابقة أثناء التمرير في القوائم الطويلة (مثل كتالوج المنتجات وقائمة الطلبات)، مما يؤدي لارتفاع استهلاك RAM وانهيار التطبيق بخطأ نفاد الذاكرة (OOM Crash) على أجهزة أندرويد التي تمتلك 2 أو 3 جيجابايت RAM.
- **خطوات إعادة الإنتاج**: التمرير السريع عبر كتالوج يحتوي على عشرات المنتجات ومراقبة استهلاك الذاكرة في أندرويد ستوديو Profiler.
- **مقترح الإصلاح**: ضبط الخصائص القياسية (`removeClippedSubviews={true}`, `windowSize={5}`, `maxToRenderPerBatch={5}`) وتغليف `renderItem` عبر `useCallback`.
- **الاختبار المقترح**: اختبار أداء التمرير بقياس معدل الإطارات (FPS).
- **الجهد**: M

#### MOB-009: انعدام مراقبة اتصال الشبكة وغياب شاشات عدم الاتصال
- **الخطورة**: MEDIUM
- **الدليل**: فحص الشاشات أظهر أن 0% من الشاشات ترصد حالة انقطاع الإنترنت أو تستهلك مكتبة مثل `@react-native-community/netinfo` [V].
- **الأثر**: عند انقطاع الإنترنت، يواجه المستخدم دوائر تحميل تدور بلا نهاية أو رسائل خطأ عامة وغير مفهومة من نوع "Network Error" عند محاولة تصفح الكتالوج أو إجراء الطلب.
- **خطوات إعادة الإنتاج**: وضع الهاتف في وضع الطيران ومحاولة التنقل بين الشاشات.
- **مقترح الإصلاح**: دمج مستشعر حالة الشبكة وعرض شريط تنبيهي أو شاشة حالة عدم اتصال مع زر "إعادة المحاولة" (Retry).
- **الاختبار المقترح**: اختبار سلوك الشاشات عند فصل محول الشبكة.
- **الجهد**: M

#### MOB-010: تسريب تفاصيل مكدس الأخطاء في الإنتاج عبر `ErrorBoundary`
- **الخطورة**: LOW
- **الدليل**: في `mobile/src/components/ErrorBoundary.js:43-49` يتم عرض النص البرمجي لمكدس المكونات `componentStack` و `error.toString()` مباشرة داخل واجهة المستخدم [V]:
```javascript
{this.state.errorInfo?.componentStack && (
  <>
    <Text style={[styles.errorLabel, { marginTop: 12 }]}>Stack Trace:</Text>
    <Text style={styles.stackText}>
      {this.state.errorInfo.componentStack}
    </Text>
  </>
)}
```
- **الأثر**: كشف مسارات الملفات الداخلية وهيكل المكونات البرمجية للمستخدم العادي في حال حدوث خطأ غير متوقع بالنسخة الإنتاجية، وهو ما يعد تسريباً لمعلومات التطبيق الداخلية.
- **خطوات إعادة الإنتاج**: إطلاق استثناء متعمد داخل أي شاشة في بيئة الإنتاج ورؤية مسار الكود يظهر على الشاشة.
- **مقترح الإصلاح**: تقييد عرض تفاصيل الخطأ ببيئة التطوير فقط `__DEV__`، وعرض رسالة اعتذار عامة مع رمز مرجعي للخطأ في بيئة الإنتاج.
- **الاختبار المقترح**: التحقق من عدم ظهور عنصر `Stack Trace` عندما تكون `__DEV__ === false`.
- **الجهد**: S

#### MOB-011: غياب إعدادات التحديثات الهوائية (OTA)
- **الخطورة**: LOW
- **الدليل**: الحزمة `expo-updates` مثبتة في `package.json:25` بالإصدار `~58.0.18` [V]، ولكن عند فحص `app.config.js` تبيّن غياب الحقلين الإلزاميين `updates.url` و `runtimeVersion` [V].
- **الأثر**: تعذر استلام أي تحديثات فورية للمستخدمين عبر خدمة EAS Update في حال الرغبة في نشر إصلاحات طارئة للأخطاء دون المرور بمراجعة المتاجر.
- **خطوات إعادة الإنتاج**: محاولة تشغيل أمر نشر تحديث `eas update`؛ سيفشل لغياب معرف التحديثات في ملف التهيئة.
- **مقترح الإصلاح**: إضافة رابط مشروع EAS للتحديثات وضبط `runtimeVersion: { policy: 'appVersion' }` داخل `app.config.js`.
- **الاختبار المقترح**: التحقق من صحة المخطط التكويني للتحديثات عبر `npx expo config`.
- **الجهد**: S

#### MOB-012: عدم تعطيل النسخ الاحتياطي التلقائي لأندرويد
- **الخطورة**: MEDIUM
- **الدليل**: ملف `app.config.js` لا يحدد سمة `android:allowBackup="false"` في المانيفست، كما أن المكون الإضافي المخصص `withCleartextTraffic` لا يمس هذه السمة [V].
- **الأثر**: بموجب سلوك نظام أندرويد الافتراضي، يتم تفعيل `android:allowBackup="true"` تلقائياً، مما يسمح بسحب بيانات التطبيق الخاصة وقواعد `AsyncStorage` عبر أوامر ADB الاحتياطية على الأجهزة المتصلة.
- **خطوات إعادة الإنتاج**: فحص ملف المانيفست المولد والتحقق من غياب `android:allowBackup="false"`.
- **مقترح الإصلاح**: إنشاء Config Plugin أو تحديث `app.config.js` لتعطيل النسخ الاحتياطي للأجهزة غير الموثوقة.
- **الاختبار المقترح**: فحص مانيفست أندرويد للتأكد من قيمة `allowBackup`.
- **الجهد**: S

#### MOB-013: حقل إدخال رمز Google ID Token يدوياً بالملف الشخصي
- **الخطورة**: LOW
- **الدليل**: في `mobile/src/screens/common/ProfileScreen.js:164-178` و السطر 1230، يوجد نموذج يطلب من المستخدم إدخال أو لصق رمز "Google ID Token" كنص عادي لربط الحساب [V].
- **الأثر**: خاصية مستحيلة الاستخدام للمستخدم العادي (حيث لا يمكن لأي مستخدم عادي استخراج رمز ID Token من حسابه بجوجل ولصقه في مربع نص)، مما يمثل تجربة مستخدم غير مكتملة وبقايا كود تجريبي.
- **خطوات إعادة الإنتاج**: فتح الملف الشخصي بمستخدم عادي ورؤية بطاقة ربط حساب Google التي تطلب إدخال الرمز كنص.
- **مقترح الإصلاح**: استبدال حقل الإدخال النصي بزر تفاعلي يستدعي تدفق `useGoogleAuth` لربط الحساب عبر النافذة المنبثقة الرسمية لجوجل.
- **الاختبار المقترح**: اختبار تفاعلي لزر ربط حساب Google.
- **الجهد**: S

#### MOB-014: عدم تطابق إصدارات الحزم مع Expo SDK 58 ووجود ثغرات
- **الخطورة**: LOW
- **الدليل**: تقرير `npx expo-doctor` أظهر 10 حزم تعاني من تباين في أرقام الترقيع (Patch mismatches)، واختلافاً رئيسياً في `eslint-config-expo` (المتوقع `~58.0.4` والفعلي `57.0.2`) [V]. علاوة على ذلك، أظهر تنفيذ `npm audit --omit=dev` وجود 16 ثغرة أمنية تابعة (1 منخفضة، 11 متوسطة، 4 عالية تشمل `node-forge` و `zod`) [V].
- **الأثر**: احتمالية مواجهة سلوك غير متوقع أثناء تجميع الحزم الأصلية، ووجود ثغرات استهلاك ذاكرة في الحزم التابعة.
- **خطوات إعادة الإنتاج**: تشغيل `npm audit --omit=dev` داخل مجلد `mobile`.
- **مقترح الإصلاح**: تحديث الحزم التابعة لتطابق أحدث إصدارات SDK 58 الرسمية وتشغيل `npm audit fix`.
- **الاختبار المقترح**: تشغيل `npx expo install --check` و `npm audit`.
- **الجهد**: M

#### MOB-015: نصوص ثابتة تتجاوز ملفات التعريب
- **الخطورة**: LOW
- **الدليل**: رصدت أداة الفحص `scripts/audit2/audit_ux_a11y_rtl.js` نصوصاً عربية وإنجليزية مكتوبة حرفياً داخل JSX دون استدعاء دالة الترجمة `t()` [V]:
  - `ErrorBoundary.js:32`: `"حدث خطأ أثناء تشغيل التطبيق"` [V].
  - `ErrorBoundary.js:39`: `"تفاصيل الخطأ:"` [V].
  - `ErrorBoundary.js:54`: `"إعادة المحاولة"` [V].
  - `BrandLogo.js:91-95`: `"مصر"` و `"Shop"` [V].
  - `UnlockScreen.js:77-78`: `"سوق مصر"` و `"Marketplace"` [V].
- **الأثر**: عدم تغير هذه النصوص عند قيام المستخدم بتبديل لغة التطبيق إلى الإنجليزية في الشاشات المذكورة.
- **خطوات إعادة الإنتاج**: تبديل لغة التطبيق إلى الإنجليزية ورؤية نصوص الخطأ أو اللوجو تظهر بالعربية.
- **مقترح الإصلاح**: نقل كافة النصوص الحرفية إلى ملفي `ar.json` و `en.json` واستدعاؤها عبر `t()`.
- **الاختبار المقترح**: تشغيل أداة `check-i18n.js` الموسعة بعد إضافة فحص النصوص الحرفية.
- **الجهد**: S

---

## 4. مصفوفة الأمان الشاملة (Security Matrix)

| المحور الأمني | التحليل والواقع الفعلي بالكود | التقييم والمخاطر |
| :--- | :--- | :--- |
| **تخزين التوكنات (Token Storage)** | يتم حفظ Access Token ومفتاح التحديث في `expo-secure-store` عبر دوال `setToken` و `setRefreshToken` في `utils/storage.js` [V]. | آمن ومطابق للممارسات السليمة |
| **تجديد التوكن أحادي الطيران (Single-Flight)** | دالة `performSingleFlightRefresh` في `api/client.js:50-99` تمنع تعدد طلبات التجديد عند حدوث 401 متزامن بحفظ الوعد في `refreshPromise` وتحديث التوكن قبل فك الحظر [V]. | سليم ومحكم ومعتمد باختبار وحدة [V] |
| **مسح البيانات عند الخروج (Wipe on Logout)** | دالة `logout` في `AuthContext.js:463-488` تقوم بمسح رمز الإشعار من الخادم، ومسح Access Token و Refresh Token و LastUserId محلياً [V]. | مكتمل وشامل [V] |
| **حقيقة القفل البيومتري (Biometrics Reality)** | القفل شاشة واجهة مستخدم فقط (`UnlockScreen.js`). المفتاح في SecureStore لا يشترط المصادقة العتادية (`requireAuthentication: false`) [V]. | خطر متوسط، لا يحمي التوكن عند إضافة بصمة جديدة للجهاز |
| **مسارات التجاوز (Bypass Paths)** | لا يوجد مسار لتجاوز قفل الشاشة لأن `AppContent` في `App.js` لا تصيّر `AppNavigator` نهائياً طالما أن `isLocked === true` [V]. كما لا توجد مستمعات إشعارات خارجية تفتح شاشات داخلية أثناء القفل [V]. | لا يوجد تجاوز عبر الروابط أو الإشعارات |
| **تسجيل البيانات في السجلات (Console Logging)** | لا يتم طباعة أي توكنات أو كلمات مرور إطلاقاً [V]. السجلات في `client.js:106` تسجل الطريقة والمسار فقط تحت حماية `__DEV__` [V]. ولكن تم رصد استدعاءات `console.error` و `console.warn` غير محمية في بعض الشاشات [V]. | متوسط، تسريب مسارات وليس بيانات شخصية |
| **الروابط العميقة (Deep Links)** | المعرف `marketplacemobile` مسجل في `app.config.js`، ولكن حاوية الملاحة `NavigationContainer` لا تحتوي على أي إعدادات `linking` [V]. | لا يوجد دعم فعلي للروابط العميقة |
| **الاتصال غير المشفر (Cleartext HTTP)** | المكون `withCleartextTraffic.js` مبرمج ليعمل فقط عند تفعيل `process.env.ALLOW_CLEARTEXT === '1'`، وفي الإنتاج يتم الاعتماد التلقائي على `https://api.marketplace.eg/api` [V]. | مضبوط وآمن إنتاجياً [V] |
| **شاشات تعديل عنوان الخادم (API URL Override)** | لا توجد أي شاشة أو واجهة مخفية تتيح للمستخدم أو المهاجم تعديل عنوان الخادم الأساسي (Base URL) [V]. | غير موجودة (Zero Risk) |
| **أسرار مدمجة في الحزمة (Secrets in Bundle)** | الفحص الشامل لحزمة التصدير والكود المصدري لم يظهر أي مفاتيح خاصة أو أسرار واجهة خلفية مسربة [V]. | نظيف تماماً |

---

## 5. تقرير الأداء وقياسات الحزم الفعلية (Performance Notes)

تم قياس حجم الحزم البرمجية بدقة عبر تصدير حزمة مؤقتة باستخدام الأمر الموثق `node scripts/audit2/measure_bundle.js` الذي نفّذ `npx expo export --output-dir temp_audit_bundle --dump-sourcemap` ثم قام بحساب الأحجام وضغطها وحذف المجلد بالكامل [V]:

### 5.1 القياسات الرقمية المباشرة (Measured Bundle Numbers)
- **إجمالي حجم مجلد التصدير بالكامل**: **24,806.81 كيلوبايت (~24.2 ميجابايت)** [V].
- **حجم كود JavaScript المترجم لمحرك Hermes (Android HBC)**:
  - غير مضغوط: **3,179.89 كيلوبايت (~3.11 ميجابايت)** (1229 وحدة نمطية - Modules) [V].
  - مضغوط (Gzip): **1,501.41 كيلوبايت (~1.47 ميجابايت)** [V].
- **حجم كود JavaScript المترجم لمحرك Hermes (iOS HBC)**:
  - غير مضغوط: **3,179.52 كيلوبايت (~3.11 ميجابايت)** (1236 وحدة نمطية - Modules) [V].
  - مضغوط (Gzip): **1,501.73 كيلوبايت (~1.47 ميجابايت)** [V].
- **حجم خريطة المصدر (Sourcemap)**: **7,226.80 كيلوبايت** لأندرويد و **7,224.57 كيلوبايت** لـ iOS [V].

### 5.2 تحليل الأصول الأثقل وزناً (Heaviest Dependencies & Assets)
- تم رصد **19 عائلة خطوط أيقونات** مدمجة في الحزمة المصدرة بإجمالي يزيد عن **4.2 ميجابايت من الخطوط**:
  - `MaterialCommunityIcons.ttf`: **1,277.01 كيلوبايت (1.25 ميجابايت)** [V].
  - `FontAwesome6_Solid.ttf`: **413.75 كيلوبايت** [V].
  - `Ionicons.ttf`: **380.59 كيلوبايت** [V].
  - `MaterialIcons.ttf`: **348.48 كيلوبايت** [V].
  - `Fontisto.ttf`: **306.18 كيلوبايت** [V].
- التقييم: دمج 19 عائلة خطوط يثقل وقت بدء تشغيل التطبيق (Cold Start Time) واستهلاك الذاكرة على الأجهزة الاقتصادية، ويوصى بدمج الأيقونات المستخدمة فقط أو الاعتماد على عائلتين على الأكثر.

---

## 6. تقرير إمكانية الوصول ودعم اللغة العربية (A11y & RTL)

### 6.1 دعم العربية واتجاه RTL
- التدويل مبني على `i18next` واللغة الافتراضية هي العربية مع توفير الإنجليزية كبديل كامل [V].
- فحص الاتجاهات أظهر استخداماً جيداً لـ `I18nManager.isRTL` في معظم التنسيقات المخصصة [V].
- ومع ذلك، تم رصد تنسيقات صلبة للاتجاهات مثل `marginRight: 10` و `marginLeft: 8` و `left: 20` في بعض الشاشات (مثل `LoginScreen.js` و `RegisterScreen.js`) بدلاً من الخصائص المنطقية الآمنة لـ RTL مثل `marginEnd` و `marginStart` [V].
- تم رصد أيقونات سهمية موجهة (`Ionicons name="arrow-forward"`) في أزرار تسجيل الدخول دون قلبها في وضع RTL، مما يعكس اتجاه السهم عكس الاتجاه الطبيعي لقراءة النص العربي [V].

### 6.2 قياسات التباين اللوني (Color Contrast Audit)
تم حساب نسب التباين وفق معادلات WCAG 2.1 Luminance المعتمدة عبر السكربت `scripts/audit2/audit_ux_a11y_rtl.js` [V]:

| عنصر الواجهة (UI Pair) | لون النص | لون الخلفية | نسبة التباين المحسوبة | مطابقة WCAG AA |
| :--- | :--- | :--- | :--- | :--- |
| `textPrimary` على `screenBg` | `#1F2329` | `#FAF8F5` | **14.89:1** [V] | **PASS** (مطابق للمعايير) |
| `textPrimary` على `cardBg` | `#1F2329` | `#FFFFFF` | **15.78:1** [V] | **PASS** (مطابق للمعايير) |
| `textSecondary` على `screenBg` | `#595F69` | `#FAF8F5` | **6.07:1** [V] | **PASS** (مطابق) |
| `textSecondary` على `cardBg` | `#595F69` | `#FFFFFF` | **6.43:1** [V] | **PASS** (مطابق) |
| `white` على `primary` (أحمر) | `#FFFFFF` | `#C8102E` | **5.88:1** [V] | **PASS** (مطابق) |
| `tabBarInactive` على `cardBg` | `#475569` | `#FFFFFF` | **7.58:1** [V] | **PASS** (مطابق) |
| `danger` على `dangerSoft` | `#C8102E` | `#FDF2F4` | **5.37:1** [V] | **PASS** (مطابق) |
| `white` على `accent` (ذهبي) | `#FFFFFF` | `#D6A33A` | **2.29:1** [V] | **FAIL** (غير مطابق) |
| `accent` (ذهبي) على `screenBg` | `#D6A33A` | `#FAF8F5` | **2.16:1** [V] | **FAIL** (غير مطابق) |
| `accent` (ذهبي) على `cardBg` | `#D6A33A` | `#FFFFFF` | **2.29:1** [V] | **FAIL** (غير مطابق) |
| `oldPrice` على `screenBg` | `#8C929B` | `#FAF8F5` | **2.96:1** [V] | **FAIL** (غير مطابق) |

### 6.3 أحجام أهداف اللمس (Touch Target Sizes)
- أظهر الفحص أن الغالبية العظمى من الأزرار الرئيسية وحقول الإدخال تحقق الحد الأدنى لارتفاع الهدف التفاعلي (44 بكسل أو أكثر) مدعومة بخصائص `hitSlop` [V].
- تم رصد بعض الأهداف الصغيرة غير المعزولة مثل أيقونات الخدمات في `ProfileScreen.js` بأبعاد 36×36 بكسل [V].

---

## 7. مصفوفة حالات الشاشات (Screen-State Matrix)

تم فحص حالات الشاشات الـ 29 برمجياً عبر السكربت `scripts/audit2/audit_ux_a11y_rtl.js` للتحقق من دعم حالات (التحميل، البيانات الفارغة، معالجة الخطأ، انقطاع الشبكة، ومنع الوصول 403) [V]:

| اسم الشاشة (Screen) | حالة التحميل (Loading) | الحالة الفارغة (Empty) | معالجة الخطأ (Error) | وضع عدم الاتصال (Offline) | غير مصرح (Forbidden/403) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `admin/AdminCategoriesScreen` | نعم [V] | نعم [V] | نعم [V] | لا [V] | لا [V] |
| `admin/AdminPayoutsScreen` | نعم [V] | نعم [V] | نعم [V] | لا [V] | لا [V] |
| `admin/AdminReviewsScreen` | نعم [V] | نعم [V] | نعم [V] | لا [V] | لا [V] |
| `admin/AdminStatsScreen` | نعم [V] | لا [V] | نعم [V] | لا [V] | لا [V] |
| `admin/AdminUsersScreen` | نعم [V] | نعم [V] | نعم [V] | لا [V] | لا [V] |
| `auth/ForgotPasswordScreen` | نعم [V] | لا [V] | نعم [V] | لا [V] | لا [V] |
| `auth/LoginScreen` | نعم [V] | لا [V] | نعم [V] | لا [V] | نعم (الحساب المعطل) [V] |
| `auth/RegisterScreen` | نعم [V] | لا [V] | نعم [V] | لا [V] | لا [V] |
| `auth/ResetPasswordScreen` | نعم [V] | لا [V] | نعم [V] | لا [V] | لا [V] |
| `auth/UnlockScreen` | نعم [V] | لا [V] | نعم [V] | لا [V] | لا [V] |
| `auth/VerifyScreen` | نعم [V] | لا [V] | نعم [V] | لا [V] | نعم [V] |
| `buyer/CartScreen` | نعم [V] | نعم [V] | نعم [V] | لا [V] | لا [V] |
| `buyer/CatalogScreen` | نعم [V] | نعم [V] | نعم [V] | لا [V] | لا [V] |
| `buyer/CategoriesScreen` | نعم [V] | لا [V] | نعم [V] | لا [V] | لا [V] |
| `buyer/CheckoutScreen` | نعم [V] | نعم [V] | نعم [V] | لا [V] | لا [V] |
| `buyer/MobileSearchScreen` | نعم [V] | نعم [V] | نعم [V] | لا [V] | لا [V] |
| `buyer/MyOrdersScreen` | نعم [V] | نعم [V] | نعم [V] | لا [V] | لا [V] |
| `buyer/ProductDetailsScreen` | نعم [V] | لا [V] | نعم [V] | لا [V] | لا [V] |
| `buyer/SellerStoreScreen` | نعم [V] | نعم [V] | نعم [V] | لا [V] | لا [V] |
| `buyer/WishlistScreen` | نعم [V] | نعم [V] | نعم [V] | لا [V] | لا [V] |
| `common/NotificationsScreen` | نعم [V] | نعم [V] | نعم [V] | لا [V] | نعم [V] |
| `common/ProfileScreen` | نعم [V] | نعم [V] | نعم [V] | لا [V] | لا [V] |
| `seller/AddEditProductScreen`| نعم [V] | نعم [V] | نعم [V] | لا [V] | لا [V] |
| `seller/DashboardScreen` | نعم [V] | نعم [V] | نعم [V] | لا [V] | لا [V] |
| `seller/MyProductsScreen` | نعم [V] | نعم [V] | نعم [V] | لا [V] | لا [V] |
| `seller/SellerCouponsScreen` | نعم [V] | نعم [V] | نعم [V] | لا [V] | لا [V] |
| `seller/SellerOrdersScreen` | نعم [V] | نعم [V] | نعم [V] | لا [V] | لا [V] |
| `seller/SellerWalletScreen` | نعم [V] | نعم [V] | نعم [V] | لا [V] | لا [V] |

---

## 8. استخدام واجهات الخلفية والتطابق مع العقود (API Usage & Mismatches)

تمت مطابقة 95 استدعاء لشبكة الهاتف في 17 ملف API مع 116 مسار في 20 وحدة تحكم بالواجهة الخلفية عبر السكربت المخصص `node scripts/audit2/map_backend_vs_mobile_routes.js` [V]:

### 8.1 نتيجة المطابقة
- **نسبة تطابق مسارات الروابط**: **مطابقة كاملة لـ 95 من أصل 95 استدعاء**، حيث ترتبط جميع نقاط الاتصال بوحدات التحكم المقابلة بالاسم والنوع [V].
- **رأس مفتاح عدم التكرار (Idempotency-Key)**: يتم حقن الرأس بنجاح في طلبات إنشاء الطلبات `POST /api/orders` عبر `idempotencyKeyRef` داخل `CheckoutScreen.js:335-362` لضمان عدم تكرار الخصم أو الطلب عند إعادة المحاولة [V].
- **بناء روابط الصور (File URL Building)**: الدالة `getImageUrl` في `src/utils/imageUrl.js` تقوم بقص `/api` من عنوان الخادم ودمج المسار النسبي بشكل سليم [V].

### 8.2 أوجه القصور وعدم التطابق المكتشفة في العقود
1. **تجاهل التحقق الثنائي (2FA Handling Gap)**: مسار `POST /api/auth/login` يرجع `RequiresTwoFactor: true` و `TwoFactorToken`، ولكن كود الهاتف لا يقرأهما نهائياً ويتوقع فقط `accessToken || token` [V].
2. **استجابات 429 لسياسات تقييد المعدل (Rate Limiting 429)**: الواجهة الخلفية تطبق `refresh-policy` على `/auth/refresh`، ولكن تطبيق الهاتف لا يقرأ ترويسة `Retry-After` ولا يطبق تأخيراً أسياً (Exponential Backoff) [V].
3. **غياب مصفوفة معالجة أخطاء 403**: عند حظر حساب مستخدم أو رفض الصلاحية، يُظهر التطبيق رسالة خطأ فقط دون إنهاء الجلسة أو توجيه المستخدم لصفحة الدعم الفني [V].

---

## 9. مطابقة سياسات المتاجر وحماية البيانات (Store Compliance & Data Safety)

### 9.1 جدول مطابقة بيانات متجر Google Play (Data Safety Mapping)

| نوع البيانات (Data Type) | يتم جمعها؟ (Collected) | يتم مشاركتها؟ (Shared) | الغرض من الجمع (Purpose) | اختيارية أم إجبارية؟ (Optional/Mandatory) |
| :--- | :---: | :---: | :--- | :--- |
| **الاسم (Name)** | نعم [V] | مع البائعين وشركات الشحن [V] | تنفيذ الطلبات والشحن [V] | إجبارية للمشتري والبائع |
| **البريد الإلكتروني (Email)** | نعم [V] | لا تُشارك [V] | المصادقة واسترجاع الحساب [V] | اختيارية للمشتري، إجبارية للإداري |
| **رقم الهاتف المحمول (Phone)**| نعم [V] | مع شركات الشحن والبائعين [V] | التوصيل والتحقق عبر OTP [V] | إجبارية للمشتري |
| **الموقع الجغرافي الدقيق (Precise Location)** | نعم [V] | مع مزود الخريطة لحساب الشحن [V] | تحديد نقطة التوصيل بدقة [V] | اختيارية (يمكن إدخال العنوان يدوياً) [V] |
| **الصور والملفات (Photos & Files)** | نعم [V] | لا تُشارك خارج المنصة [V] | صور المنتجات وصور إثبات الاسترجاع [V] | اختيارية |
| **معرف الجهاز (Device ID)** | نعم [V] | لا تُشارك [V] | إدارة الجلسات والأمان والتحكم بالتوكن [V] | إجبارية تشغيلياً |
| **بيانات المصادقة البيومترية** | لا تُجمع [V] | لا تُشارك [V] | تُعالج محلياً داخل عتاد الجهاز حصراً [V] | اختيارية تماماً للمستخدم |
| **بيانات الدفع المالي (Cards)** | لا تُجمع [V] | لا تُشارك [V] | الدفع عند الاستلام هو المفعل حصراً [V] | غير منطبقة حالياً |

### 9.2 فحص جاهزية المتجر (Store Readiness Checklist)
- [ ] **رابط سياسة الخصوصية (Privacy Policy URL)**: غير مضاف في `app.config.js` ومربع اختيار سياسة الخصوصية في التسجيل لا يحتوي على رابط تشعبي نشط للمعاينة [V].
- [ ] **منظومة التتبع وتسجيل الانهيارات (Crash Reporting & Analytics)**: غائبة تماماً؛ لا توجد مكتبة Sentry أو Crashlytics لمراقبة انهيارات الإنتاج [V].
- [x] **تعطيل ميزات الأموال الحقيقية الحساسة**: ميزة المحفظة والمدفوعات مقفلة وتعتمد على رد الواجهة الخلفية من `/config` [V].
- [x] **حذف الحساب المباشر (Account Deletion)**: متوفر في `ProfileScreen.js` عبر استدعاء `DELETE /api/users/me` متوافقاً مع متطلبات متجر Google Play و Apple App Store [V].
- [x] **تصدير البيانات الشخصية (Data Portability)**: متوفر في `ProfileScreen.js` تماشياً مع قانون حماية البيانات الشخصية المصري رقم 151 لسنة 2020 [V].

---

## 10. واقع الاختبارات وتصنيفها (Test Reality)

تم فحص وتشغيل جميع الاختبارات المتاحة في `mobile/tests/`، وتقييم مصداقيتها:

| ملف الاختبار (Test File) | التصنيف الحقيقي | عدد الحالات | ما يتحقق منه فعلياً | ما لا يتحقق منه (Gaps) |
| :--- | :---: | :---: | :--- | :--- |
| `test_auth_flows_mock.js` | **STATIC / MOCK** [V] | 5 | فحص نصوص `AppNavigator.js` واختبار دوال التنسيق والهاتف في Node.js [V] | لا ينفذ على جهاز، ولا يختبر واجهات المستخدم الحقيقية |
| `test_biometric_cold_start_and_use_password_mock.js` | **MOCK / UNIT** [V] | 3 | محاكاة دوال التخزين ومسار التشغيل البارد في بيئة Node.js [V] | لا يختبر عتاد البصمة الحقيقي بالجهاز |
| `test_biometric_lock_state_machine_mock.js` | **UNIT** [V] | 14 | آلة حالة منطقية نقية لحساب الفارق الزمني والتحول إلى LOCKED [V] | اختبار منطقي مجرد دون واجهة تفاعلية |
| `test_feature_gating_mock.js` | **MOCK / STATIC** [V] | 9 | محاكاة استجابة إعدادات `/config` والتأكد من إخفاء المكونات عبر قراءة النصوص [V] | لا يختبر التصيير الفعلي لشجرة المكونات |
| `test_mobile_smart_search.js` | **STATIC** [V] | 31 | قراءة محتويات الملفات والتأكد من وجود نصوص `AbortController` ومفاتيح التخزين [V] | فحص نصوص ملفات جامد (String Matching) |
| `test_single_flight_refresh_mock.js` | **MOCK / UNIT** [V] | 3 | محاكاة 5 طلبات متزامنة في Node.js للتأكد من استدعاء `/auth/refresh` مرة واحدة [V] | لا يختبر أخطاء الشبكة الفعلية ومسارات التوقف |

**خلاصة واقع الاختبارات**:
- جميع الاختبارات الـ 6 عبارة عن سكربتات Node.js مستقلة؛ لا يوجد إطار عمل Jest أو React Native Testing Library مهيأ في المشروع [V].
- صفر (0%) من الاختبارات يعمل على جهاز حقيقي أو محاكي، مما يعني أن سلوك الواجهة التفاعلي الفعلي غير مغطى باختبارات آلية واقعية [I].

---

## 11. قائمة التحقق للاختبار اليدوي على الأجهزة الحقيقية (Manual Device Test Checklist)

### 11.1 رحلة المشتري (Buyer Journey)
1. **التثبيت وبدء التشغيل (Cold Start)**:
   - [ ] فتح التطبيق لأول مرة؛ التأكد من ضبط اللغة الافتراضية على العربية والاتجاه RTL.
   - [ ] التأكد من ظهور شاشة تسجيل الدخول وعدم حدوث وميض شاشة بيضاء.
2. **إنشاء الحساب والمصادقة**:
   - [ ] تسجيل حساب جديد برقم هاتف مصري؛ فحص قبول الأرقام بالأرقام العربية والإنجليزية.
   - [ ] إدخال رمز التحقق في الشاشة؛ التأكد من الانتقال التلقائي بين خانات OTP الست.
   - [ ] الموافقة على تفعيل البصمة والتأكد من طلب النظام للمصادقة البيومترية.
3. **تصفح الكتالوج والبحث الذكي**:
   - [ ] تصفح كتالوج المنتجات والتمرير السريع؛ مراقبة سلاسة الحركة وعدم وجود تقطيع (Jank).
   - [ ] كتابة كلمة في حقل البحث؛ التأكد من عمل الإلغاء التلقائي (Debounce) ومقترحات الإكمال التلقائي.
   - [ ] فلترة المنتجات حسب التصنيف وملاحظة شارة عدد الفلاتر النشطة.
4. **السلة وإتمام الطلب (Checkout)**:
   - [ ] إضافة منتج للسلة وتعديل الكمية؛ التحقق من تحديث الشارة في شريط التبويب السفلي.
   - [ ] اختيار طريقة التوصيل (منزل / فرع بوسطة) وتحديد الموقع الجغرافي عبر خريطة Google.
   - [ ] الضغط على "تأكيد الطلب" مرتين متتاليتين بسرعة فائقة؛ التحقق من عدم تكرار إنشاء الطلب بفضل `Idempotency-Key`.
   - [ ] التأكد من إفراغ السلة بعد نجاح الطلب وظهوره في قائمة "طلباتي".

### 11.2 رحلة البائع (Seller Journey)
1. **لوحة التحكم والمؤشرات**:
   - [ ] تسجيل الدخول بحساب بائع؛ التأكد من ظهور شريط التبويب الخاص بالبائع (`SellerTabs`).
   - [ ] التحقق من أرقام المبيعات ومؤشر المنتجات قاربت على النفاد.
2. **إدارة المنتجات والمخزون**:
   - [ ] إضافة منتج جديد؛ رفع صورة من الكاميرا وصورة من المعرض والتأكد من ضغطها بنجاح.
   - [ ] تعديل المخزون السريع (Quick Stock) من القائمة وملاحظة التحديث الفوري.
3. **إدارة طلبات البائع والشحنات**:
   - [ ] تصفح طلبات البائع؛ التأكد من إخفاء بيانات المشتري الحساسة وظهور الاسم الأول والمدينة فقط التزاماً بقانون حماية البيانات الشخصية.
   - [ ] تحديث حالة شحنة وملاحظة تغير لون شارة الحالة (`OrderStatusBadge`).

### 11.3 رحلة المدير (Admin Journey)
1. **لوحة المؤشرات والرقابة**:
   - [ ] تسجيل الدخول بحساب مسؤول؛ التأكد من تحميل شاشات تبويب الإدارة (`AdminTabs`).
   - [ ] فحص إحصائيات المبيعات الإجمالية وحجم العمولة.
2. **إدارة المستخدمين والمراجعات**:
   - [ ] تصفح قائمة المستخدمين وتغيير حالة مستخدم (نشط / معلق)؛ التأكد من انعكاس الحالة.
   - [ ] تصفح المراجعات المبلغ عنها وإخفاء مراجعة مسيئة.

---

## 12. خطة الإصلاحات المرتبة حسب الأولوية (Ordered Fix Plan)

### المرحلة الأولى: الإصلاحات الفورية الحرجة (P0 - Immediate)
1. **حذف `app.json` الزائد**: توحيد تهيئة التطبيق داخل `app.config.js` لتفادي تضارب معرف الحزمة `com.egyptianmarketplace.app` وأخطاء التحقق [S].
2. **ضبط مهلة Axios**: إضافة `timeout: 15000` في `mobile/src/api/client.js` لحماية التطبيق من التعليق الأبدي عند انقطاع الشبكة [S].
3. **تصحيح تباين الألوان الذهبية**: تعديل نص الأزرار الذهبية إلى الداكن `#1F2329` أو تعميق درجة اللون الذهبي لتحقيق 4.5:1 [S].
4. **تأمين `ErrorBoundary`**: حجب ظهور مسار `componentStack` بالإنتاج وتقييده بـ `__DEV__` [S].

### المرحلة الثانية: جاهزية المتجر وتجربة المستخدم (P1 - High)
5. **إضافة تسميات إمكانية الوصول (A11y Labels)**: تزويد جميع عناصر `TouchableOpacity` بـ `accessibilityLabel` و `accessibilityRole` ملائمين [M].
6. **دعم التحقق بخطوتين (2FA)**: ربط استجابة `RequiresTwoFactor` بشاشة إدخال رمز التحقق الثنائي [M].
7. **تغليف السياقات بـ `useMemo`**: منع عواصف إعادة التصيير في `AuthContext` و `WishlistContext` [S].
8. **تعطيل النسخ الاحتياطي بأندرويد**: إضافة `android:allowBackup="false"` في إعدادات المانيفست [S].

### المرحلة الثالثة: تحسين الأداء والمتانة (P2 - Medium)
9. **تحسين قوائم `FlatList`**: تفعيل `removeClippedSubviews` وضبط `windowSize={5}` وتحويل الدوال المضمنة في `renderItem` إلى `useCallback` [M].
10. **مراقبة اتصال الشبكة (Offline Banner)**: دمج `@react-native-community/netinfo` لعرض تنبيه عند انقطاع الإنترنت [M].
11. **تنظيف الخطوط الزائدة**: حصر أيقونات التطبيق واستبعاد عائلات الخطوط غير المستخدمة لتقليص حجم الحزمة بأكثر من 3 ميجابايت [M].
12. **إعدادات التحديثات الهوائية (EAS Update)**: تكوين `updates.url` و `runtimeVersion` في `app.config.js` [S].

---

## 13. الفحص الذاتي وتصحيح الادعاءات (Self-Check & Verification)

تم تنفيذ فحص ذاتي عشوائي لاختيار 10 ادعاءات وردت في تقرير التدقيق وإعادة التحقق منها باستخدام السكربت المخصص `scripts/audit2/self_check_random_claims.js` بالبذرة العشوائية الثابتة **`SEED = 20261101`** [V]:

| رقم الادعاء | الادعاء المفحوص | نتيجة الفحص الآلي | التعليق والتصحيح |
| :---: | :--- | :---: | :--- |
| **1** | `package.json` يحدد expo عند `^58.0.0` و react-native عند `0.88.0` | **VERIFIED [V]** | مطابق تماماً للكود المصدري |
| **2** | وجود الملفين `app.json` و `app.config.js` معاً في جذر مجلد `mobile` | **VERIFIED [V]** | كلاهما موجود فعلياً |
| **3** | إجمالي مفاتيح التعريب في ملفات اللغات يبلغ 1063 مفتاحاً | **VERIFIED [V]** | **تصحيح مهم**: التقارير السابقة ادعت 1051 مفتاحاً، ولكن الفحص الفعلي للنسخة الحالية أثبت وجود **1063 مفتاحاً** في كل من `ar.json` و `en.json` بعد إضافة مفاتيح البحث وجوجل. |
| **4** | وجود 15 شاشة تستخدم FlatList وجميعها لا تضبط `initialNumToRender` أو `windowSize` | **VERIFIED [V]** | تم التحقق من الـ 15 شاشة برمجياً |
| **5** | اسم الحزمة في `app.config.js` هو `com.egyptianmarketplace.app` بينما في `app.json` هو `com.marketplace.app` | **VERIFIED [V]** | تضارب مؤكد ومثبت |
| **6** | المكون الإضافي `withCleartextTraffic` يضبط سمة `android:usesCleartextTraffic` إلى `true` | **VERIFIED [V]** | مثبت في `plugins/withCleartextTraffic.js:10` |
| **7** | عميل `client.js` لا يحدد خاصية `timeout` في إعدادات `axios.create` | **VERIFIED [V]** | مثبت في `src/api/client.js:39-44` |
| **8** | مفتاح رمز التحديث في التخزين الآمن يحمل النمط `refresh_token_${userId}` دون اشتراط المصادقة العتادية | **VERIFIED [V]** | مثبت في `src/utils/storage.js:67,72` |
| **9** | حاوية الملاحة `NavigationContainer` في `AppNavigator.js` لا تحدد خاصية `linking` | **VERIFIED [V]** | مثبت في `src/navigation/AppNavigator.js:57` |
| **10** | دالة `createOrder` في `ordersApi.js` تحقن رأس `Idempotency-Key` عند تمريره | **VERIFIED [V]** | مثبت في `src/api/ordersApi.js:8` |

**النتيجة الإجمالية للفحص الذاتي**: **10 من أصل 10 ادعاءات تم التحقق منها بنجاح بواقع 10 من 10 [V]** مع تصحيح رقم مفاتيح التعريب.

---

## 14. ما لم يتم فحصه (What I did NOT inspect)
التزاماً بالشفافية والمصداقية المهنية، ندرج هنا ما تعذر فحصه في هذا التدقيق:
1. **التشغيل الفيزيائي على أجهزة حقيقية أو محاكيات (Native Device Runtime)**: لم يتم تثبيت أو تشغيل التطبيق على أجهزة فعلية (Android/iOS) نظراً للقيود الصارمة (قراءة فقط وبدون تشغيل خوادم تطوير أو خوادم خلفية).
2. **اتصال الإشعارات الفعلية (FCM / APNs Live Delivery)**: لم يتم اختبار استلام إشعارات Push حقيقية من خوادم Apple أو Google لغياب مفاتيح الاعتماد السحابية.
3. **تدفق الدفع الفعلي والبطاقات البنكية**: بوابة الدفع المالي الحقيقي معطلة وفق سياسة الحوكمة المالية، ولم يتم اختبار أي بوابات خارجية (مثل Paymob أو Fawry).
4. **تأثيرات تحديث نظام التشغيل على مستوى المفاتيح (OS Keystore Invalidation)**: لم يتم اختبار سلوك Android Keystore عند حذف وتغيير البصمات في بيئة تشغيل فعلية.
5. **اختبارات الحمل وتفريغ الذاكرة الديناميكي (Dynamic Memory Profiling under Heavy Stress)**: تم الاكتفاء بالتحليل الكودي الساكن وقياس حجم الحزم المجمعة عبر تصدير الحزمة المؤقتة.
