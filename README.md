# Egyptian Marketplace Platform (سوق إلكتروني مصري)

مشروع متكامل لمنصة سوق إلكتروني مصممة خصيصاً لتلبية متطلبات السوق المصري وتجربة المستخدم المحلية، مع الامتثال الكامل لقانون حماية البيانات الشخصية المصري (PDPL 151/2020).

---

## 📁 هيكل المشروع (Project Structure)

```
APP-store/
├── backend/                  # .NET 10 Web API Backend
│   ├── Marketplace.API/             # Controllers, Middlewares, Configuration
│   ├── Marketplace.Application/     # Services, DTOs, Business Logic, FluentValidation
│   ├── Marketplace.Domain/          # Domain Entities, Enums
│   ├── Marketplace.Infrastructure/  # EF Core, PostgreSQL, Repositories, Push Notifications
│   ├── tests/                       # API Automated Integration Tests
│   └── Marketplace.slnx             # Solution File
│
└── mobile/                   # React Native (Expo) Mobile Application
    ├── assets/                      # Icons & Splash Screens
    ├── src/
    │   ├── api/                     # Axios API Services (Auth, Products, Orders, Reviews, Coupons, Returns, etc.)
    │   ├── components/              # Shared UI Components (ProductCard, ReviewModal, Badges, etc.)
    │   ├── context/                 # AuthContext & CartContext
    │   ├── locales/                 # Arabic (Primary RTL) & English translations
    │   ├── navigation/              # BuyerTabs, SellerTabs & AppNavigator
    │   ├── screens/                 # Buyer, Seller, Auth, Profile Screens
    │   ├── theme/                   # Brand Colors (Navy, Orange, Clean surfaces)
    │   └── utils/                   # Egyptian Phone, Currency, Notifications, Storage helpers
    ├── App.js
    └── package.json
```

---

## 🚀 المميزات الرئيسية (Core & Competitive Features)

1. **الامتثال للسوق المصري (Egyptian Market Ready):**
   - العملة الرسمية: الجنيه المصري (`ج.م` / `EGP`).
   - دعم كامل للغة العربية والاتجاه من اليمين إلى اليسار (RTL First).
   - التحقق الصارم من أرقام الهواتف المصرية (`010`, `011`, `012`, `015`).
   - هيكل العناوين المصرية (المحافظة، المركز/المدينة، الحي/المنطقة، الشارع).
   - الدفع عند الاستلام (Cash On Delivery) وإدارة مرات الرفض وتتبع المرتجعات.
   - الامتثال لقانون حماية البيانات المصري (PDPL 151/2020) مع تصدير وحذف البيانات.

2. **المميزات التنافسية الحديثة (E-Commerce Features):**
   - **نظام الكوبونات والخصومات (Coupons & Discounts):** دعم الكوبونات الثابتة والنسبية مع شروط الحد الأدنى وتاريخ الصلاحية.
   - **التقييمات والمراجعات (Product Reviews):** تمكين المشترين من تقييم المنتجات بالنجوم وكتابة مراجعات تفصيلية.
   - **تنوعات المنتجات (Product Variants):** دعم المقاسات، الألوان، والخيارات المتعددة مع تتبع مخصص للمخزون والأسعار.
   - **إدارة المرتجعات (Order Returns):** دورة عمل متكاملة لتقديم ومتابعة طلبات الإرجاع وأسبابها.
   - **المحافظ الإلكترونية (Wallets):** محفظة للمشتري (لرد المبالغ) ومحفظة للبائع (للأرباح وطلبات السحب).
   - **الإشعارات الفورية (Push Notifications):** إرسال واستقبال إشعارات بحالة الطلبات عبر Expo Notifications.
   - **لوحات تحكم متقدمة (Analytics & Dashboards):** إحصائيات بيع ورسوم بيانية لأداء البائع والمنصة.

3. **الأمان والمصادقة:**
   - توثيق آمن عبر JWT مع تشفير كلمات المرور (BCrypt).
   - دعم تسجيل الدخول المباشر وتسجيل الدخول عبر Google (Google OAuth).
   - صلاحيات دقيقة للمستخدمين (مشتري Buyer، بائع Seller، مدير Admin).

---

## 🛠️ التشغيل السريع (Getting Started)

### تشغيل الباك إند (Backend):
```bash
cd backend
dotnet restore
dotnet run --project Marketplace.API
```

### تشغيل تطبيق الموبايل (Mobile):
```bash
cd mobile
npm install
npx expo start
```