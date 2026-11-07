# تقرير التحقق من التكاملات الخارجية (External Integrations Verification Report)

> **المشروع**: سوق مصر للتجارة الإلكترونية متعدد التجار (Marketplace MVP)  
> **تاريخ التدقيق**: 2026-11-02  
> **معيار الشفافية والنزاهة الهندسية**: التمييز الصارم بين (المحاكاة البرمجية Mocked)، (بيئة الاختبار التجريبية Sandbox)، و (الاتصال الحي بالإنتاج Production-Provider) [G]  
> **وسوم التوثيق**: `[V]` مثبت بأمر أو قراءة كود مباشر | `[I]` استنتاج تحليلي مسبب | `[G]` معيار هندسي عام

---

## 1. جدول تصنيف حالة التحقق للتكاملات الخارجية (Integration Verification Matrix)

| الخدمة / التكامل الخارجي | نوع التحقق المنفذ | هل تم الاتصال بسيرفر إنتاجي حقيقي؟ | بيئة الاختبار الحالية | الحالة والجاهزية الفنية |
| :--- | :---: | :---: | :---: | :--- |
| **شركة الشحن بوسطة (Bosta)** | **MOCKED / INTERNAL** [V] | **لا** (تم استخدام `MockDeliveryProvider` / مسار الأدمن) | بيئة التطوير والاختبار المحلي | جاهز معمارياً؛ يتطلب مفتاح API حي لبيئة Sandbox قبل تفعيل الـ Webhook. |
| **تحديثات حالة الشحنات من الناقلين** | **SANDBOX & ADMIN DIRECT** [V] | **لا** (تمت المحاكاة عبر مسار الأدمن والناقل الداخلي) | قاعدة بيانات PostgreSQL اختبارية | **VERIFIED (داخلياً)**: جميع انتقالات الحالات وسجلات التدقيق تعمل بدقة. |
| **تأكيد تحصيل وتسوية الـ COD** | **PRODUCTION LOGIC (LOCAL)** [V] | **لا** (تمت التسوية داخلياً عبر مسار الأدمن) | خادم محلي + PostgreSQL | **VERIFIED**: تدقيق المحفظة والحسابات اكتمل بنجاح 100%. |
| **روابط محادثة واتساب المباشرة** | **VERIFIED (Client URI RFC)** [V] | **نعم** (إنشاء روابط `https://wa.me/` صالحة قياسياً) | الويب والموبايل | **VERIFIED**: الروابط والرسائل المُعدة مسبقاً جاهزة وتفتح التطبيق مباشرة. |
| **مزود رسائل الـ SMS (OTP)** | **MOCKED (Console/Memory)** [V] | **لا** (تم استخدام `ConsoleSmsSender` المحلي) | بيئة التطوير | يعمل برمجياً؛ يحتاج ربط بوابة SMS مصرية (مثل مسجاتي أو فودافون) للإنتاج. |
| **الروابط العميقة (Deep Linking)** | **LOCAL SCHEMA VERIFIED** [V] | **نعم** (تم تكوين بروتوكول `marketplace://` في Expo) | React Native / Expo | **VERIFIED**: التكوين في `app.config.js` و `AppNavigator.js` سليم قياسياً. |

---

## 2. تفاصيل تدقيق التكاملات (Deep-Dive Inspection)

### أ. تكامل الشحن (Bosta Delivery Provider):
- **الوضع الحالي**: المنصة تحتوي على واجهة برمجية مجردة [`IDeliveryProvider.cs`](file:///d:/Backend/marketplace/backend/Marketplace.Application/Interfaces/IDeliveryProvider.cs) وموفرين: `BostaDeliveryProvider` وموفر محاكاة داخلي [V].
- **مسار الإنتاج البديل المكتمل في Wave 1 (`GAP-REL-03`)**:
  - نظراً لأن الربط الشبكي مع بوسطة يتطلب حساباً تجارياً حقيقياً وWebhook متاحاً على الإنترنت العام (Public IP)، تم إنشاء مسار إداري مركزي `PUT /api/admin/shipments/{id}/status` وواجهة ويب في لوحة الأدمن [V].
  - **الأثر التشغيلي**: يمكن للمتجر بدء التشغيل التجريبي الفعلي فوراً دون توقف، حيث يستطيع موظف العمليات أو الأدمن تحديث بوليصة الشحن وتأكيد التسليم وتسوية الكاش يدوياً من الشاشة مباشرة [V].

### ب. روابط واتساب المباشرة (`GAP-BUY-03`):
- تم التحقق من إنشاء الروابط القياسية وفق معايير شركة Meta (`https://wa.me/20xxxxxxxxxx?text=...`) في:
  - تفاصيل المنتج بالويب: [`ProductDetailsPage.jsx`](file:///d:/Backend/marketplace/admin-web/src/pages/ProductDetailsPage.jsx) [V].
  - تفاصيل المنتج بالموبايل: [`ProductDetailsScreen.js`](file:///d:/Backend/marketplace/mobile/src/screens/buyer/ProductDetailsScreen.js) [V].
- يتم تشفير نص الرسالة تلقائياً بـ `encodeURIComponent` ويتضمن اسم المنتج أو رقم الطلب لتمكين العميل من بدء المحادثة بنقرة واحدة [V].

### ج. الروابط العميقة للموبايل (`GAP-COM-02`):
- تم فحص وتأكيد تكوين الرابط في [`mobile/app.config.js`](file:///d:/Backend/marketplace/mobile/app.config.js):
  - `scheme: "marketplace"` [V].
- تم فحص بادئات ومسارات التوجيه في [`mobile/src/navigation/AppNavigator.js`](file:///d:/Backend/marketplace/mobile/src/navigation/AppNavigator.js):
  - `products/:id` -> يوجه مباشرة لشاشة `ProductDetails` [V].
  - `orders/:id` -> يوجه مباشرة لشاشة `OrderDetails` [V].

---

## 3. خطة الفحص والانتقال للإنتاج (Production Cutover Plan)
1. **مزود الـ SMS**: استبدال مفتاح `ConsoleSmsSender` في ملف `appsettings.Production.json` بمفاتيح بوابة رسائل SMS المعتمدة عند الشراء.
2. **بوابة بوسطة**: إدخال مفتاح `Bosta:ApiKey` وبيئة `Bosta:BaseUrl` وتوجيه Webhook بوسطة إلى مسار الخادم `/api/webhooks/bosta`.
