# تقرير الفحص المسبق لأمان هجرة قاعدة البيانات (Database Migration Preflight Report)

> **المشروع**: سوق مصر للتجارة الإلكترونية متعدد التجار (Marketplace MVP)  
> **المرحلة**: المرحلة الثامنة – فحص الجاهزية للتشغيل الفعلي وأمان الإنتاج (Phase 8 Production Readiness)  
> **ملف الهجرة المستهدف**: [`scripts/audit2/wave123-migration.sql`](file:///d:/Backend/marketplace/scripts/audit2/wave123-migration.sql)  
> **سكربت الفحص المسبق المنشأ**: [`scripts/audit2/preflight-check.sql`](file:///d:/Backend/marketplace/scripts/audit2/preflight-check.sql)  
> **قاعدة البيانات الإنتاجية**: `MarketplaceMVP` (لم يتم المساس بها أو التعديل عليها إطلاقاً) [V]  
> **بيئة الاختبار والتحقق**: PostgreSQL `MarketplaceMVP_test` [V]  
> **وسوم التوثيق**: `[V]` مثبت بأمر أو قراءة كود مباشر | `[I]` استنتاج تحليلي مسبب | `[G]` معيار هندسي عام

---

## 1. الفحص المسبق لملف الهجرة والاتساق مع EF Core

### أ. تطابق ملف الهجرة مع لقطة النموذج (Model Snapshot Consistency)
- تم فحص كود الهجرة C# في [`20261102000426_AddGapsRemediationWave123.cs`](file:///d:/Backend/marketplace/backend/Marketplace.Infrastructure/Data/Migrations/20261102000426_AddGapsRemediationWave123.cs) ومقارنته مع [`AppDbContextModelSnapshot.cs`](file:///d:/Backend/marketplace/backend/Marketplace.Infrastructure/Data/Migrations/AppDbContextModelSnapshot.cs) [V].
- **الحقول الجديدة المسجلة في لقطة النموذج**:
  - `Users.CodRefusalCount` (`int`, افتراضي 0) [V]
  - `Shipments.AllowInspection` (`bool`, افتراضي true) [V]
  - `Shipments.BuildingNumber`, `Floor`, `Apartment`, `Landmark` (`varchar(50)` / `varchar(250)`) [V]
  - `Shipments.DeliveryLatitude`, `DeliveryLongitude` (`double precision`) [V]
  - `Shipments.EscrowReleaseAt` (`timestamp with time zone`) [V]
  - `ReturnRequests.Status` (توسيع الطول من `varchar(20)` إلى `varchar(30)`) [V]
  - `ReturnRequests.Category` (`varchar(50)`, افتراضي 'Standard14Day') [V]
  - `ReturnRequests.ReceivedAt` (`timestamp with time zone`) [V]
  - `Products.AllowInspection` (`bool`, افتراضي true) [V]
  - `Orders.BuildingNumber`, `Floor`, `Apartment`, `Landmark`, `DeliveryLatitude`, `DeliveryLongitude` [V]
  - `Orders.IsBuyerConfirmed` (`bool`, افتراضي false) [V]
  - `Orders.ConfirmedAt` (`timestamp with time zone`) [V]
- **النتيجة**: تطابق تام 100% بين كيانات المجال (`Domain Entities`)، إعدادات `AppDbContext.OnModelCreating`، لقطة النموذج `ModelSnapshot`، وسجل الهجرات [V].

---

## 2. تحليل مخاطر الأقفال وتأثير الهجرة على الأداء (Locking & Table Execution Risks)

| الجدول | التعديل | نوع القفل في PostgreSQL | هل يتطلب إعادة كتابة الجدول؟ (Rewrite Table) | مدة التنفيذ المتوقعة | تصنيف الخطورة |
| :--- | :--- | :--- | :---: | :---: | :---: |
| **`Users`** | إضافة `CodRefusalCount` بقيمة افتراضية 0 | `ACCESS EXCLUSIVE` | **لا (O(1) في PG 11+)** [G] | < 5 مللي ثانية | **LOW** |
| **`Shipments`** | إضافة 8 أعمدة عنوان وضمان ومعاينة | `ACCESS EXCLUSIVE` | **لا (O(1) في PG 11+)** [G] | < 10 مللي ثانية | **LOW** |
| **`ReturnRequests`** | تغيير نوع `Status` من `varchar(20)` إلى `varchar(30)` | `ACCESS EXCLUSIVE` | **لا (تعديل Metadata فقط)** [G] | < 5 مللي ثانية | **LOW** |
| **`ReturnRequests`** | إضافة `Category` و `ReceivedAt` | `ACCESS EXCLUSIVE` | **لا (O(1) في PG 11+)** [G] | < 5 مللي ثانية | **LOW** |
| **`Products`** | إضافة `AllowInspection` بقيمة افتراضية `true` | `ACCESS EXCLUSIVE` | **لا (O(1) في PG 11+)** [G] | < 5 مللي ثانية | **LOW** |
| **`Orders`** | إضافة 8 أعمدة عنوان مصري وتأكيد طلب | `ACCESS EXCLUSIVE` | **لا (O(1) في PG 11+)** [G] | < 10 مللي ثانية | **LOW** |

### إجراءات الحماية المطبقة في السكربت ضد تجميد الاستعلامات (Lock Timeout Protection):
- تمت إضافة الأمر الصريح `SET lock_timeout = '5s';` في بداية معاملة الهجرة في [`wave123-migration.sql`](file:///d:/Backend/marketplace/scripts/audit2/wave123-migration.sql) [V].
- إذا وجد استعلام بطيء يعمل على أي من هذه الجداول، يفشل أمر الترحيل فوراً بعد 5 ثوانٍ ويلغي القفل تلقائياً بدلاً من التسبب في طابور انتظار طويل (Lock Queue Convoy) يعطل حركة المتجر [V].

---

## 3. التعامل الآمن مع الترحيلات الجزئية (Safe Handling of Partial Applications)

- تم تغليف كافة أوامر إضافة الأعمدة بصيغة `ADD COLUMN IF NOT EXISTS` داخل كتل الشرط `DO $EF$ BEGIN IF NOT EXISTS...` [V].
- **ميزة الأمان**: إذا كان أحد الأعمدة قد تمت إضافته يدوياً أو انقطعت المعاملة في محاولة سابقة، فلن يتوقف السكربت بخطأ `column already exists`، بل سيتجاوزه بأمان ويكمل تسجيل الهجرة في جدول التاريخ `__EFMigrationsHistory` [V].
- المعاملة محاطة بـ `START TRANSACTION;` و `COMMIT;` بالكامل، مما يضمن في PostgreSQL التراجع الذري الكامل في حال حدوث أي خطأ نحوي أو انقطاع في الاتصال [V].

---

## 4. سكربت التحقق المسبق (Preflight SQL Script)

تم إنشاء السكربت للقراءة فقط في [`scripts/audit2/preflight-check.sql`](file:///d:/Backend/marketplace/scripts/audit2/preflight-check.sql) لتشغيله عبر `psql` قبل تطبيق أي ترحيل:

```sql
-- تشغيل السكربت في بيئة الإنتاج:
-- psql -U marketplace_admin -d MarketplaceMVP -f scripts/audit2/preflight-check.sql
```

يقوم السكربت بفحص:
1. إصدار PostgreSQL والتأكد أنه 11 فما فوق (يدعم إضافة الأعمدة ذات القيم الافتراضية بدون Table Rewrite).
2. وجود الهجرة السابقة `20261101231814_AddWalletAndPayoutConcurrencyTokens` في `__EFMigrationsHistory`.
3. التأكد من عدم تطبيق الهجرة مسبقاً لمنع التكرار غير المقصود.
4. التحقق من سلامة الجداول الخمسة الأساسية قبل أي تعديل.
5. التحقق من عدم وجود معاملات نشطة عالقة تزيد مدتها عن 5 ثوانٍ لتجنب Lock Deadlocks.

---

## 5. الخلاصة والتوصية الهندسية
- **حالة الجاهزية**: **جاهز للتطبيق اليدوي بأمان تام (Production Ready)**.
- **التصنيف**: **LOW RISK** (خالٍ من إعادة كتابة الجداول، محمي بمهلة قفل 5 ثوانٍ، وغير تكراري بالكامل).
