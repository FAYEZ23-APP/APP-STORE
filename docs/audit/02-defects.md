# تقرير المرحلة الثانية: العيوب، المخاطر، وفحص صحة الادعاءات (Phase B: Defects, Risks & False Claims)

> **تاريخ التقرير**: 2026-10-28  
> **حالة الفحص**: تدقيق محايد وشامل مبني بالكامل على الأدلة البرمجية الفردية المباشرة (`[V] Verified` / `[I] Inferred` / `[G] General`)  
> **النطاق**: مستودع المنصة بالكامل (`backend/`، `mobile/`، `admin-web/`، `tests/`، `docs/`)  
> **سياسة التشغيل**: قراءة فقط (Read-Only) دون تعديل كود أو قواعد بيانات حقيقية.

---

## 1. الفحص المنهجي للأمان والهندسة المعمارية (Systematic Security & Architecture Review)

### 1.1 تدقيق الصلاحيات وحماية الهوية (108 Routes Auth & IDOR Analysis)
- `[V]` بتحليل مسارات الـ API البالغ عددها 108 مسارات عبر `backend/Marketplace.API/Controllers/` وفق ملف `docs/audit/routes.json`:
  - **13 مساراً** مقيد بدور المسؤول (`Role:Admin`).
  - **22 مساراً** مقيد بدور البائع (`Role:Seller`).
  - **14 مساراً** مقيد بدور المشتري (`Role:Buyer`).
  - **2 مساراً** بصلاحيات مشتركة (`Role:Seller,Admin` و `Role:Buyer,Admin`).
  - **29 مساراً** يتطلب توثيق عام (`Authenticated`).
  - **28 مساراً** متاح بشكل مجهول (`Anonymous`).
- `[V]` فحص ثغرات الوصول غير المصرح به للمعرفات (IDOR):
  - مسارات العناوين `GET/PUT/DELETE /api/users/me/addresses/{id}` تتحقق بدقة من `address.UserId != userId` في `UserService.cs:204,259,314`.
  - مسارات استرجاع الطلبات `GET /api/orders/{id}` و `POST /api/orders/{id}/cancel` تتحقق من ملكية المشتري أو رتبة الإدارة `OrderService.cs:585,603`.
  - صور وتقارير النزاعات المحمية بقانون حماية البيانات الشخصية `GET /api/files/private/{fileName}` في `FilesController.cs:66-77` تحصر الوصول في المشتري صاحب البلاغ، البائع الطرف الآخر في طلب الإرجاع، أو المسؤول (`Admin`).
- `[V]` **ثغرة أمنية في التحكم بالمسار (Broken Access Control)**:
  - المسار `PUT /api/orders/{id:int}/status` في `OrdersController.cs:95-107` متاح للبائع. في `OrderService.cs:843-850`:
    ```csharp
    var allShipments = (await _uow.Shipments.FindAsync(s => s.OrderId == orderId)).ToList();
    if (allShipments.Count <= 1)
        order.Status = newStatus;
    ```
    إذا كان الطلب يحتوي شحنة بائع واحد، يستطيع البائع تغيير حالة الطلب بالكامل إلى `Delivered` أو `Cancelled` مباشرة متجاوزاً قيد حصر البائعين في حالة `HandedToCarrier`.

### 1.2 تدقيق التحقق من المدخلات (FluentValidation Audit)
- `[V]` يحتوي المشروع على 44 كائن طلب (`Request DTO`). يتم تسجيل المصدقات تلقائياً عبر `services.AddValidatorsFromAssembly()` وفلتر `ValidationFilter.cs`.
- `[V]` توجد **12 فئة DTO بدون مصدقات FluentValidation** مسجلة:
  1. `CreateCategoryRequest` (`CategoryDtos.cs`)
  2. `UpdateCategoryRequest` (`CategoryDtos.cs`)
  3. `QuickStockUpdateRequest` (`DashboardDtos.cs`)
  4. `PayoutRequest` (`WalletDtos.cs`)
  5. `UpdateUserStatusRequest` (`AdminDtos.cs`)
  6. `LogoutRequest` (`AuthDtos.cs`)
  7. `DeliveryTariffRequest` (`DeliveryDtos.cs`)
  8. `CreateCarrierShipmentRequest` (`DeliveryDtos.cs`)
  9. `UnregisterDeviceTokenRequest` (`NotificationDtos.cs`)
  10. `ModerateReviewRequest` (`ReviewDtos.cs`)
  11. `ProductSearchRequest` (`SearchDtos.cs`)
  12. `CalculateShippingFeeRequest` (`ShippingCalculationDtos.cs`)
