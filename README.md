# Egyptian Marketplace Platform (منصة السوق المصري المتكاملة)

منصة تجارة إلكترونية متكاملة مصممة خصيصاً لتلبية متطلبات السوق المصري وتجربة المستخدم المحلية، مع الامتثال الكامل لقانون حماية البيانات الشخصية المصري (PDPL 151/2020) وأنظمة الدفع عند الاستلام (COD)، وإدارة المتاجر المتعددة، والتحقق البيومتري.

---

## 📁 هيكل المشروع المقسم (Monorepo Architecture)

المشروع منظم ومقسم بعناية إلى ثلاث ركائز أساسية، كل جزء في مجلده المخصص مع توثيقه المستقل:

```text
marketplace/
├── 📂 backend/                      # خادم واجهة البرمجيات (.NET 10 Web API)
│   ├── Marketplace.API/             # واجهات التحكم وميدلوير الأمان والتسجيل
│   ├── Marketplace.Application/     # منطق الأعمال وDTOs وخدمات التحقق
│   ├── Marketplace.Domain/          # الكيانات الجوهرية (Entities) والتعدادات
│   ├── Marketplace.Infrastructure/  # طبقة البيانات (EF Core) واتصالات PostgreSQL
│   ├── Marketplace.Tests/           # اختبارات الوحدة القياسية xUnit
│   ├── tests/                       # اختبارات التكامل ضد PostgreSQL الحقيقية
│   ├── Marketplace.slnx             # ملف الحل الرئيسي
│   └── README.md                    # 📖 التوثيق الكامل للباك إند
│
├── 📂 admin-web/                    # لوحة تحكم الإدارة وبوابة التجار (React 19 + Vite)
│   ├── src/
│   │   ├── api/                     # خدمات استدعاء API الموثقة
│   │   ├── components/              # مكونات الواجهة والجداول ومؤشرات الأداء
│   │   ├── pages/                   # صفحات الإدارة وبوابة التجار والمصادقة
│   │   ├── locales/                 # الترجمة (العربية RTL افتراضياً والإنجليزية)
│   │   └── context/                 # إدارة حالة الجلسة والأمان
│   ├── tests/                       # اختبارات أمان الويب والبناء
│   └── README.md                    # 📖 التوثيق الكامل للوحة الويب
│
├── 📂 mobile/                       # تطبيق الهاتف الذكي (React Native / Expo 58)
│   ├── src/
│   │   ├── api/                     # عميل الشبكة الموثق
│   │   ├── components/              # عناصر وتصميم الشاشات
│   │   ├── navigation/              # مسارات المشتري والتاجر
│   │   ├── screens/                 # شاشات التسوق والطلبات والملف الشخصي
│   │   └── utils/                   # القفل البيومتري والتخزين الآمن
│   └── README.md                    # 📖 التوثيق الكامل لتطبيق الموبايل
│
├── 📂 scripts/                      # سكربتات الأتمتة والاختبارات الشاملة والنسخ الاحتياطي
│   ├── run-all-tests.ps1            # تشغيل جميع أجنحة الاختبارات الـ 18
│   ├── backup-db.ps1                # أتمتة النسخ الاحتياطي لقاعدة البيانات
│   ├── restore-drill.ps1            # اختبار استعادة الكوارث وتدقيق الجداول
│   └── generate-sbom.js             # توليد وثائق وتتبع حزم التبعيات (SBOM)
│
├── 📂 tests/                        # تقارير ونتائج الاختبارات الشاملة (RESULTS.md)
├── 📂 docs/                         # الوثائق المعمارية، التدقيق الأمني، وتقارير الفحص
└── AGENTS.md                        # القواعد والمعايير الصارمة لإدارة وتطوير المشروع
```

---

## ⚡ البداية السريعة لكل جزء (Quick Start)

