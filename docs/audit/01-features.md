# المرحلة الأولى: الحقيقة البرمجية وسجل الميزات الفعلي (المعدلة)

> وثيقة تدقيق برمجية مستقلة قائمة على الأدلة المادية المباشرة من الشيفرة المصدرية.  
> تاريخ التدقيق: 2026-10-28  
> حالة الفحص: تم التدقيق والتصحيح الصارم لدرجات النضج وحصر النواقص  
> نظام الترميز: [V] تم التحقق منه مباشرة بقراءة ملف أو تشغيل أمر | [I] مستنتج برمجياً مع التعليل | [G] معرفة عامة بطبيعة السوق والتجارة الإلكترونية

---

## 1. خريطة المستودع ومصادر الشيفرة (Repository Map & Source Isolation)

### 1.1 المشاريع ومصادر الحقيقة
- **الواجهة الخلفية (Backend):** المسار الوحيد هو `backend/` [V: `backend/Marketplace.slnx`].
  - المشاريع الأربعة المستهدفة بإطار `net10.0`:
    - `backend/Marketplace.API` [V: `Marketplace.API.csproj:12`].
    - `backend/Marketplace.Application` [V: `Marketplace.Application.csproj:10`].
    - `backend/Marketplace.Domain` [V: `Marketplace.Domain.csproj:4`].
    - `backend/Marketplace.Infrastructure` [V: `Marketplace.Infrastructure.csproj:18`].
- **تطبيق الهواتف الذكية (Mobile):** المسار الوحيد هو `mobile/` [V: `mobile/package.json`].
- **بوابة الويب والمتجر (Admin Web):** المسار هو `admin-web/` وهو عبارة عن Directory Junction لنظام Windows يشير إلى المجلد الخارجي `D:\Backend\MarketplaceWeb` [V: أمر `Get-Item admin-web`].

### 1.2 حالة بوابة الويب في Git ومخاطر الاستنساخ النظيف (Fresh Clone Risk)
- نتيجة أمر فحص تتبع الملفات:
  ```text
  git ls-files admin-web | wc -l
  0
  ```
- حالة المدخل في git:
  ```text
  git status --porcelain admin-web
  ?? admin-web/
  ```
- فحص مسار الهدف `D:\Backend\MarketplaceWeb`:
  - المجلد لا يحتوي على دليل `.git` مستقل [V: `Test-Path D:\Backend\MarketplaceWeb\.git` أرجع False].
  - لا توجد أي ملفات من نوع `.jsx` متتبعة داخل مستودع git بالكامل [V: `git ls-files "*.jsx"` أرجع 0].
- **الأثر على استنساخ المشروع (Fresh Clone):**  
  أي عملية استنساخ جديدة للمستودع عبر `git clone` على جهاز خادم أو مطور آخر ستؤدي إلى **فقدان كامل وشامل لبوابة الويب (admin-web)**، بما في ذلك لوحة تحكم المدير، وشاشات المتجر للويب، وشاشات البائع للويب، واختبارات الأمان الخاصة بالويب، حيث أن هذه الشيفرات موجودة فقط على القرص الصلب المحلي كوصلة Junction غير متتبعة في أي مستودع git.

### 1.3 تدقيق ترقيات الحزم والاعتماديات (Dependencies Audit)
- **الوضع في سجل Git:**  
  آخر التزام مسجل في git برقم `7906e43db2ba7934ff85de5a38500f6ed8149cd3` بتاريخ 24 أكتوبر 2026 كان يحتوي على:
  - `expo`: `~57.0.27` [V: `git log -p -n 1 7906e43 mobile/package.json`]
  - `react-native`: `0.86.3` [V: المصدر نفسه]
  - `react`: `19.2.3` [V: المصدر نفسه]
  - `react-native-screens`: `~4.26.0` [V: المصدر نفسه]
  - `react-native-safe-area-context`: `~5.7.0` [V: المصدر نفسه]
- **الوضع الفعلي في مساحة العمل (Uncommitted Working Copy):**  
  توجد تعديلات غير ملتزم بها (Uncommitted diff) في `mobile/package.json`:
  - تمت ترقية `expo` إلى `^58.0.0` [V: `git diff mobile/package.json`]
  - تمت ترقية `react-native` إلى `0.88.0` [V: `git diff mobile/package.json`]
  - تمت ترقية `react` إلى `19.3.0` [V: `git diff mobile/package.json`]
  - تمت ترقية `react-native-screens` إلى `~4.30.0` [V: `git diff mobile/package.json`]
  - تمت ترقية `react-native-safe-area-context` إلى `~5.10.1` [V: `git diff mobile/package.json`]
  - إضافة حزم: `react-native-maps: 1.29.11`, `expo-location: ~58.0.19`, `expo-image-manipulator: ~58.0.15` [V: `git diff mobile/package.json`].
- **المسؤولية وطلب الترقية:**  
  هذه الترقية تمت في جلسات عمل مساعدة أثناء إضافة ميزات الخرائط والصور، و**لم تكن مطلوبة صراحة من المستخدم**. يشكل هذا انحرافاً في بيئة التشغيل قد يتعارض مع أدوات البناء الرسمية لـ EAS المعتمدة على SDK 57 ما لم يتم تثبيتها واختبارها.

### 1.4 فحص نقطة النهاية المجهولة `/api/health` وتسريب البيانات
- الكود المصدري في `backend/Marketplace.API/Program.cs:705-716` يعيد الكائن التالي لجميع الطلبات المجهولة دون مصادقة:
  ```json
  {
      "status": "Healthy",
      "database": "Connected",
      "version": "...",
      "commit": "...",
      "buildDate": "2026-10-28T..."
  }
  ```