- `[V]` في `CategoryDtos.cs:15-33`، الخصائص `NameAr` و `NameEn` معرفة كـ `string?` وتقبل قيم فارغة على مستوى الـ DTO؛ والتحقق منها يتم برمجياً داخل `CategoryService.cs:24` بدلاً من طبقة الفلترة المسبقة.

### 1.3 تدقيق تحديد معدل الطلبات (Rate Limiting Review)
- `[V]` تم إعداد `AddRateLimiter` في `Program.cs:284` بثلاث سياسات: `auth-policy` (15 طلب/دقيقة)، `refresh-policy` (30 طلب/دقيقة)، و `upload-policy` (10 طلبات/دقيقة).
- `[V]` يوجد Middleware إضافي يعتمد على الذاكرة العشوائية `multiKeyCounters` في `Program.cs:599-617`:
  - يفرض حداً عالمياً مقداره 60 طلباً/دقيقة لكل عنوان IP، و60 طلباً/دقيقة لكل مستخدم مسجل في بيئة الإنتاج.
  - **مخاطر الإنتاج**: 60 طلباً في الدقيقة تمثل طلباً واحداً كل ثانية. عند تصفح تطبيق الموبايل، يؤدي جلب الكتالوج والإشعارات والمفضلة والعربة بالتوازي إلى استنفاد الحد وتلقي المستخدم العادي خطأ `429 Too Many Requests`.
  - العدادات المحفوظة في الذاكرة تفقد فاعليتها وتتجزأ فور تشغيل أكثر من نسخة تطبيق خلف Load Balancer.

### 1.4 تدقيق البيانات الشخصية والخصوصية (PII & PDPL Law 151/2020)
- `[V]` **تسريب بيانات حساسة في السجلات (Critical PII Leak)**:
  - ملف `ConsoleEmailSender.cs:22,31` يطبع البريد الإلكتروني ورمز التحقق OTP الصريح في سجلات الخادم:
    ```csharp
    _logger.LogWarning("🔥 [VERIFICATION OTP] To: {Email} | CODE: {Code} 🔥", toEmail, code);
    ```
  - ملف `ConsoleSmsSender.cs:21,30` وملف `ConfigurableHttpSmsSender.cs:55` يطبعان رقم هاتف العميل ورمز الـ OTP الصريح في السجلات:
    ```csharp
    _logger.LogWarning("📱 [SMS] Type: {Type} | Phone: {Phone} | Code: {Code} 📱", messageType, toPhone, code);
    ```
  - أي نظام تجميع سجلات مركزي (Log Aggregator) سيتضمن أرقام هواتف ورموز دخول صريحة، مما يخالف قانون حماية البيانات الشخصية المصري 151/2020 ويتيح اختراق الحسابات عبر السجلات.

### 1.5 معالجة الأخطاء وتسريب مسارات الكود (Error Handling)
- `[V]` ملف `GlobalExceptionMiddleware.cs:72-89` يتعامل مع كافة الاستثناءات غير المعالجة ويعيد رسالة عامة `An unexpected error occurred.` مع إخفاء تفاصيل التتبع والـ Stack Traces للمستخدم النهائي.

### 1.6 سلامة ترحيلات قاعدة البيانات (Database Migrations Hygiene)
- `[V]` تم التحقق عبر أمر `dotnet ef migrations has-pending-model-changes` وجاء الناتج: `No changes have been made to the model since the last migration.` لا يوجد أي انحراف (Drift) بين كائنات الـ C# Domain ونموذج EF Core الحالي (16 ترحيلاً مسجلاً).

### 1.7 أمان رفع الملفات (File Upload Pipeline)
- `[V]` ملف `ImageUploadService.cs:168-220` يطبق فحص البايتات السحرية (Magic Bytes)، ويحد الحجم بـ 5MB، ويعيد تشفير الصورة باستخدام SkiaSharp لمحو بيانات الموقع الجغرافي EXIF GPS بالكامل وتصغير الأبعاد بحد أقصى 1600 بكسل.
- `[V]` تم عزل مرفقات النزاعات والعيوب الخاصة في مجلد خاص خارج الويب `App_Data/private-uploads/returns` لا يتم الوصول إليه إلا عبر جلسة موثقة وتفويض محكم.

