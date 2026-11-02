# Egyptian Marketplace Platform (منصة السوق المصري)

منصة تجارة إلكترونية متكاملة مصممة خصيصاً لتلبية متطلبات السوق المصري وتجربة المستخدم المحلية، مع الامتثال الكامل لقانون حماية البيانات الشخصية المصري (PDPL 151/2020) وأنظمة الدفع عند الاستلام (COD) والتقييم والتحقق البيومتري.

---

## 📁 هيكل المشروع (Project Architecture)

```text
marketplace/
├── backend/                       # .NET 10 Web API Backend
│   ├── Marketplace.API/                  # واجهات API والتحكم والإعدادات وميدلوير الأمان
│   ├── Marketplace.Application/          # منطق الأعمال والخدمات وDTOs وقواعد التحقق
│   ├── Marketplace.Domain/               # الكيانات الجوهرية (Entities) والتعدادات
│   ├── Marketplace.Infrastructure/       # اتصالات PostgreSQL والتشفير والمستودعات
│   ├── Marketplace.Tests/                # مشروع اختبارات C# القياسي (xUnit)
│   ├── tests/                            # اختبارات التكامل والتحقق ضد PostgreSQL
│   └── Marketplace.slnx                  # ملف الحل
│
├── admin-web/                     # Next.js 16 (App Router) لوحة تحكم الإدارة
│   ├── app/                              # مسارات لوحة التحكم (المستخدمين، الشحنات، المراجعات، المالية)
│   ├── components/                       # مكونات واجهة الإدارة وجداول البيانات
│   ├── lib/                              # خدمات API والتوثيق والتحقق من الجلسات
│   └── package.json
│
├── mobile/                        # تطبيق الموبايل (React Native / Expo)
│   ├── src/
│   │   ├── api/                          # خدمات استدعاء API الموثقة
│   │   ├── components/                   # مكونات الواجهة وتجربة المستخدم
│   │   ├── context/                      # إدارة حالة التوثيق، القفل البيومتري، والسلة
│   │   ├── locales/                      # الترجمة (العربية RTL افتراضياً والإنجليزية)
│   │   ├── navigation/                   # مسارات التنقل (المشتري، البائع، الإدارة)
│   │   ├── screens/                      # شاشات التطبيق
│   │   └── utils/                        # تطبيع الهواتف، التخزين الآمن، ومفاتيح البيومترك
│   └── package.json
│
├── scripts/                       # سكربتات التشغيل والأتمتة والنسخ الاحتياطي
│   ├── run-all-tests.ps1                 # مشغل حزمة الاختبارات الشاملة (18 جناحاً)
│   ├── backup-db.ps1                     # أتمتة النسخ الاحتياطي لقاعدة بيانات PostgreSQL
│   ├── restore-drill.ps1                 # تجربة استعادة النسخ الاحتياطي والتحقق من الجداول
│   └── check-i18n.js                     # تدقيق تطابق ملفات الترجمة (عربي/إنجليزي)
│
└── docs/                          # وثائق التدقيق والأمان والتقارير الشاملة
```

---

## ⚙️ المتطلبات المسبقة (Prerequisites)

1. **.NET 10 SDK** (الإصدار `10.0.100` أو أحدث)
2. **Node.js** (الإصدار `v20.x` أو `v24.x`) مع مدير الحزم `npm`
3. **PostgreSQL** (الإصدار `16` أو `17` أو `18`)
4. **PowerShell 7+** أو Windows PowerShell 5.1
5. **Git** لإدارة الإصدارات

---

## 🗄️ إعداد وتجهيز قاعدة البيانات (Database Setup)

> **قاعدة أمان صارمة:** لا تقم أبداً بتشغيل أي عمليات تحديث أو حذف على قاعدة بيانات إنتاجية. العمل يتم عبر توليد سكربتات المايجريشن وتطبيقها بشكل منظم.

### 1. إنشاء قواعد البيانات في PostgreSQL:
قم بإنشاء قاعدة البيانات الأساسية وقاعدة بيانات الاختبارات:
```sql
CREATE DATABASE "MarketplaceMVP";
CREATE DATABASE "MarketplaceMVP_test";
```

### 2. توليد وتطبيق سكربت المايجريشن (EF Core Migrations):
لتوليد سكربت SQL الكامل لجميع الهجرات (25 هجرة معتمدة):
```powershell
dotnet ef migrations script --project backend/Marketplace.Infrastructure/Marketplace.Infrastructure.csproj --startup-project backend/Marketplace.API/Marketplace.API.csproj -o migrations.sql
```
قم بتطبيق ملف `migrations.sql` على قاعدة البيانات المطلوبة عبر `psql`:
```bash
psql -h localhost -U postgres -d MarketplaceMVP -f migrations.sql
psql -h localhost -U postgres -d MarketplaceMVP_test -f migrations.sql
```

### 3. متغيرات البيئة (Environment Variables):
عيّن سلسلة الاتصال الخاصة ببيئة الاختبار في جلسة العمل:
```powershell
$env:TEST_DB = "Host=localhost;Port=5432;Database=MarketplaceMVP_test;Username=postgres;Password=YOUR_PASSWORD"
```