- **الملاحظات والمخاطر:**
  - يتم استخراج `buildDate` مباشرة من تاريخ تعديل ملف الـ DLL على القرص [V: `Program.cs:697-699`].
  - يتم تسريب `version` و `commit` (رمز التزام Git عبر متغيرات البيئة `RAILWAY_GIT_COMMIT_SHA` أو `GIT_COMMIT_SHA`).
  - هذا التسريب يتيح لأي طرف خارجي فحص تاريخ البناء وإصدار النسخة لجمع معلومات استطلاعية (Information Disclosure / Reconnaissance).
  - لا يتم تسريب حجم استهلاك الذاكرة أو تفاصيل معالج Garbage Collection في الرد الحالي.

---

## 2. نصوص التعدادات وقواعد الدفع عند الاستلام من الشيفرة مباشرة (Verbatim Enums & COD Logic)

### 2.1 تعداد حالات الشحنة (ShipmentStatus Enum)
نص الملف حرفياً من `backend/Marketplace.Domain/Enums/ShipmentStatus.cs:3-12`:
```csharp
public enum ShipmentStatus
{
    Created,
    HandedToCarrier,
    InTransit,
    ReadyForPickup,
    Delivered,
    Cancelled,
    Returned
}
```

### 2.2 تعداد أسباب الإرجاع (ReturnReason Enum)
نص الملف حرفياً من `backend/Marketplace.Domain/Enums/ReturnReason.cs:3-10`:
```csharp
public enum ReturnReason
{
    RefusedByBuyer,
    Unreachable,
    WrongAddress,
    DamagedInTransit,
    Other
}
```

### 2.3 تعداد حالات الطلب (OrderStatus Enum)
نص الملف حرفياً من `backend/Marketplace.Domain/Enums/OrderStatus.cs:3-9`:
```csharp
public enum OrderStatus
{
    Pending,
    Shipped,
    Delivered,
    Cancelled
}
```

### 2.4 تدقيق قاعدة صلاحية التاجر على الشحنات (Seller HandedToCarrier Rule)
نص الشيفرة الحرفي من `backend/Marketplace.Application/Services/ShipmentService.cs:262-267`:
```csharp
// Rule: Sellers may ONLY set HandedToCarrier on their own shipments.
// Trying to set Returned, Delivered, or other carrier statuses throws 403 Forbidden.
if (!string.Equals(targetStatusString, nameof(ShipmentStatus.HandedToCarrier), StringComparison.OrdinalIgnoreCase))
{
    throw new ForbiddenException("Sellers may only set 'HandedToCarrier' on their own shipments. Status updates such as 'Returned' or 'Delivered' must come from the carrier.");
}
```
- **المطابقة مع القاعدة:** **نعم، الشيفرة الحالية تطبق القاعدة بصرامة تامة.** التاجر لا يمكنه نقل الشحنة إلا إلى `HandedToCarrier`، ومحاولة تعيين أي حالة أخرى تقابل بالرفض `403 Forbidden`.

### 2.5 تدقيق عداد رفض الدفع عند الاستلام (COD Refusal Counter)
- **فحص الشيفرة:** تم البحث في كامل ملفات المشروع عن أي زيادة لعداد رفض الدفع عند الاستلام أو أي حقول باسم `FailedCodCount` أو `IsCodBlocked`.
- **النتيجة:**
  - كيان المستخدم `backend/Marketplace.Domain/Entities/User.cs` **لا يحتوي على أي حقل لعد مرات الرفض أو حظر الدفع عند الاستلام** [V: `User.cs:1-37`].
  - ملف `backend/Marketplace.Application/Services/ShipmentService.cs:303-375` عند تحويل الشحنة إلى `Returned` (وسبب `ReturnReason.RefusedByBuyer`) يقوم بإرجاع المخزون وتحديث حالة الطلب وإرسال إشعار، و**لا يقوم بزيادة أي عداد للمشتري ولا يتحقق من تجاوز حد الرفض**.
  - مفتاح الإعداد `Orders:MaxCodRefusals` موجود فقط كقيمة معزولة في `appsettings.json:66` ولا يتم قراءته في أي ملف سي شارب على الإطلاق.
  - **الخلاصة:** آلية حظر المشتري بعد 3 مرات رفض **غير مبنية نهائياً في الشيفرة (NOT BUILT)**.

---

## 3. سجل الميزات المصحح وفق المعايير الصارمة (Corrected Feature Catalog)

> **قواعد احتساب النضج (Maturity Rubric):**  
> - `0` = ميزة غائبة تماماً أو غير مبنية (NOT FOUND / Planned-not-built).  
> - `1` = ميزة جزئية، أو محجوبة بعلم ميزة (Flag-off)، أو أن اختباراتها تقتصر فقط على المحاكاة (MOCK)، أو الذاكرة (InMemory)، أو الفحص النصي الساكن، أو بدون اختبارات.  
> - `2` = ميزة تعمل على المسار الطبيعي ومدعومة باختبارات حقيقية على PostgreSQL عبر `TEST_DB`.  
> - `3` = ميزة مكتملة بمعايير الإنتاج: تم التحقق منها باختبارات PostgreSQL لسلوك العمليات، وفصل الصلاحيات (Authorization)، وسلامة التزامن ومنع التعارض (Concurrency-Safe).

### 3.1 جدول الميزات المحصورة (65 ميزة مدققة)

