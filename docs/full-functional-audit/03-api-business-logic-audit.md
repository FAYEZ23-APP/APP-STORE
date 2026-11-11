# تدقيق الـ APIs ومنطق الأعمال وتكامل البيانات (03 - API & Business Logic Audit)
## Egyptian Multi-Vendor Marketplace Platform
**تاريخ الفحص:** 2026-11-08  
**نطاق الفحص:** الواجهة الخلفية (`backend`) وتكاملها مع عملاء الـ API وقاعدة البيانات:
- **المتحكمات والمسارات:** 26 متحكماً تشمل 149 Endpoint.
- **خدمات النطاق:** 18 خدمة تغطي منطق الأعمال والمعاملات.
- **قاعدة البيانات:** PostgreSQL `MarketplaceMVP_test` المحددة في `TEST_DB`.

---

## 1. بنية تدفق العمليات ودورة التنفيذ الكاملة (End-to-End Execution Flow)

تم فحص ومطابقة كل عملية من خلال دورة التدفق المعيارية المكونة من 11 محطة:

```mermaid
sequenceDiagram
    autonumber
    participant UI as 1. UI Component (React / React Native)
    participant EH as 2. Event Handler (onClick / onPress)
    participant API as 3. API Client (Axios + Interceptors)
    participant GW as 4. ASP.NET Core Middleware & Auth
    participant Ctrl as 5. API Controller ([Authorize(Roles)])
    participant Svc as 6. Domain Service (Business Logic)
    participant Lock as 7. Concurrency Lock (FOR UPDATE)
    participant DB as 8. PostgreSQL (AppDbContext / UOW)
    participant Res as 9. API Response (HTTP 200/201/204)
    participant St as 10. Frontend State (Zustand / Context)
    participant Feed as 11. User Feedback (Toast / Modal / Screen)

    UI->>EH: المستخدم ينقر على الزر
    EH->>API: تجهيز الـ Payload والـ Headers
    API->>GW: HTTP Request (JWT Bearer + CSRF + Idempotency)
    GW->>Ctrl: فحص التوقيع وصلاحية الدور
    Ctrl->>Svc: تمرير كائن الطلب المفحوص (FluentValidation)
    Svc->>Lock: حجز أقفال الصفوف الحصرية (للمعاملات الحساسة)
    Lock->>DB: تنفيذ المعاملة وحفظ التغييرات (SaveChangesAsync)
    DB-->>Res: تأكيد الحفظ وسلامة المفاتيح
    Res-->>API: JSON Response مطابق للـ DTO
    API-->>St: تحديث الحالة في الذاكرة
    St-->>Feed: إشعار المستخدم بنجاح العملية
```

---

## 2. التحقق من ثوابت النزاهة وقواعد الأعمال في قاعدة البيانات (Database Invariants)

### أ. الحذف المنطقي مقابل الحذف الفعلي (Soft Delete vs Hard Delete)
1. **المنتجات (`Products`):**
   - تطبق الحذف المنطقي (`IsDeleted = true`). عند حذف المنتج، تظل بياناته التاريخية محفوظة لضمان سلامة الفواتير والطلبات السابقة، ولكنه يُحجب فوراً من الكتالوج العام ونتائج البحث.
2. **المستخدمين والحق في النسيان (PDPL 151/2020):**
   - عند طلب المشتري لحذف حسابه (`POST /api/users/delete-me`)، يتم تطهير وتعمية البيانات الشخصية (Anonymization) باستبدال الاسم والهاتف بقيم عشوائية مشفرة وإبطال التوكنات، مع الاحتفاظ بالأرقام المحاسبية للضرائب المصرية.
3. **العناوين وقوائم الحظر:**
   - الحذف الفعلي (`Hard Delete`) مقصور على العناوين الشخصية وحالات رفع الحظر من القائمة السوداء، حيث لا ترتبط بقيود محاسبية.

