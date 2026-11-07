# قائمة التحقق للنشر والتشغيل الفعلي (Production Deployment Checklist)

> **المشروع**: سوق مصر للتجارة الإلكترونية متعدد التجار (Marketplace MVP)  
> **تاريخ التقييم**: 2026-11-02  
> **الحالة**: إرشادات تشغيلية صارمة لبيئة الإنتاج الحية (Live Cutover Procedures)  
> **وسوم التوثيق**: `[V]` مثبت بأمر أو قراءة كود مباشر | `[I]` استنتاج تحليلي مسبب | `[G]` معيار هندسي عام

---

## 1. مرحلة ما قبل النشر (Pre-Deployment Phase)

- [ ] **1. النسخ الاحتياطي الكامل لقاعدة البيانات (Full Backup)**:
  - أخذ نسخة احتياطية فورية لبيانات `MarketplaceMVP` قبل أي إجراء:
    ```bash
    pg_dump -h localhost -U postgres -d MarketplaceMVP -F c -b -v -f backup_MarketplaceMVP_pre_wave123.dump
    ```
- [ ] **2. تشغيل سكربت الفحص المسبق لأمان الهجرة (Preflight Verification)**:
  - تنفيذ السكربت الآمن للقراءة فقط:
    ```bash
    psql -h localhost -U marketplace_admin -d MarketplaceMVP -f scripts/audit2/preflight-check.sql
    ```
  - التأكد من عدم وجود استعلامات معلقة تزيد عن 5 ثوانٍ، والتأكد من مطابقة إصدار PostgreSQL.
- [ ] **3. تطبيق كود هجرة التعديلات الصافي يدparamياً (Apply Database Migration)**:
  - تنفيذ سكربت الهجرة غير التكراري المحمي بالمعاملة الكاملة ومهلة القفل 5 ثوانٍ:
    ```bash
    psql -h localhost -U marketplace_admin -d MarketplaceMVP -f scripts/audit2/wave123-migration.sql
    ```
  - التحقق من نجاح إدخال سجل الهجرة `20261102000426_AddGapsRemediationWave123` في `__EFMigrationsHistory`.
- [ ] **4. تكوين المتغيرات البيئية الإنتاجية الحساسة (Environment Variables)**:
  - التأكد من عدم وضع أسرار داخل كود المصدر أو الـ Git:
    - `ConnectionStrings__DefaultConnection`: استخدام مستخدم محدود الصلاحيات (`marketplace_app_user`) وليس السوبريوزر `postgres`.
    - `Jwt__Key`: مفتاح تشفير عشوائي آمن بطول لا يقل عن 32 حرفاً.
    - `Security__TwoFactorEncryptionKey`: مفتاح تشفير أسرار الـ 2FA (32 بايت).
    - `Admin__Email` و `Admin__Password`: لتهيئة حساب الإدارة الرئيسي.
    - `Admin__Require2FA`: تفعيلها إلى `true` في بيئة الإنتاج الحية.

---

## 2. مرحلة نشر المكونات البرمجية (Deployment Phase)

- [ ] **1. نشر الباك إند (.NET 10 API)**:
  - بناء المشروع بصيغة Release:
    ```bash
    dotnet publish backend/Marketplace.API/Marketplace.API.csproj -c Release -o /var/www/marketplace-api
    ```
  - إعادة تشغيل خدمة `systemd` أو حاوية Docker الخاصة بالتطبيق:
    ```bash
    sudo systemctl restart marketplace-api
    ```
- [ ] **2. نشر لوحة تحكم الويب (Admin Web Portal)**:
  - بناء حزم React/Vite الإنتاجية:
    ```bash
    cd admin-web && npm run build
    ```
  - مزامنة مجلد `dist/` مع خادم الويب (Nginx) وتفعيل التخزين المؤقت للأصول الثابتة (`assets/`).
- [ ] **3. تطبيق الموبايل (Mobile App)**:
  - التحقق من نجاح فحص الترجمة `node mobile/scripts/check-i18n.js` (1084 مفتاحاً متطابقاً بنسبة 100%).
  - بناء تطبيق الأندرويد والـ iOS عبر Expo EAS Build وتوجيه مسار `API_URL` لنطاق الإنتاج المشفر (HTTPS).

---

## 3. مرحلة ما بعد النشر والفحص السريع (Post-Deployment Smoke Tests)

- [ ] **1. فحص نقطة الصحة (Health Check Endpoint)**:
  - طلب `GET /health` والتأكد من استجابة `200 OK` والاتصال السليم بقاعدة البيانات.
- [ ] **2. تسجيل دخول الأدمن والتأكد من لوحة الشحن**:
  - فتح لوحة الأدمن، فحص تبويب الشحنات الجديد (`activeTab === 'shipments'`) والتأكد من ظهور البيانات دون أخطاء.
- [ ] **3. تجربة تصفح الزائر وإضافة منتج للسلة**:
  - تصفح المتجر بالموبايل والويب دون تسجيل دخول، والتأكد من عرض شارة "معاينة الطرد عند الاستلام أمام المندوب".