| المعرف | المجال (Area) | الميزة البرمجية (Feature) | الحالة (Status) | المسارات الخلفية (Backend Routes) | شاشات الموبايل (Mobile) | صفحات الويب (Web) | جداول قاعدة البيانات | مزود الاختبار (Test Provider) | النضج (0-3) | دليل التحقق والأساس المنطقي للنضج |
|:---|:---|:---|:---:|:---|:---|:---|:---|:---:|:---:|:---|
| **F-001** | الهوية | تسجيل مستخدم جديد بالبريد | Complete | `POST /api/auth/register` [V] | `RegisterScreen.js` | `RegisterPage.jsx` | `Users`, `VerificationCodes` | POSTGRES | 2 | مختبر على PostgreSQL (`test_auth_completion.js`)، لم تُختبر سباقات التزامن العالي. |
| **F-002** | الهوية | تسجيل الدخول بالبريد أو الهاتف | Complete | `POST /api/auth/login` [V] | `LoginScreen.js` | `LoginPage.jsx` | `Users`, `RefreshTokens` | POSTGRES | 2 | مسار طبيعي مدقق على PostgreSQL مع فحص كلمة المرور المشفرة. |
| **F-003** | الهوية | محرك التحقق ورموز OTP | Complete | `POST /api/auth/verify`, `/resend` [V] | `VerifyScreen.js` | `VerifyPage.jsx` | `VerificationCodes` | POSTGRES | 2 | تم التحقق من قفل الكود بعد 5 محاولات على PostgreSQL. |
| **F-004** | الهوية | تسجيل الدخول برقم الهاتف | Complete | `POST /api/auth/register`, `/verify` [V] | `RegisterScreen.js` | `RegisterPage.jsx` | `Users`, `VerificationCodes` | POSTGRES | 2 | تم التحقق على PostgreSQL مع مزود SMS وهمي في بيئة التطوير. |
| **F-005** | الهوية | تسجيل الدخول وربط Google | Flag-off | `POST /api/auth/google`, `/link` [V] | `LoginScreen.js`, `ProfileScreen.js` | `LoginPage.jsx`, `ProfilePage.jsx` | `Users`, `ExternalLogins` | POSTGRES | 2 | تم التحقق من الربط ورفض الرموز الوهمية على PostgreSQL (`test_batch4_partA_postgres.js`). |
| **F-006** | الهوية | رموز التحديث وإدارة الجلسات | Complete | `POST /api/auth/refresh`, `/logout`, `/logout-all` [V] | `AuthContext.js` | `client.js`, `AuthContext.jsx` | `RefreshTokens` | MOCK | 1 | اختبار نافذة السماح محاكاة وهمية فقط (`test_stage5_grace_window_mock.js`). السقف 1. |
| **F-007** | الهوية | القفل البيومتري للتطبيق | Complete | N/A (UI-Gate محلي) [V] | `UnlockScreen.js`, `App.js` | N/A | Local SecureStore | MOCK | 1 | اختبار آلة الحالات محاكاة وهمية (`test_biometric_lock_state_machine_mock.js`). السقف 1. |
| **F-008** | الهوية | استعادة وتعيين كلمة المرور | Complete | `POST /api/auth/forgot-password`, `/reset-password` [V] | `ForgotPasswordScreen.js`, `ResetPasswordScreen.js` | `ForgotPasswordPage.jsx`, `ResetPasswordPage.jsx` | `Users`, `VerificationCodes` | POSTGRES | 2 | تم التحقق من دورة إعادة التعيين كاملة على PostgreSQL (`test_auth_completion.js`). |
| **F-009** | الهوية | حذف الحساب وتجهيل البيانات | Complete | `DELETE /api/users/me` [V] | `ProfileScreen.js` | `ProfilePage.jsx` | `Users`, `UserAddresses`, `RefreshTokens` | MOCK | 1 | اختباره الوحيد هو محاكاة برمجية (`test_account_deletion_mock.js`). السقف 1. |
| **F-010** | الهوية | تسجيل الموافقة الصريحة PDPL | Complete | ضمن `POST /api/auth/register` [V] | `RegisterScreen.js` | `RegisterPage.jsx` | `UserConsents` | POSTGRES | 2 | مسار طبيعي مثبت على PostgreSQL مع تسجيل رقم الإصدار والطابع الزمني. |
| **F-011** | الكتالوج | التصنيفات الشجرية ثنائية اللغة | Complete | `GET/POST/PUT/DELETE /api/categories` [V] | `CategoriesScreen.js`, `AdminCategoriesScreen.js` | `CategoriesPage.jsx`, `AdminPortalPage.jsx` | `Categories` | POSTGRES | 2 | تم التحقق من الأسماء ثنائية اللغة والتحقق من صحتها على PostgreSQL. |
| **F-012** | الكتالوج | البحث الذكي وتطبيع الحروف | Complete | `GET /api/search/products`, `/suggestions`, `/reindex` [V] | `MobileSearchScreen.js` | `SearchResultsPage.jsx` | `Products`, `Categories` | POSTGRES | 3 | فحص شامل على PostgreSQL: تطبيع الهمزات والتاء المربوطة، واقتراحات الكلمات، واستبعاد المنتجات المحذوفة. |
| **F-013** | الكتالوج | تصفية وترتيب كتالوج المنتجات | Complete | `GET /api/products`, `/search` [V] | `CatalogScreen.js` | `HomePage.jsx` | `Products`, `Categories` | POSTGRES | 2 | مسار طبيعي للتصفية والترتيب على PostgreSQL (`test_stage1_postgres.js`). |
| **F-014** | الكتالوج | متغيرات المنتجات (Color/Size/SKU) | Complete | مضمنة في مسارات المنتجات [V] | `ProductDetailsScreen.js`, `AddEditProductScreen.js` | `ProductDetailsPage.jsx`, `SellerProductsPage.jsx` | `ProductVariants` | POSTGRES | 2 | مدعومة ومختبرة في تدفقات الشراء والمخزون على PostgreSQL. |
| **F-015** | الكتالوج | رفع وتطهير صور المنتجات | Complete | `POST /api/products/upload-image`, `/upload-images` [V] | `AddEditProductScreen.js` | `SellerProductsPage.jsx` | `UploadedFiles` | POSTGRES | 2 | فحص الـ Magic Bytes وتجريد EXIF مثبت على PostgreSQL (`test_stage3_images_postgres.js`). |
| **F-016** | الكتالوج | قائمة الرغبات السحابية | Complete | `GET /api/wishlist`, `POST /wishlist/{id}/toggle`, `GET /ids` [V] | `WishlistScreen.js` | `WishlistPage.jsx` | `WishlistItems` | POSTGRES | 2 | تم التحقق من التبديل والفهرس المركب على PostgreSQL (`test_batch3_verification_postgres.js`). |
| **F-017** | الكتالوج | تقييمات المنتجات بالصور | Complete | `GET/POST /api/products/{id}/reviews`, `PUT/DELETE /reviews/{id}` [V] | `ProductDetailsScreen.js` | `ProductDetailsPage.jsx` | `Reviews`, `UploadedFiles` | POSTGRES | 3 | فحص سلوكي على PostgreSQL: اشتراط الشراء الفعلي، نافذة 30 يوماً، حماية تعديل مراجعات الغير، وإعادة حساب التقييم آلياً. |
| **F-018** | الكتالوج | الإبلاغ عن المراجعات والإشراف | Complete | `POST /api/reviews/{id}/report`, `GET /reported`, `POST /hide` [V] | `AdminReviewsScreen.js` | `AdminPortalPage.jsx` | `Reviews`, `ReviewReports` | POSTGRES | 2 | مسار التحقق من البلاغات والإخفاء الإداري على PostgreSQL. |
| **F-019** | الكتالوج | ردود البائعين على التقييمات | Complete | `POST /api/reviews/{id}/reply`, `GET /api/seller/reviews` [V] | `DashboardScreen.js` | `SellerProductsPage.jsx` | `Reviews` | POSTGRES | 2 | تم التحقق من قصر الرد على التاجر صاحب المنتج على PostgreSQL. |
| **F-020** | السلة | سلة التسوق بمفاتيح مركبة | Complete | سياق حالة محلي بالواجهات | `CartScreen.js` | `CartPage.jsx` | Local Storage | MOCK | 1 | اختبار من جانب العميل فقط (`test_web_security_and_build.js`). السقف 1. |
| **F-021** | السلة | إنشاء الطلب وخصم المخزون | Complete | `POST /api/orders` [V] | `CheckoutScreen.js` | `CheckoutPage.jsx` | `Orders`, `OrderItems`, `Shipments` | POSTGRES | 3 | فحص PostgreSQL شامل: خصم المخزون التزامني، تقسيم الشحنات حسب التاجر، واحتساب الشحن. |
| **F-022** | السلة | تسعير الشحن لـ 27 محافظة | Complete | `POST /api/delivery/quote`, `/calculate-fee` [V] | `CheckoutScreen.js` | `CheckoutPage.jsx` | `SellerProfiles` | POSTGRES | 2 | تم التحقق من جميع المحافظات الـ 27 والنطاقات السعرية على PostgreSQL (`test_batch4_partC_postgres.js`). |
| **F-023** | الطلبات | استعراض تفاصيل الطلب الفردي | Complete | `GET /api/orders/{id:int}` [V] | `MyOrdersScreen.js` | `BuyerOrdersPage.jsx` | `Orders`, `OrderItems`, `Shipments` | POSTGRES | 2 | تم التحقق من جلب الطلب وعزل الصلاحيات للمشتري والمدير على PostgreSQL (`test_batch4_partA_postgres.js`). |
| **F-024** | الطلبات | إلغاء الطلب واسترداد المخزون | Complete | `POST /api/orders/{id:int}/cancel` [V] | `MyOrdersScreen.js` | `BuyerOrdersPage.jsx` | `Orders`, `Products`, `ProductVariants` | POSTGRES | 2 | تم التحقق من إعادة المخزون ومنع الإلغاء بعد الشحن على PostgreSQL. |
| **F-025** | الطلبات | منع تكرار الطلبات (Idempotency) | Complete | فحص `Idempotency-Key` في `POST /api/orders` [V] | `CheckoutScreen.js` | `CheckoutPage.jsx` | `Orders` (`IdempotencyKey`) | POSTGRES | 3 | فحص PostgreSQL حقيقي: إرسال نفس المفتاح يمنع تكرار الطلب ويعيد نفس السجل دون خصم إضافي للمخزون. |
| **F-026** | الطلبات | دورة حياة الشحنة وتزامن الحالات | Complete | `GET /api/shipments/seller`, `PUT /shipments/{id}/status` [V] | `SellerOrdersScreen.js` | `SellerShipmentsPage.jsx` | `Shipments`, `Orders` | POSTGRES | 3 | فحص PostgreSQL شامل: قصر صلاحية التاجر على HandedToCarrier، تحديث SQL ذري يمنع السباق، واسترجاع المخزون الذري عند Returned. |
| **F-027** | الطلبات | عداد رفض الدفع عند الاستلام والحظر | Planned-not-built | N/A (بحث في الكود: الحقول غير موجودة) | N/A | N/A | `Users` (الحقول غير موجودة) | NONE | 0 | الإعداد موجود في json فقط؛ لا توجد أي شيفرة تقرأه أو تحظر المشتري. |
| **F-028** | الطلبات | طباعة الفواتير وبوالص الشحن | Complete | مكونات طباعة من جانب العميل | `SellerOrdersScreen.js` | `SellerShipmentsPage.jsx` | لا يوجد (مشتقة) | MOCK | 1 | فحص تطابق الواجهات والمكونات فقط دون اختبار سلوكي خلفي. السقف 1. |
| **F-029** | الشحن | مزود الشحن والنطاقات التسعيرية | Complete | `GET /api/delivery/cities`, `/pickup-points`, `/quote` [V] | `CheckoutScreen.js` | `CheckoutPage.jsx` | لا يوجد (`FakeDeliveryProvider`) | POSTGRES | 2 | تم التحقق من تغطية المحافظات الـ 27 وتوزيع نقاط الاستلام على PostgreSQL. |
| **F-030** | الشحن | إدارة العناوين المسجلة للمشتري | Complete | `GET/POST/PUT/DELETE /api/users/me/addresses` [V] | `CheckoutScreen.js`, `ProfileScreen.js` | `CheckoutPage.jsx`, `ProfilePage.jsx` | `UserAddresses` | POSTGRES | 2 | تم التحقق من الإضافة والتعديل والحذف وتحديد العنوان الافتراضي على PostgreSQL. |
| **F-031** | الشحن | التقاط الموقع عبر خرائط جوجل | Complete | مكونات الخرائط بالواجهات [V] | `MobileLocationPicker.js` | `GoogleMapsLocationPicker.jsx` | `UserAddresses`, `SellerProfiles` | NONE | 1 | تم فحص وجود المكون في الواجهات فقط؛ لم يُختبر على PostgreSQL. السقف 1. |
| **F-032** | الإرجاع | طلبات الإرجاع خلال 14 يوماً | Complete | `POST /api/returns`, `GET /buyer`, `GET /seller`, `PUT /resolve` [V] | `MyOrdersScreen.js` | `BuyerOrdersPage.jsx`, `SellerReturnsPage.jsx` | `ReturnRequests`, `OrderItems` | POSTGRES | 2 | مسار التحقق من مهلة 14 يوماً وقبول/رفض التاجر مثبت على PostgreSQL (`test_stage4_reviews_postgres.js`). |
| **F-033** | الإرجاع | عزل صور أدلة الإرجاع PDPL | Complete | `POST /api/returns/upload-evidence`, `GET /api/files/private/{file}` [V] | `MyOrdersScreen.js` | `BuyerOrdersPage.jsx` | `UploadedFiles`, `ReturnRequests` | POSTGRES | 3 | فحص PostgreSQL شامل: عزل الملفات في App_Data، منع التخطي (Directory Traversal)، قصر العرض على المشتري والتاجر المعنيين والمدير، ورد 403 للمتطفلين. |
| **F-034** | المراجعات | التحقق من أهلية التقييم للشراء | Complete | `GET /api/products/{id}/review-eligibility` [V] | `ProductDetailsScreen.js` | `ProductDetailsPage.jsx` | `Reviews`, `OrderItems` | POSTGRES | 2 | فحص الأهلية على PostgreSQL بناءً على استلام الشحنة وتاريخ التسليم. |
| **F-035** | أدوات التاجر | ملف البائع ومقر استلام الشحنات | Complete | `GET/PUT /api/users/me/seller-profile` [V] | `ProfileScreen.js` | `SellerProfilePage.jsx` | `SellerProfiles` | POSTGRES | 2 | تم التحقق من تحديث الإحداثيات والبيانات التجارية على PostgreSQL (`test_batch4_partC_postgres.js`). |
| **F-036** | أدوات التاجر | إدارة المنتجات والتحديث السريع | Complete | `GET/POST/PUT/DELETE /api/products`, `PATCH /quick-stock` [V] | `MyProductsScreen.js` | `SellerProductsPage.jsx` | `Products`, `ProductVariants` | POSTGRES | 2 | تم التحقق من الحذف الناعم وتحديث المخزون على PostgreSQL (`test_batch3_verification_postgres.js`). |
| **F-037** | أدوات التاجر | إحصائيات لوحة تحكم التاجر | Complete | `GET /api/users/me/seller-dashboard` [V] | `DashboardScreen.js` | `SellerDashboardPage.jsx` | استعلام تجميعي EF Core | POSTGRES | 2 | تم التحقق من دقة التجميع الحسابي للمبيعات على PostgreSQL (`test_dashboards.js`). |
| **F-038** | الإدارة | لوحة إحصائيات أداء المنصة KPI | Complete | `GET /api/admin/stats` [V] | `AdminStatsScreen.js` | `AdminPortalPage.jsx` | استعلام تجميعي EF Core | POSTGRES | 2 | تم التحقق من حساب إجمالي التداول والطلبات والمستخدمين على PostgreSQL (`test_admin_portal_postgres.js`). |
| **F-039** | الإدارة | إدارة وتعديل حسابات المستخدمين | Complete | `GET /api/admin/users`, `PUT /users/{id}/status` [V] | `AdminUsersScreen.js` | `AdminPortalPage.jsx` | `Users` | POSTGRES | 2 | تم التحقق من تفعيل وتعطيل الحسابات على PostgreSQL (`test_admin_portal_postgres.js`). |
| **F-040** | الإدارة | سجل التدقيق الإداري غير القابل للتعديل | Complete | `GET /api/admin/audit-logs` [V] | N/A | `AdminPortalPage.jsx` | `AdminAuditLogs` | POSTGRES | 2 | تم التحقق من تسجيل وتصفية السجلات الإدارية على PostgreSQL (`test_batch4_partA_postgres.js`). |
| **F-041** | الإشعارات | طابور وخادم الإشعارات المنفصل | Complete | `POST /api/notifications/register-token`, `/unregister-token` [V] | `AuthContext.js` | `Navbar.jsx`, `AuthContext.jsx` | `UserDeviceTokens` | POSTGRES | 3 | فحص PostgreSQL شامل: قناة معزولة Bounded Channel، خادم خلفي Hosted Worker، عزل أخطاء المزود، وحذف التوكن فور الخروج. |
| **F-042** | الإشعارات | مركز الإشعارات والتوجيه الذكي | Complete | `GET /api/notifications`, `/unread-count`, `PUT /read`, `/read-all` [V] | `NotificationsScreen.js` | `Navbar.jsx` | `UserNotifications` | POSTGRES | 2 | تم التحقق من القراءة والتوجيه بـ referenceId وخلو الرسائل من البيانات الشخصية على PostgreSQL. |
| **F-043** | الإشعارات | مزودات الرسائل القصيرة والبريد | Complete | خدمات داخلية (`IEmailSender`, `ISmsSender`) [V] | N/A | N/A | لا يوجد | POSTGRES | 2 | تم التحقق من عزل أخطاء SMS عبر PostgreSQL في تدفق الطلبات (`test_batch4_partC_postgres.js`). |
| **F-044** | المالية | محفظة المشتري الرقمية | Flag-off | `GET /api/users/me/wallet` [V] | N/A | N/A | `BuyerWallets`, `BuyerWalletTransactions` | POSTGRES | 1 | مغلقة افتراضياً بعلم الميزة؛ تم اختبار حجبها 404 على PostgreSQL (`test_part1_feature_gating_postgres.js`). السقف 1. |
| **F-045** | المالية | محفظة البائع وسجل العمليات | Flag-off | `GET /api/wallet/me` [V] | `SellerWalletScreen.js` (محجوبة) | `SellerWalletPage.jsx` (محجوبة) | `VendorWallets`, `WalletTransactions` | POSTGRES | 1 | مغلقة افتراضياً بعلم الميزة؛ تم اختبار حجبها 404 على PostgreSQL. السقف 1. |
| **F-046** | المالية | طلبات سحب أرباح المتاجر | Flag-off | `POST/GET /api/wallet/payouts`, `GET/POST /api/admin/wallet/payouts` [V] | `SellerWalletScreen.js`, `AdminPayoutsScreen.js` | `SellerWalletPage.jsx`, `AdminPortalPage.jsx` | `PayoutRequests` | POSTGRES | 1 | مغلقة افتراضياً بعلم الميزة؛ تم اختبار حجبها 404 على PostgreSQL. السقف 1. |
| **F-047** | المالية | كوبونات الخصم للمتاجر | Flag-off | `POST/GET /api/coupons`, `POST /validate` [V] | `SellerCouponsScreen.js`, `CheckoutScreen.js` | `SellerCouponsPage.jsx`, `CheckoutPage.jsx` | `Coupons`, `CouponUsages` | POSTGRES | 1 | مغلقة افتراضياً بعلم الميزة؛ تم اختبار حجبها 404 على PostgreSQL. السقف 1. |
| **F-048** | الخصوصية | تصدير بيانات المستخدم PDPL | Complete | `GET /api/users/me/export-data` [V] | `ProfileScreen.js` | `ProfilePage.jsx` | `Users`, `Orders`, `UserAddresses`, `Reviews` | MOCK | 1 | اختباره محاكاة فقط (`test_account_deletion_mock.js`). السقف 1. |
| **F-049** | التدويل | التدويل ثنائي اللغة ودعم RTL | Complete | مدعوم في الكيانات والواجهات [V] | كافة شاشات الموبايل الـ 28 | كافة صفحات الويب الـ 22 | `Categories`, `Products` | MOCK | 1 | تدقيق ساكن للمفاتيح (`check-i18n.js` 1033 مفتاحاً). السقف 1 لغياب اختبار PostgreSQL سلوكي. |
| **F-050** | التخزين | تجريد طبقة التخزين (Local/S3) | Complete | `IFileStorageProvider`, `LocalFileStorageProvider`, `S3Compatible` [V] | N/A | N/A | `UploadedFiles` | POSTGRES | 2 | تم التحقق من الحفظ المحلي واسترجاع الدفق وتجريد الواجهة على PostgreSQL (`test_batch4_partD_postgres.js`). |
| **F-051** | العمليات | خدمات تنظيف المهام في الخلفية | Complete | `VerificationCodeCleanupService`, `NotificationCleanupService` [V] | N/A | N/A | `VerificationCodes`, `UserNotifications` | NONE | 1 | تعمل كخدمات خلفية؛ لا يوجد اختبار سلوكي مخصص على PostgreSQL. السقف 1. |
| **F-052** | الرصد | نقطة فحص صحة النظام /api/health | Complete | `GET /api/health`, `/health` [V] | N/A | N/A | لا يوجد (فحص DB مباشر) | POSTGRES | 2 | تعمل وتفحص الاتصال بقاعدة البيانات في بداية تشغيل خوادم الاختبار. |
| **F-053** | الأمان | الحد من معدل الطلبات وسياساتها | Complete | سياسات Rate Limiting في `Program.cs` [V] | N/A | N/A | Memory Cache | MOCK | 1 | تم اختبارها سابقاً على InMemory فقط (`test_stage1_security_inmemory.js`). السقف 1. |
| **F-054** | أدوات الإصدار | حزم الفحص والتحقق المؤتمتة | Complete | `run-all-tests.ps1`, `test:security`, `check-i18n` [V] | N/A | N/A | لا يوجد | MOCK | 1 | أدوات ونصوص فحص بيئية؛ لا ينطبق عليها تقييم سلوك PostgreSQL. السقف 1. |
| **F-055** | أدوات التطوير | محاكي شركة الشحن ونقاط Dev | Dev-only | `PUT /api/dev/carrier/shipments/{id}/status`, `GET /dev/auth/last-code` [V] | N/A | `DevCarrierDrawer.jsx` | `Shipments`, `VerificationCodes` | POSTGRES | 2 | محاكي لتغيير حالات الشحنات في بيئة التطوير، مختبر على PostgreSQL (`test_batch1_verification_postgres.js`). |
| **F-056** | الأمان | التحقق الثنائي TOTP ورموز الاسترداد للمدير | Planned-not-built | N/A (بحث في الكود: لا يوجد) | N/A | N/A | لا يوجد | NONE | 0 | البحث أظهر فقط خيار `AdminRequire2FA` معزول وغير مفعل في `FeatureFlags.cs:41`. لا يوجد كود TOTP أو رموز استرداد. |
| **F-057** | الأمان | جلسات الكوكيز المشفرة وتصليد CSP للمدير | Planned-not-built | N/A (بحث في الكود: لا يوجد) | N/A | N/A | لا يوجد | NONE | 0 | البحث أظهر خلو `Program.cs` و `admin-web` من ترويسات CSP، والتوكن مخزن في localStorage وليس كوكيز HttpOnly. |
| **F-058** | العمليات | سكربتات النسخ الاحتياطي وتجارب الاسترجاع | Planned-not-built | N/A (بحث في الكود: لا يوجد) | N/A | N/A | لا يوجد | NONE | 0 | تم فحص مجلد `scripts/` بالكامل؛ لا توجد أي سكربتات لـ pg_dump أو استرجاع أو تدريبات طوارئ. |
| **F-059** | التخزين | سكربت ترحيل الملفات الحالية إلى السحاب | Planned-not-built | N/A (بحث في الكود: لا يوجد) | N/A | N/A | لا يوجد | NONE | 0 | تم تجريد واجهة S3 في الدفعة الرابعة لكن لا يوجد سكربت لنقل الملفات المرفوعة محلياً إلى التخزين السحابي. |
| **F-060** | الشحن | الربط الفعلي مع شركة شحن حقيقية (Bosta) | Planned-not-built | N/A (بحث في الكود: لا يوجد) | N/A | N/A | لا يوجد | NONE | 0 | واجهة `IDeliveryProvider` لا تحتوي سوى على الموفر الوهمي `FakeDeliveryProvider`. لا يوجد تكامل مع بوسطة أو أرامكس. |
| **F-061** | المالية | بوابات الدفع الإلكتروني (ميزة / بطاقات / فوري) | Planned-not-built | N/A (بحث في الكود: لا يوجد) | N/A | N/A | لا يوجد | NONE | 0 | التعداد `PaymentMethod.cs:5` يحتوي حصراً على `OnReceipt` (الدفع عند الاستلام). لا يوجد كود بوابات دفع إلكترونية. |
| **F-062** | المالية | قيود وسجلات رد الأموال المحاسبية الرسمية | Planned-not-built | N/A (بحث في الكود: لا يوجد) | N/A | N/A | لا يوجد | NONE | 0 | لا يوجد جدول أو قيود محاسبية مستقلة للمردودات، والتعامل الحالي مقتصر على حقل `RefundAmount` برقم طلب الإرجاع. |
| **F-063** | الدعم | نظام تذاكر خدمة العملاء والشكاوى | Planned-not-built | N/A (بحث في الكود: لا يوجد) | N/A | N/A | لا يوجد | NONE | 0 | تم البحث عن Ticket / Support / HelpDesk في كامل المشاريع؛ الميزة غير موجودة في الكود نهائياً. |
| **F-064** | الثقة | إبلاغ المشترين عن المتاجر والمنتجات المخالفة | Planned-not-built | N/A (بحث في الكود: لا يوجد) | N/A | N/A | لا يوجد | NONE | 0 | تم البحث عن ReportProduct و ReportSeller؛ الإبلاغ متاح فقط للمراجعات والتقييمات (`ReviewReports`). |
| **F-065** | الإشعارات | قوالب البريد الإلكتروني التفاعلية العربية | Partial | مضمن في خدمات الإرسال | N/A | N/A | لا يوجد | NONE | 1 | قوالب OTP وتعيين كلمة المرور موجودة في `EmailTemplates.cs:5,38` بصيغة HTML RTL عربية، ولكن قوالب الطلبات والشحن غير موجودة. |