### 1.8 تدقيق ثغرات الحزم والاعتماديات (Vulnerability Audit)
- `[V]` مشروعات الباك إند (`Marketplace.API`, `Infrastructure`, `Application`, `Domain`): صفر ثغرات معلنة وفق فحص `dotnet list package --vulnerable`.
- `[V]` مشروع لوحة الويب `admin-web`: صفر ثغرات معلنة وفق فحص `npm audit`.
- `[V]` تطبيق الموبايل `mobile`: يحتوي **10 ثغرات معلنة** (4 عالية الخطورة: `node-forge`, `zod`, `deepmerge` عبر `@expo/cli`، 1 متوسطة: `postcss-selector-parser`، 5 منخفضة) ناتجة عن تحديثات غير مقفلة لحزم Expo.

### 1.9 تدقيق عميل الموبايل ولوحة الويب (Mobile & Web Clients)
- `[V]` **لوحة الويب (`admin-web`)**:
  - تخزن Access Token و Refresh Token في `localStorage` (`admin-web/src/api/client.js:6-24`).
  - غياب كوكيز `HttpOnly` وغياب ترويسات `Content-Security-Policy (CSP)`. أي ثغرة XSS تؤدي لسرقة صلاحيات الإدارة فوراً.
- `[V]` **تطبيق الموبايل (`mobile`)**:
  - الرموز مخزنة بأمان في `expo-secure-store`، والـ Refresh Token غير مقيد بمستشعرات البصمة طبقاً للقاعدة 9.
  - **غياب الروابط العميقة (Deep Linking)**: كائن `<NavigationContainer>` في `mobile/src/navigation/AppNavigator.js:44` لا يحتوي أي خاصية `linking`. النقر على إشعارات الـ Push أو الروابط الخارجية لا يوجه لصفحة الطلب أو الشحنة المعنية.

---

## 2. سجل العيوب والمخاطر التفصيلي (Defects Table D-001 to D-016)

