# Egyptian Marketplace Platform (سوق إلكتروني مصري)

مشروع متكامل لسوق إلكتروني مصمم خصيصاً للسوق المصري ووفقاً لقانون حماية البيانات الشخصية المصري (PDPL 151/2020).

---

## 📁 هيكل المشروع (Project Structure)

```
APP-store/
├── backend/                  # .NET 10 Web API Backend
│   ├── Marketplace.API/             # Controllers, Middlewares, Configuration
│   ├── Marketplace.Application/     # Services, DTOs, Business Logic, FluentValidation
│   ├── Marketplace.Domain/          # Domain Entities, Enums
│   ├── Marketplace.Infrastructure/  # EF Core, PostgreSQL, Repositories, Providers
│   ├── tests/                       # API Automated Integration Tests
│   └── Marketplace.slnx             # Solution File
│
└── mobile/                   # React Native (Expo) Mobile Application
    ├── assets/                      # Icons & Splash Screens
    ├── src/
    │   ├── api/                     # Axios API Services & Interceptors
    │   ├── components/              # Shared UI Components (Cards, Badges, etc.)
    │   ├── context/                 # AuthContext & CartContext
    │   ├── locales/                 # Arabic (Primary RTL) & English translations
    │   ├── navigation/              # BuyerTabs, SellerTabs & AppNavigator
    │   ├── screens/                 # Buyer, Seller, Auth, Profile Screens
    │   ├── theme/                   # Brand Colors (Navy, Orange, Clean surfaces)
    │   └── utils/                   # Egyptian Phone, Currency, Image, Storage helpers
    ├── App.js
    └── package.json
```

---

## 🚀 المميزات الرئيسية (Core Features)

1. **الامتثال للسوق المصري (Egyptian Market Ready):**
   - العملة الرسمية: الجنيه المصري (`ج.م` / `EGP`).
   - دعم كامل للغة العربية والاتجاه من اليمين إلى اليسار (RTL First).
   - التحقق من أرقام الهواتف المصرية (`010`, `011`, `012`, `015`).
   - هيكل العناوين المصرية (المحافظة، المركز/المدينة، الحي/المنطقة، الشارع).
   - الدفع عند الاستلام (Cash On Delivery) وإدارة مرات الرفض وتتبع المرتجعات.
   - الامتثال لقانون حماية البيانات المصري (PDPL) مع تصدير وحذف البيانات.

2. **الواجهات والتطبيقات:**
   - واجهة مشتري متكاملة (تصفح، أقسام، سلة تسوق، طلبات، مفضلة، تقييمات).
   - واجهة بائع (لوحة تحكم، إضافة وتعديل المنتجات، متابعة الطلبات، محفظة إلكترونية).
   - دعم تسجيل الدخول المباشر وجوجل (Google Sign-In).

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