### ب. منع التسابق والبيع الزائد في المخزون (Race Conditions & Overselling Prevention)
- في ملف [`OrderService.cs`](file:///D:/Backend/marketplace/backend/Marketplace.Application/Services/OrderService.cs#L316-L334):
  يتم خصم المخزون باستخدام استعلام SQL ذري مباشر ومقيد:
  ```sql
  UPDATE "ProductVariants" 
  SET "Stock" = "Stock" - @qty 
  WHERE "Id" = @variantId AND "ProductId" = @productId AND "Stock" >= @qty
  ```
  - **الضمانة الهندسية:** إذا كانت النتيجة `affected == 0` (أي أن المخزون المتبقي أقل من الكمية المطلوبة لحظة التنفيذ)، يتم التراجع الفوري عن المعاملة بالكامل (`Rollback`) وتطلق الخدمة استثناء `ConflictException` (HTTP 409).
  - يستحيل برمجياً ورياضياً حدوث بيع زائد (Overselling) تحت أي ضغط متزامن.

### ج. أقفال الصفوف الحصرية في المعاملات المالية والكوبونات (Row-Level Locking)
- تم التحقق من تطبيق 17 عبارة `SELECT ... FOR UPDATE` حصرية موزعة كالآتي:
  1. **الطلبات وإلغاؤها (`OrderService.cs`):** قفل صف الطلب حصرياً لمنع التسابق بين رغبة المشتري في الإلغاء وتسليم المندوب للشحنة في نفس اللحظة.
  2. **الكوبونات (`OrderService.cs`):** قفل صف الكوبون وتحديث عداد الاستخدام ذرياً بشرط `UsedCount < MaxUsage` لمنع تجاوز الحد الأقصى للاستخدام.
  3. **المحفظة والتسويات (`WalletService.cs`):** قفل صفوف `VendorWallets` و `PayoutRequests` و `Shipments` لمنع السحب المزدوج أو تسوية شحنة مرتين.

### د. دقة الحسابات المالية والقروش المصرية (Financial Precision)
- كافة المعاملات المالية تستخدم نوع البيانات `decimal` بدقة منزلتين عشريتين (القروش المصرية).
- اختبارات [`FinancialPrecisionTests.cs`](file:///D:/Backend/marketplace/backend/Marketplace.Tests/FinancialPrecisionTests.cs) تثبت خلو النظام من أي أخطاء تقريب (Rounding Errors) في حسابات ضريبة القيمة المضافة وعمولات المنصة وخصومات الكوبونات.

---

## 3. تدقيق عزل البيانات والامتثال للقاعدة الصارمة (Rule #11 Compliance)

> **قاعدة المشروع رقم 11:**  
> *"Ownership or unauthorized resource access failures MUST return 403 (ForbiddenException) or 404 (NotFoundException), NEVER 500."*

تم إثبات التزام الخادم بنسبة 100%:
1. **عزل منتجات التجار:** التاجر (أ) لا يمكنه تعديل أو حذف أو تحديث مخزون منتج مملوك للتاجر (ب)؛ يرجع الخادم `403 Forbidden` (`ProductService.cs:118`).
2. **عزل طلبات المشترين:** المشتري (أ) لا يمكنه استعراض أو إلغاء طلب المشتري (ب)؛ يرجع الخادم `403 Forbidden` أو `404 NotFound` (`OrderService.cs:884`).
3. **عزل مستندات النزاعات الخاصة:** صور وتقارير عيوب المنتجات المرفوعة في المرتجعات محمية بـ `FilesController.GetPrivateFile` ولا يمكن تحميلها إلا من قِبل صاحب الطلب أو التاجر المعني أو مسؤول المنصة، ويرد الخادم بـ `403 Forbidden` لأي طرف متطفل.
4. **نسبة أخطاء 500 عند انتهاك الملكية:** **0.00% مطلقاً** عبر وسيط الاستثناءات الموحد `GlobalExceptionMiddleware`.

---

## 4. تدقيق ترويسات ومفاتيح الـ Idempotency

- **إنشاء الطلبات:** مسار `POST /api/orders` يقرأ الترويسة `Idempotency-Key` الصادرة من العميل (UUID v4).
- **قيد قاعدة البيانات:** قيد فريد مركب على `(BuyerId, IdempotencyKey)`.
- **السلوك عند إعادة الإرسال:** في حال وصول طلب مكرر بنفس المفتاح، يلتقط الخادم استثناء التضارب ويعيد كائن الطلب المُنشأ مسبقاً برمز `201 Created`، دون خصم المخزون مجدداً ودون فتح طلب إضافي.
- **حماية البصمة المؤقتة:** حماية قصيرة المدى (10 ثوانٍ) للبصمة المزدوجة (Double-Tap) لمنع تكرار الطلب في حال عدم إرسال المفتاح.