| المعرف | الخطورة | النطاق | الدليل والملف | الأثر التقني والتشغيلي | خطوات إعادة التوليد | الحل المقترح (دون تطبيق) | الاختبار المطلوب | الجهد |
|:---|:---:|:---:|:---|:---|:---|:---|:---|:---:|
| **D-001** | `BLOCKER` | DevOps / Repo | `git ls-files admin-web` = 0; `git status` -> `?? admin-web/` | لوحة تحكم الإدارة غير متتبعة داخل Git وتعتمد على Junction محلي. أي استنساخ جديد للمشروع يؤدي لفقدان لوحة التحكم بالكامل | تشغيل `git clone` في مسار منفصل وفحص مجلد `admin-web` | تثبيت المجلد كـ Submodule أو دمجه مباشرة في مسار المستودع | فحص سلامة استنساخ المستودع عبر CI/CD | `S` |
| **D-002** | `BLOCKER` | Security / PII | `ConsoleEmailSender.cs:22,31` و `ConsoleSmsSender.cs:21,30` و `ConfigurableHttpSmsSender.cs:55` | طباعة أرقام هواتف، إيميلات، ورموز OTP صريحة في السجلات. انتهاك لقانون حماية البيانات 151/2020 وإمكانية اختراق الحسابات من السجلات | طلب تسجيل أو استعادة كلمة مرور ومراقبة مخرجات Console/Log | حجب أرقام الهواتف والإيميلات وإخفاء رمز الـ OTP بـ `******` في بيئات العمل | اختبار فحص سجلات الخادم بعد إرسال كود تحقق | `S` |
| **D-003** | `HIGH` | Database / Integrity | `20261027172857_AddProductIsDeletedAndOrderIdempotencyKey.cs:34-37` | الفهرس المركب `IX_Orders_BuyerId_IdempotencyKey` غير فريد (`unique: true` غائبة). الإرسال المتزامن يولد طلبين بنفس المفتاح ويخصم المخزون مرتين | إرسال طلبي Checkout متزامنين تماماً بنفس قيمة `Idempotency-Key` | ترحيل جديد يجعل الفهرس `unique: true` للقيم غير الفارغة | اختبار إرسال متزامن للطلبات بمفتاح مكرر | `S` |
| **D-004** | `HIGH` | Concurrency / Orders | `OrderService.cs:616-625` | التحقق من حالة الشحنات يتم قبل بدء Transaction قاعدة البيانات ودون قفل صفوف. إلغاء الطلب يتزامن مع تسليمه للشحن | قيام المشتري بالإلغاء في نفس لحظة تسليم البائع للشحنة | إدخال فحص الشحنات داخل Transaction وقفل الصف بـ `FOR UPDATE` | اختبار PostgreSQL concurrency بين الإلغاء وتسليم الشحنة | `M` |
| **D-005** | `HIGH` | Authorization | `OrdersController.cs:95` و `OrderService.cs:843-850` | مسار قديم يتيح للبائع تغيير حالة الطلب كاملاً إلى `Delivered` إذا كان الطلب يخص بائعاً واحداً متجاوزاً قيد `HandedToCarrier` | استدعاء `PUT /api/orders/{id}/status` بحساب بائع على طلبه | إلغاء أو تقييد هذا المسار وحصر تحديثات الشحن عبر `ShipmentService` فقط | اختبار محاولة بائع تعيين حالة Delivered عبر هذا المسار | `S` |
| **D-006** | `HIGH` | Web Security | `admin-web/src/api/client.js:6-24` | حفظ توكنات الأدمن في `localStorage` دون حماية كوكيز `HttpOnly` وبلا ترويسات `CSP`. ثغرة XSS واحدة تكشف توكن الإدارة | فحص `localStorage` في المتصفح بعد تسجيل الدخول للوحة الأدمن | استخدام HttpOnly SameSite Cookies لجلسات الإدارة وإضافة ترويسة CSP صارمة | اختبار فحص وجود ترويسات CSP وعدم تخزين التوكن محلياً | `M` |
| **D-007** | `HIGH` | Business Logic | `OrderService.cs:113` | شرط حظر الدفع عند الاستلام يعتمد على `ReturnReason.RefusedByBuyer`، لكن لا توجد واجهة للمسؤول أو شركة الشحن لتسجيل هذا السبب في الإنتاج | محاولة تسجيل رفض استلام في بيئة لا تحتوي `DevCarrierController` | توفير شاشة إدارية أو Webhook معتمد لتحديث سبب الإرجاع الفعلي | اختبار ربط مسار الرفض الفعلي بعداد رفض COD | `M` |
| **D-008** | `HIGH` | Architecture | `DevCarrierController.cs:39-46` و `FakeDeliveryProvider.cs` | غياب التكامل مع شركة شحن حقيقية (بوسطة/أرامكس)، وتخطي فحص السر الخاص بالناقل التجريبي إذا لم يتم تمرير الترويسة إطلاقاً | استدعاء مسار الناقل بدون ترويسة `X-Carrier-Dev-Secret` في وضع التطوير | فرض التحقق من التوقيع الرقمي للـ Webhook وبناء موفر حقيقي | اختبار رفض استدعاء مسار الناقل دون سر صالح | `L` |
| **D-009** | `MEDIUM` | Info Disclosure | `Program.cs:719-720` | مسار `/api/health` العام يكشف عن تاريخ بناء الملف، ورقم الـ Commit، ورقم الإصدار لعموم المستخدمين المجهولين | طلب `GET /api/health` دون توثيق | إخفاء تفاصيل الإصدار والكوميت وجعلها مقتصرة على الأدمن الموثق | اختبار التأكد من أن رد Health العام لا يسرب بيانات البناء | `S` |
| **D-010** | `MEDIUM` | Documentation / Drift | `docs/DEPLOY.md:51,64-67` و `DependencyInjection.cs:68` | وثيقة النشر تزعم دعم إعدادات SMTP وخاصية 2FA للأدمن، بينما الكود يعتمد على Resend API وخاصية 2FA مجرد إعداد معلق غير مبني | ضبط متغيرات SMTP ومحاولة إرسال بريد، أو تشغيل الأدمن دون 2FA | تحديث وثيقة النشر وتصحيح المتغيرات ومسح الادعاءات المعلقة | تدقيق تطابق متغيرات البيئة مع كود الـ C# الفعلي | `S` |
| **D-011** | `MEDIUM` | Input Validation | `CategoryDtos.cs` و `CategoryService.cs:24` | غياب كائنات FluentValidation لـ 12 كائن طلب مما يتجاوز فلتر التحقق المبكر ويؤجل التدقيق لطبقة الخدمة | إرسال طلب إنشاء فئة بحقول غير صالحة وفحص استجابة الخادم | كتابة مصدقات FluentValidation لكافة كائنات الطلب الـ 12 | اختبار رفض المدخلات غير الصالحة عبر `ValidationFilter` | `M` |
| **D-012** | `MEDIUM` | Mobile UX / Routing | `mobile/src/navigation/AppNavigator.js:44` | غياب إعداد الروابط العميقة (`linking`) في `NavigationContainer` مما يعطل فتح شاشات الطلبات والإشعارات عبر الإشعارات أو الرسائل | فتح التطبيق عبر رابط خارجي أو النقر على إشعار من خارج التطبيق | إضافة تهيئة الروابط العميقة `linking` والبروتوكول الخاص بالتطبيق | اختبار انتقال التطبيق للشاشة المحددة عبر Deep Link | `S` |
| **D-013** | `MEDIUM` | Codebase Quality | `backend/Marketplace.slnx` | غياب أي مشروع اختبارات C# قياسي (xUnit / NUnit) والاعتماد الكلي على سكربتات Node.js خارجية لا تعمل مع `dotnet test` | تشغيل أمر `dotnet test` داخل مجلد `backend/` | إنشاء مشروع `Marketplace.Tests` قياسي يعتمد على `xUnit` | تشغيل دورة اختبارات قياسية عبر CLI | `L` |
| **D-014** | `MEDIUM` | Test Honesty | `backend/tests/test_batch1_verification_postgres.js:103` | تضمين اختبارات نصوص ثابتة (`fs.readFileSync`) وفحص ملفات داخل سكربت يحمل اسم PostgreSQL E2E | مراجعة الكود المصدري لسكربت التحقق | فصل اختبارات الفحص المصدري الثابت عن اختبارات قاعدة البيانات الحية | تدقيق تصنيف نوع مزود الاختبار في التقارير | `M` |
| **D-015** | `LOW` | Dependencies | `mobile/package.json` و `npm audit` | وجود 10 ثغرات في حزم الموبايل وانحراف نسخة Expo إلى 58 غير المستقرة محلياً | تشغيل `npm --prefix mobile audit` | تثبيت نسخ الحزم المتوافقة واستخدام `npm audit fix` الحذر | اختبار تشغيل وبناء الموبايل بعد تصحيح الحزم | `S` |
| **D-016** | `LOW` | Availability | `Program.cs:600,611` | حد الطلبات العام (60 طلب/دقيقة لكل IP) خانق للغاية في الإنتاج ويسبب أخطاء 429 لمتصفحي الكتالوج العاديين | تصفح سريع لعدة منتجات وفئات في أقل من دقيقة | رفع الحد العام إلى 180-300 طلب/دقيقة وحصر التضييق على مسارات التوثيق | اختبار تصفح متوازي لـ 70 طلباً عادياً | `S` |