---

## 4. إحصائيات درجات النضج (Maturity Rubric Distribution)

توزيع الميزات الإجمالية الـ 65 بعد التصحيح الصارم وتطبيق القيود:

- **درجة النضج 0 (غائبة أو غير مبنية - Planned-not-built / NOT FOUND):** **10** ميزات  
  *(F-027, F-056, F-057, F-058, F-059, F-060, F-061, F-062, F-063, F-064)*
- **درجة النضج 1 (هيكل أولي، أو مغلقة بعلم، أو اختباراتها محاكاة/ساكنة فقط):** **16** ميزة  
  *(F-006, F-007, F-009, F-020, F-028, F-031, F-044, F-045, F-046, F-047, F-048, F-049, F-051, F-053, F-054, F-065)*
- **درجة النضج 2 (تعمل على المسار الطبيعي باختبارات PostgreSQL حقيقية):** **32** ميزة  
  *(F-001, F-002, F-003, F-004, F-005, F-008, F-010, F-011, F-013, F-014, F-015, F-016, F-018, F-019, F-022, F-023, F-024, F-029, F-030, F-032, F-034, F-035, F-036, F-037, F-038, F-039, F-040, F-042, F-043, F-050, F-052, F-055)*
- **درجة النضج 3 (جاهزة للإنتاج: سلوك وتفويض وتزامن مختبر على PostgreSQL):** **7** ميزات  
  *(F-012 البحث الذكي، F-017 تقييمات المنتجات، F-021 إنشاء الطلب وخصم المخزون، F-025 منع تكرار الطلبات Idempotency، F-026 تزامن حالات الشحنة، F-033 عزل أدلة الإرجاع PDPL، F-041 طابور وخادم الإشعارات المنفصل)*

