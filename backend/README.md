# Egyptian Marketplace - Backend API (.NET 10)

خادم واجهة البرمجيات (Backend API) لمنصة السوق المصري، مبني باستخدام أحدث إصدارات **.NET 10** و **C# 14** و **Entity Framework Core** مع قاعدة بيانات **PostgreSQL**.

---

## 🏗️ المعمارية النظيفة (Clean Architecture)

المشروع مقسم إلى طبقات معمارية واضحة ومفصولة المسؤوليات:

```text
backend/
├── Marketplace.API/            # واجهة API ومحركات التحكم (Controllers) وميدلوير الأمان
├── Marketplace.Application/    # منطق الأعمال (Business Logic)، الخدمات، DTOs، وقواعد التحقق
├── Marketplace.Domain/         # الكيانات الجوهرية (Entities)، التعدادات (Enums)، واستثناءات الدومين
├── Marketplace.Infrastructure/ # مستودعات البيانات (Repositories)، اتصالات PostgreSQL، والتشفير
├── Marketplace.Tests/          # اختبارات الوحدة القياسية xUnit
├── tests/                      # اختبارات التكامل ضد PostgreSQL الحقيقية
├── reports/                    # تقارير فحص الأمان واختبارات المراحل
├── Marketplace.slnx            # ملف الحل الرئيسي لـ .NET
└── Dockerfile                  # ملف البناء والحاويات للنشر
```

---

## 🛠️ المتطلبات التقنية (Prerequisites)

- **.NET 10 SDK** (الإصدار `10.0.100` أو أحدث)
- **PostgreSQL** (الإصدار `16+`)
- أداة **dotnet-ef**:
  ```powershell
  dotnet tool install --global dotnet-ef
  ```

---

## ⚙️ التثبيت والتشغيل المحلي (Setup & Run)

### 1. استعادة الحزم (Restore Packages):
```powershell
cd backend
dotnet restore Marketplace.slnx
```

### 2. إعداد قاعدة البيانات والمايجريشن (Database Migrations):
> **تنبيه أمني:** لا تقم بتشغيل `dotnet ef database update` مباشرة على قواعد بيانات حقيقية. قم بتوليد سكربت SQL وتطبيقه:
```powershell
# توليد سكربت الهجرات بالكامل
dotnet ef migrations script --project Marketplace.Infrastructure --startup-project Marketplace.API -o apply_migrations.sql

# تطبيق السكربت على قاعدة البيانات (PostgreSQL)
psql -h localhost -U postgres -d MarketplaceMVP -f apply_migrations.sql
```

### 3. إعداد متغيرات الاتصال والإعدادات:
تأكد من إعداد سلسلة الاتصال داخل `Marketplace.API/appsettings.json` أو كمتغير بيئة:
```json
"ConnectionStrings": {
  "DefaultConnection": "Host=localhost;Port=5432;Database=MarketplaceMVP;Username=postgres;Password=YOUR_PASSWORD"
}
```

### 4. تشغيل خادم الـ API:
```powershell
dotnet run --project Marketplace.API
```
- المنفذ الافتراضي للتطوير: `http://localhost:5209`
- فحص الجاهزية (Health Check): `GET http://localhost:5209/api/health`
- واجهة وثائق Swagger (في بيئة Development فقط): `http://localhost:5209/swagger`

---

## 🧪 الاختبارات (Testing)

### 1. اختبارات الوحدة القياسية (xUnit):
```powershell
dotnet test Marketplace.slnx
```

### 2. اختبارات التكامل ضد قاعدة بيانات PostgreSQL:
```powershell
$env:TEST_DB = "Host=localhost;Port=5432;Database=MarketplaceMVP_test;Username=postgres;Password=YOUR_PASSWORD"
node test_verification_pack_postgres.js
```

---

## 🔒 معايير الأمان المطبقة (Security Standards)

- **حماية البيانات الشخصية (PDPL Law 151/2020):** حجب الهواتف والإيميلات وأكواد التحقق في السجلات (`LogMaskingMiddleware`).
- **المصادقة المشددة:** JWT مع Refresh Token Rotation، والتحقق بخطوتين (TOTP 2FA) مشفر بـ `AES-256-GCM`.
- **حماية المراسلات:** حماية ضد هجمات CSRF، وتحديد معدل الطلبات (Rate Limiting)، والتحقق من حجم ونوعية الملفات المرفوعة.
- **الحوكمة المالية:** تعطيل ميزات الأموال الحقيقية (المحفظة / سحوبات التجار / الكوبونات) افتراضياً بانتظار الاعتماد القانوني والمحاسبي.