---

## 3. جدول فحص صحة الادعاءات (Claims vs. Reality Table)

| الادعاء أو الميزة المذكورة في التوثيق السابق | المصدر المكتوب | الحالة الفعلية | الحكم النهائي | الأدلة المباشرة من الكود |
|:---|:---|:---:|:---:|:---|
| "تفعيل المصادقة الثنائية TOTP للأدمن مع أكواد الاسترداد" | `docs/DEPLOY.md:51` | غير مبنية إطلاقاً | **FALSE** | `AdminRequire2FA` مجرد خاصية في `appsettings.json`. لا توجد أي جداول أو شاشات أو منطق للـ 2FA في الكود |
| "حماية لوحة تحكم الأدمن بكوكيز مشفرة وترويسات CSP صارمة" | تقارير التصليد السابقة | غير مبنية | **FALSE** | `admin-web/src/api/client.js:6` يستخدم `localStorage` ولا توجد أي ترويسات CSP في الخادم أو الويب |
| "حظر الدفع عند الاستلام تلقائياً بعد تجاوز عدد مرات الرفض" | `AGENTS.md` و `FINANCE_READINESS.md` | معطلة عملياً في الإنتاج | **FALSE** | الشرط يطلب `ReturnReason.RefusedByBuyer` لكن لا توجد أي واجهة للناقل أو الأدمن لتسجيل هذه الحالة في الإنتاج |
| "إرسال البريد الإلكتروني عبر خوادم SMTP التقليدية" | `docs/DEPLOY.md:64-67` | غير مستخدمة ومضللة | **FALSE** | الخادم يسجل حصرياً `ResendEmailSender` (`DependencyInjection.cs:68`) ويستخدم مفتاح Resend API فقط |
| "تحقق سيرفر الناقل من ترويسة Carrier__Secret المشفرة" | `docs/DEPLOY.md:71` | كلمة سر ثابتة وثغرة تجاوز | **FALSE** | الكود في `DevCarrierController.cs:41` يستخدم `"dev-carrier-secret"` ثابتة، ويتخطى الفحص إن غابت الترويسة |
| "حفظ التزامن التام لطلبات الشراء عبر Idempotency-Key" | `tests/RESULTS.md` | معرض للكسر عند التزامن التام | **PARTIAL** | الفهرس `IX_Orders_BuyerId_IdempotencyKey` في الترحيل غير فريد (`unique: true` غائبة) مما يسمح بتكرار الطلب في نفس اللحظة |
| "قصر صلاحيات البائع على تسليم الشحنة لشركة الشحن فقط" | `AGENTS.md` و `ShipmentsController.cs` | يوجد مسار خلفي يتجاوز القيد | **PARTIAL** | المسار `PUT /api/orders/{id}/status` في `OrderService.cs:845` يتيح للبائع تعيين حالة الطلب `Delivered` إذا كان البائع وحيداً |
| "دعم كامل للروابط العميقة للإشعارات في تطبيق الموبايل" | Batch 4 Part B Report | الشاشات مهيأة ولكن Navigation غير موصول | **PARTIAL** | `NotificationsScreen.js` يتعامل مع المعاملات، لكن `<NavigationContainer>` في `AppNavigator.js` يفتقد إعداد `linking` |
| "تطبيق قواعد الأمان وقانون PDPL لصور إثبات عيوب الإرجاع" | تقرير الدفعة الرابعة | منفذة ومحمية بالكامل | **TRUE** | `FilesController.cs:66-85` يعزل الصور في مجلد خاص ويفحص هوية المشتري والبائع والأدمن بدقة |
| "حماية مخزون المنتجات من البيع الزائد عبر التحديث الذري" | `docs/FINANCE_READINESS.md` | منفذة ومثبتة برمجياً | **TRUE** | `OrderService.cs:247-268` ينفذ جملة SQL ذرية `UPDATE SET Stock = Stock - X WHERE Stock >= X` داخل Transaction |
| "فصل وتشفير بيانات الاعتماد الحساسة في بيئة الموبايل" | `AGENTS.md` القاعدة 9 | مطبقة ومطابقة للقاعدة | **TRUE** | `storage.js:28,73` يستخدم `expo-secure-store` لحفظ التوكنات دون تقييد غير مرن بالبصمة |
| "إجراء كافة الاختبارات حصرياً على PostgreSQL عبر TEST_DB" | `AGENTS.md` القاعدة 3 | غير دقيق بالكامل | **PARTIAL** | سكربتات مثل `test_stage1_security_inmemory.js` تشير لـ InMemory، وسكربتات عديدة تفحص ملفات ثابتة تحت اسم Postgres |