**الإجمالي الكلي:** **65** ميزة مدققة ومصنفة.

---

## 5. نتائج التحقق العشوائي المؤتمت والمكرر (Reproducible Sampling Verification)

تم استبدال التحقق اليدوي بتشغيل السكربت البرمجي المخصص `scripts/audit/verify-sample.js` الذي يستخدم مولد أرقام شبه عشوائي محدد البذرة (Seed: `20261028` عبر خوارزمية Mulberry32) لاختيار 10 صفوف من السجل والتحقق البرمجي التلقائي من: وجود الملف والسطر الفعلي، ونوع مزود الاختبار في ملف السويت، وانضباط درجة النضج لقواعد المزود:

```text
========================================================================
  FEATURE CATALOG REPRODUCIBLE SAMPLING VERIFIER (SEED: 20261028)
========================================================================

[Sample 1/10] Checking F-004: Phone Sign-Up
  File check: backend/Marketplace.API/Controllers/AuthController.cs:29 -> "[HttpPost("register")]"
  Test check: backend/tests/test_auth_completion.js (Provider: POSTGRES)
  Maturity rubric: 2 (Valid under provider rules)
  Result: VERIFIED PASS

[Sample 2/10] Checking F-046: Vendor Payout Requests (Flag-Gated)
  File check: backend/Marketplace.API/Controllers/WalletController.cs:37 -> "[HttpPost("payout-request")]"
  Test check: backend/tests/test_part1_feature_gating_postgres.js (Provider: POSTGRES)
  Maturity rubric: 1 (Valid under provider rules)
  Result: VERIFIED PASS

[Sample 3/10] Checking F-024: Buyer Order Cancellation & Stock Restore
  File check: backend/Marketplace.API/Controllers/OrdersController.cs:39 -> "[HttpPost("{id:int}/cancel")]"
  Test check: backend/tests/test_batch3_verification_postgres.js (Provider: POSTGRES)
  Maturity rubric: 2 (Valid under provider rules)
  Result: VERIFIED PASS

[Sample 4/10] Checking F-003: OTP Verification Code Engine
  File check: backend/Marketplace.API/Controllers/AuthController.cs:45 -> "[HttpPost("verify")]"
  Test check: backend/tests/test_auth_completion.js (Provider: POSTGRES)
  Maturity rubric: 2 (Valid under provider rules)
  Result: VERIFIED PASS

[Sample 5/10] Checking F-012: Bilingual Fuzzy Search & Normalization
  File check: backend/Marketplace.API/Controllers/SearchController.cs:45 -> "[HttpGet("products")]"
  Test check: backend/tests/test_bilingual_search_postgres.js (Provider: POSTGRES)
  Maturity rubric: 3 (Valid under provider rules)
  Result: VERIFIED PASS

[Sample 6/10] Checking F-030: Saved User Addresses Management
  File check: backend/Marketplace.API/Controllers/UsersController.cs:105 -> "[HttpGet("me/addresses")]"
  Test check: backend/tests/test_batch1_verification_postgres.js (Provider: POSTGRES)
  Maturity rubric: 2 (Valid under provider rules)
  Result: VERIFIED PASS

[Sample 7/10] Checking F-039: Admin User Management & Status Toggle
  File check: backend/Marketplace.API/Controllers/AdminController.cs:41 -> "[HttpPut("users/{id:int}/status")]"
  Test check: backend/test_admin_portal_postgres.js (Provider: POSTGRES)
  Maturity rubric: 2 (Valid under provider rules)
  Result: VERIFIED PASS

[Sample 8/10] Checking F-017: Product Ratings & Reviews with Photos
  File check: backend/Marketplace.API/Controllers/ReviewsController.cs:81 -> "[HttpPost("products/{productId:int}/reviews")]"
  Test check: backend/test_stage4_reviews_postgres.js (Provider: POSTGRES)
  Maturity rubric: 3 (Valid under provider rules)
  Result: VERIFIED PASS

[Sample 9/10] Checking F-042: Notification Center & Deep-Linking
  File check: backend/Marketplace.API/Controllers/NotificationsController.cs:22 -> "[HttpGet]"
  Test check: backend/tests/test_batch4_partB_postgres.js (Provider: POSTGRES)
  Maturity rubric: 2 (Valid under provider rules)
  Result: VERIFIED PASS

[Sample 10/10] Checking F-033: PDPL Private Evidence Storage & Access
  File check: backend/Marketplace.API/Controllers/FilesController.cs:36 -> "[HttpGet("private/{fileName}")]"
  Test check: backend/tests/test_batch4_partD_postgres.js (Provider: POSTGRES)
  Maturity rubric: 3 (Valid under provider rules)
  Result: VERIFIED PASS

[Verdict] All 10 random samples verified successfully against physical files and strict rubric.
```

---

## 6. ما لم يتم فحصه في هذه المرحلة (What Was NOT Inspected)

1. **حزم الطرف الثالث في `node_modules`:** لم يتم فحص الشفرات المصدرية الداخلية لحزم npm، واقتصر الفحص على ملفات تعريف الإصدارات والتراخيص.
2. **المجلد المنفصل المهجور `D:\Backend\MarketplaceMobile`:** تم إثبات تاريخه القديم (25 أكتوبر) ولم يتم تدقيق شاشاته الداخلية لكونه خارج المستودع.
3. **مجلدات البناء القديمة في جذر المستودع:** تم إثبات خلوها من ملفات المشروع والمصادر واحتوائها فقط على مخلفات `bin`/`obj` سابقة.
4. **بيانات إنتاجية حية:** لم يتم الاتصال بأي قاعدة بيانات حقيقية وفقاً للقاعدة الصارمة (Rule #2)، واقتصرت جميع الفحوصات السلوكية على قاعدة الاختبار `MarketplaceMVP_test`.