### 1️⃣ الباك إند (Backend API):
> يتطلب **.NET 10 SDK** وقاعدة بيانات **PostgreSQL 16+**.
```powershell
cd backend
dotnet restore Marketplace.slnx
dotnet run --project Marketplace.API
```
- الرابط المحلي: `http://localhost:5209`
- فحص الجاهزية: `http://localhost:5209/api/health`
- وثائق Swagger: `http://localhost:5209/swagger`
- لمزيد من التفاصيل، راجع: [توثيق الباك إند](file:///d:/Backend/marketplace/backend/README.md).

---

### 2️⃣ لوحة تحكم الويب (Admin & Seller Portal):
> يتطلب **Node.js v20+**.
```powershell
cd admin-web
npm install
npm run dev
```
- الرابط المحلي: `http://localhost:3000`
- لمزيد من التفاصيل، راجع: [توثيق الويب](file:///d:/Backend/marketplace/admin-web/README.md).

---

### 3️⃣ تطبيق الموبايل (Mobile App):
> يتطلب **Node.js v20+** وتطبيق **Expo Go** أو محاكي.
```powershell
cd mobile
npm install
npx expo start
```
- اضغط `a` لتشغيل أندرويد أو `i` لتشغيل iOS أو امسح كود QR عبر تطبيق Expo Go.
- لمزيد من التفاصيل، راجع: [توثيق الموبايل](file:///d:/Backend/marketplace/mobile/README.md).

---

## 🗄️ إعداد وتجهيز قاعدة البيانات (Database Setup)

> **قاعدة أمان صارمة:** لا تقم أبداً بتشغيل عمليات التحديث المباشر (`dotnet ef database update`) على قاعدة بيانات إنتاجية. العمل يتم عبر توليد سكربتات SQL ومراجعتها وتطبيقها يدوياً.

### 1. إنشاء قواعد البيانات في PostgreSQL:
```sql
CREATE DATABASE "MarketplaceMVP";
CREATE DATABASE "MarketplaceMVP_test";
```

### 2. توليد وتطبيق سكربت المايجريشن (EF Core Migrations):
```powershell
dotnet ef migrations script --project backend/Marketplace.Infrastructure/Marketplace.Infrastructure.csproj --startup-project backend/Marketplace.API/Marketplace.API.csproj -o migrations.sql

# تطبيق السكربت عبر psql:
psql -h localhost -U postgres -d MarketplaceMVP -f migrations.sql
psql -h localhost -U postgres -d MarketplaceMVP_test -f migrations.sql
```

### 3. متغيرات البيئة للاختبارات:
```powershell
$env:TEST_DB = "Host=localhost;Port=5432;Database=MarketplaceMVP_test;Username=postgres;Password=YOUR_PASSWORD"
```

---

## 🧪 الاختبارات وضمان الجودة (Quality Assurance)

| نوع الاختبار | المسار والأمر | الغرض |
| :--- | :--- | :--- |
| **Unit Tests (xUnit)** | `dotnet test backend/Marketplace.slnx` | فحص منطق الأعمال، التشفير، ودقة الحسابات المالية |
| **Full Suite (18 Suites)** | `powershell -File scripts/run-all-tests.ps1` | اختبار شامل لكل مسارات الـ API والأمان وتكامل قاعدة البيانات |
| **Web Security Tests** | `npm --prefix admin-web test` | التحقق من أمان المتصفح (XSS, CSRF, Token Storage) |
| **Mobile Integrity** | `node mobile/tests/test_exports_integrity.js` | التحقق من تكامل مكونات تطبيق الموبايل وشاشاته |
| **i18n Translation Audit** | `node mobile/scripts/check-i18n.js` | التأكد من تطابق مفاتيح الترجمة (العربية والإنجليزية 100%) |

---

## 💾 النسخ الاحتياطي واستعادة الكوارث (Disaster Recovery)

- **أخذ نسخة احتياطية:**
  ```powershell
  powershell -ExecutionPolicy Bypass -File scripts/backup-db.ps1
  ```
- **تمرين استعادة الكوارث الدوري (DR Drill):**
  ```powershell
  powershell -ExecutionPolicy Bypass -File scripts/restore-drill.ps1
  ```

---

## 🔒 معايير الأمان والامتثال القانوني (Security & PDPL)

1. **الامتثال لقانون حماية البيانات المصري (PDPL Law 151/2020):**
   - حجب فوري للبيانات الحساسة وأكواد التحقق في السجلات (`LogMasking`).
   - دعم كامل لتصدير بيانات المستخدم (`Data Export`) وحذف الحسابات وفق القانون.
2. **المصادقة والأمان الثنائي (TOTP 2FA):**
   - إجبار الإدارة على التحقق بخطوتين وتشفير المفاتيح في قاعدة البيانات بخوارزمية `AES-256-GCM`.
3. **أمان البيومترك على الموبايل:**
   - قفل داخلي للشاشات الحساسة (`UnlockScreen`) مع تخزين التوكن مشفراً داخل `expo-secure-store`.
4. **حوكمة الميزات المالية:**
   - ميزات المحفظة والسحوبات معطلة افتراضياً (`Features:EnableWallet: false`) حتى اكتمال الموافقات القانونية والمحاسبية.