---

## 4. تدقيق نزاهة الاختبارات (Test Honesty Audit Table)

| اسم ملف الاختبار ومساره | المزود الفعلي المكتوب بالكود | نوعية ومحتوى الاختبار (Behavioral vs. Static) | عدد أسطر السكربت | عدد التأكيدات (Asserts) | الحكم على نزاهة الاختبار ودقته |
|:---|:---:|:---|:---:|:---:|:---|
| `backend/tests/test_account_deletion_mock.js` | `POSTGRES` (Local Server) | فحص مصدري ثابت لملفات C# + محاكاة حذف | 347 | 49 | فاشل حالياً بسبب فحص نمطي غير دقيق لكود `AuthService.cs` |
| `backend/tests/test_auth_completion.js` | `POSTGRES` (TEST_DB) | اختبار سلوكي حي للمصادقة وتوليد التوكنات | 794 | 75 | اختبار سلوكي متكامل وحقيقي ضد قاعدة البيانات |
| `backend/tests/test_batch1_verification_postgres.js` | `POSTGRES` (TEST_DB) | خليط بين فحص نصوص ثابتة ومكالمات API حية | 610 | 1 | مضلل جزئياً: يختبر نصوص واجهات الموبايل الثابتة تحت راية اختبارات Postgres |
| `backend/tests/test_batch3_fixes_postgres.js` | `POSTGRES` (TEST_DB) | اختبارات سلوكية لـ Wishlist والإشعارات والفئات | 454 | 1 | اختبار سلوكي جيد للـ API ولكن يفتقد الـ Assertions البرمجية القياسية |
| `backend/tests/test_batch3_remaining_fixes_postgres.js` | `POSTGRES` (TEST_DB) | اختبارات خلفية Background Worker وعدم تسريب PII | 585 | 4 | اختبار سلوكي حقيقي لحالات فشل موفر الإشعارات |
| `backend/tests/test_batch4_partA_postgres.js` | `POSTGRES` (TEST_DB) | اختبار سلوكي لمسار جلب الطلب الفردي وحسابات جوجل | 373 | 29 | اختبار سلوكي حي عالي الدقة وبتأكيدات رقمية واضحة |
| `backend/tests/test_batch4_partB_postgres.js` | `POSTGRES` (TEST_DB) | خليط من فحص نصوص واجهات ومكالمات تسجيل التوكن | 356 | 36 | اختبار هجين (يتضمن 9 عمليات قراءة نصوص ثابتة لملفات الواجهة) |
| `backend/tests/test_batch4_partC_postgres.js` | `POSTGRES` (TEST_DB) | حساب مسافات شحن المحافظات وتكامل السلة | 321 | 35 | اختبار سلوكي ممتاز لحسابات الشحن الجغرافية لـ 27 محافظة |
| `backend/tests/test_batch4_partD_postgres.js` | `POSTGRES` (TEST_DB) | أمان رفع صور النزاعات والتحقق من صلاحية المشاهدة | 337 | 18 | اختبار سلوكي حي متقدم للتحقق من عزل ملفات PDPL |
| `backend/tests/test_bilingual_search_postgres.js` | `POSTGRES` (TEST_DB) | اختبار البحث الثنائي العربي/الإنجليزي | 149 | 23 | اختبار سلوكي دقيق لكفاءة البحث النصي |
| `backend/tests/test_stage1_security_inmemory.js` | `HTTP_SERVER` | اختبار تشغيل الخادم والتحقق من بيئة العمل | 435 | 20 | يحمل اسم InMemory كرمز تاريخي بينما الخادم يرفض العمل بلا Postgres |
| `backend/tests/test_stage5_grace_window_mock.js` | `STATIC / MOCK` | محاكاة منطق نافذة السماح بتدوير التوكن في الذاكرة | 219 | 11 | اختبار منطقي معزول لا يلمس الخادم أو قاعدة البيانات |
| `mobile/tests/test_biometric_lock_state_machine_mock.js` | `MOCK` | اختبار آلة الحالات (State Machine) لقفل البصمة | 235 | 23 | اختبار منطقي ممتاز لسلوك واجهة القفل والمهلة الزمنية |
| `mobile/tests/test_single_flight_refresh_mock.js` | `MOCK` | محاكاة الطلبات المتوازية لتحديث التوكن | 226 | 15 | اختبار منطقي ممتاز لمنع تكرار طلبات التحديث عبر Axios |
| `admin-web/tests/test_web_security_and_build.js` | `STATIC` | فحص بنية ملفات لوحة الويب وخلوها من الاستدعاءات المحظورة | 286 | 18 | فحص نصوص ثابتة ومطابقة شفرات |