---

## 🚀 تشغيل مكونات النظام (Running the System)

### 1. تشغيل خادم الباك إند (Backend API):
```powershell
cd backend
dotnet restore Marketplace.slnx
dotnet run --project Marketplace.API
```
- المنفذ الافتراضي في بيئة التطوير: `http://localhost:5209`
- رابط فحص الجاهزية: `GET http://localhost:5209/api/health`
- توثيق Swagger (متاح فقط في بيئة `Development`): `http://localhost:5209/swagger`

### 2. تشغيل لوحة تحكم الإدارة (Admin Web Portal):
```powershell
cd admin-web
npm install
npm run dev
```
- تعمل اللوحة على: `http://localhost:3000`
- تتطلب تسجيل دخول بصلاحية مدير (`Admin`) مع تفعيل التحقق بخطوتين (2FA / TOTP).

### 3. تشغيل تطبيق الموبايل (Mobile App):
```powershell
cd mobile
npm install
npx expo start
```
- يدعم التطبيق العمل على محاكي Android أو iOS أو عبر تطبيق Expo Go.

---

## 🧪 تشغيل الاختبارات الآلية (Testing & Quality Assurance)

### 1. تشغيل اختبارات C# القياسية (xUnit Tests):
مشروع الاختبارات `backend/Marketplace.Tests` يغطي المسارات الجوهرية (تطبيع الهواتف، إخفاء البيانات الحساسة، التشفير المتناظر AES-256-GCM للـ 2FA، تطبيع النصوص العربية، والدقة المالية):
```powershell
dotnet test backend/Marketplace.slnx
```

### 2. تشغيل حزمة الاختبارات الشاملة (All 18 Suites Runner):
يتحقق السكربت من بيئة العمل ضد قاعدة بيانات اختبار حقيقية (`_test`) وينفذ جميع الأجنحة الـ 18:
```powershell
$env:TEST_DB = "Host=localhost;Port=5432;Database=MarketplaceMVP_test;Username=postgres;Password=YOUR_PASSWORD"
powershell -ExecutionPolicy Bypass -File scripts/run-all-tests.ps1
```
- ينتج تقرير نتائج ديناميكي شامل بصيغة UTF-8 في `tests/RESULTS.md`.

### 3. تدقيق أمان الحزم وتطابق الترجمة (Security & i18n Audits):
```powershell
# فحص تطابق مفاتيح الترجمة (العربية والإنجليزية)
node mobile/scripts/check-i18n.js

# فحص أمان لوحة الإدارة ضد هجمات XSS و CSRF والحقن
npm --prefix admin-web run test:security
```

---

## 💾 النسخ الاحتياطي واستعادة الكوارث (Backup & Disaster Recovery)

### 1. أخذ نسخة احتياطية مشفرة ومضغوطة:
يقوم السكربت باكتشاف `pg_dump` تلقائياً وحفظ نسخة احتياطية مضغوطة في مجلد `backups/` مع إخفاء كلمات المرور:
```powershell
powershell -ExecutionPolicy Bypass -File scripts/backup-db.ps1
```

### 2. تنفيذ تمرين استعادة الكوارث المعتمد (Disaster Recovery Drill):
يقوم السكربت باستعادة أحدث نسخة احتياطية داخل قاعدة بيانات تدريبية معزولة (`MarketplaceMVP_restore_test`)، والتحقق من سلامة كافة الجداول (29 جدولاً) والهجرات (25 هجرة)، ثم تنظيف قاعدة التدريب:
```powershell
powershell -ExecutionPolicy Bypass -File scripts/restore-drill.ps1
```

---

## 🔒 معايير الأمان والامتثال القانوني (Security & PDPL Compliance)

1. **حماية البيانات الشخصية (Egyptian PDPL 151/2020):**
   - حجب فوري لأكواد التحقق (`******`)، وأرقام الهواتف، والإيميلات في سجلات النظام (`LogMasking`).
   - إمكانية تصدير كامل بيانات المستخدم (`GET /api/users/me/export-data`) بدون تسريب هاشات التوكن أو كلمات المرور.
   - مسار حذف حساب المشترى الشامل وتطهير بيانات الطلبات الشخصية مع إبقاء المعاملات المالية للضرائب.
2. **عزل الميزات المالية:**
   - تظل ميزات الأموال الحقيقية (`Features:EnableWallet` و `Features:EnableVendorPayouts` و `Features:EnableCoupons`) معطلة افتراضياً (`false`) في كافة البيئات لحين اكتمال التوقيع القانوني والمحاسبي.
3. **أمان المصادقة والبيومترك:**
   - شاشة القفل البيومتري (`UnlockScreen`) تعمل كحماية على مستوى الواجهة، وتخزين الرموز مشفر في `expo-secure-store`.
   - أسرار الـ 2FA للإدارة مشفرة في قاعدة البيانات باستخدام خوارزمية `AES-256-GCM` برمز بادئة `ENC:v1:`.