---

## 5. أهم 10 مخاطر تهدد إطلاق التجربة التجريبية (Top 10 Pilot Risks)

1. **فقدان لوحة التحكم تماماً عند الانتقال لجهاز جديد (Git Untracked Junction)**:
   - **الخطورة**: `BLOCKER`
   - **الأثر على التجربة**: مجلد `admin-web` غير مرفوع على Git، وأي تثبيت جديد للخادم لن يحتوي على لوحة تحكم لتفعيل المنتجات أو متابعة الطلبات.
   - **خطة التخفيف**: إضافة مجلد `MarketplaceWeb` كمستودع متتبع رسمياً وربطه كـ Git Submodule.

2. **تسريب بيانات العملاء ورموز الدخول في السجلات (PII & Plaintext OTP in Logs)**:
   - **الخطورة**: `BLOCKER`
   - **الأثر على التجربة**: تسجيل أكواد التحقق وأرقام هواتف العملاء في سجلات الخادم يعرض المنصة للمساءلة القانونية (قانون 151/2020) وخطر الاستيلاء على الحسابات.
   - **خطة التخفيف**: تطبيق إخفاء فوري لأكواد الـ OTP وأرقام الهواتف من مخرجات السجلات في `ConsoleEmailSender` و `ConsoleSmsSender`.

3. **غياب موفر شحن حقيقي وغياب تتبع الشحنات الميداني**:
   - **الخطورة**: `HIGH`
   - **الأثر على التجربة**: النظام يعتمد كلياً على `FakeDeliveryProvider` ومسار تجريبي، ولا توجد آلية حقيقية لربط المناديب، طباعة البوالص مع بوسطة، أو استلام إشعار التسليم.
   - **خطة التخفيف**: توفير واجهة شحن إدارية مبسطة (Manual Dispatch Panel) للتجربة التجريبية تتيح للأدمن تغيير الحالات يدوياً بعد التأكد هاتفياً من المندوب.

4. **تعطل الحماية ضد عملاء رفض الاستلام الكيدي (COD Abuse Blindspot)**:
   - **الخطورة**: `HIGH`
   - **الأثر على التجربة**: الدفع عند الاستلام هو الأساس في مصر، والنظام لا يستطيع تسجيل حالات الرفض لغياب Webhook شركة الشحن، مما يعرض البائعين لتحمل تكاليف شحن كيدية دون حظر للمسيئين.
   - **خطة التخفيف**: إضافة خيار صريح للأدمن لتسجيل الشحنة المرتجعة بسبب `RefusedByBuyer`.

5. **هشاشة أمان جلسات الإدارة في المتصفح (`localStorage` JWT Storage)**:
   - **الخطورة**: `HIGH`
   - **الأثر على التجربة**: تخزين توكن الأدمن في `localStorage` دون كوكيز `HttpOnly` أو ترويسات `CSP` يجعل المنصة عرضة للقرصنة في حال وجود أي ثغرة حقن في مكتبات الطرف الثالث.
   - **خطة التخفيف**: ضبط كوكيز التوثيق للأدمن وتفعيل سياسة CSP أساسية في Vite و Kestrel.

6. **توليد طلبات مكررة عند ضعف الشبكة (Non-Unique Idempotency Index)**:
   - **الخطورة**: `HIGH`
   - **الأثر على التجربة**: على شبكات 3G/4G البطيئة في مصر، نقر العميل المزدوج قد يولد طلبين مكررين في نفس الجزء من الثانية ويخصم المخزون مرتين لغياب القيد الفريد في قاعدة البيانات.
   - **خطة التخفيف**: ترحيل تعديل للفهرس في قاعدة البيانات ليصبح `UNIQUE INDEX`.

7. **سباق التزامن عند إلغاء الطلبات (Cancellation Race Condition)**:
   - **الخطورة**: `HIGH`
   - **الأثر على التجربة**: إمكانية نجاح العميل في إلغاء الطلب واسترداد رصيد المحفظة بعد قيام البائع بتسليم الشحنة للمندوب مباشرة لغياب القفل المتزامن.
   - **خطة التخفيف**: إدراج فحص حالة الشحنة داخل Transaction متزامنة مع قفل السجل `FOR UPDATE`.

8. **حظر المستخدمين الحقيقيين بسبب ضيق حد الطلبات (False-Positive 429 Throttle)**:
   - **الخطورة**: `MEDIUM`
   - **الأثر على التجربة**: تحديد 60 طلباً/دقيقة للـ IP الواحد في الإنتاج سيتسبب في تعطل التطبيق وظهور شاشات خطأ للمستخدمين النشطين عند التصفح السريع.
   - **خطة التخفيف**: رفع سقف الـ Rate Limit للعمليات العامة غير الحساسة إلى 180 طلب/دقيقة.

9. **انعدام اختبارات C# التلقائية المدمجة (No Native C# Test Projects)**:
   - **الخطورة**: `MEDIUM`
   - **الأثر على التجربة**: غياب مشروع `dotnet test` يجعل المطور الوحيد عرضة لإدخال انتكاسات برمجية (Regressions) عند إصلاح أي عيب أثناء التجربة الحية.
   - **خطة التخفيف**: إنشاء نواة مشروع xUnit بسيط يختبر المسارات الحرجة في دورة البناء.

10. **تعطل توجيه الإشعارات الخارجية (Missing Deep-Linking Configuration)**:
    - **الخطورة**: `MEDIUM`
    - **الأثر على التجربة**: رسائل الـ SMS أو إشعارات التطبيق المرسلة للعملاء لن تفتح شاشة تفاصيل الطلب مباشرة، بل ستفتح الشاشة الرئيسية مما يربك المستخدمين.
    - **خطة التخفيف**: تمرير كائن الـ `linking` الأساسي لـ `<NavigationContainer>`.

---

## 6. التحقق من عينة عشوائية ومطابقتها (Sampling Verification)

`[V]` تم تشغيل فحص عشوائي عبر كود التدقيق لـ 5 عيوب ومطابقتها حرفياً مع الكود المصدري وقاعدة البيانات:
1. **D-002**: مطابقة `ConsoleEmailSender.cs:22` أثبتت وجود نص `LogWarning` الصريح للـ OTP.
2. **D-003**: مطابقة ملف الترحيل `20261027172857_AddProductIsDeletedAndOrderIdempotencyKey.cs:36` أثبتت غياب `unique: true`.
3. **D-005**: مطابقة `OrderService.cs:843-850` أثبتت وجود ثغرة تحديث حالة الطلب الكلية للبائع الوحيد.
4. **D-006**: مطابقة `admin-web/src/api/client.js:6` أثبتت التخزين المباشر في `localStorage`.
5. **D-009**: مطابقة `Program.cs:720` أثبتت طباعة `buildDate` و `commit` للمستخدمين المجهولين.
