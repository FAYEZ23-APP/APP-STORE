# Egyptian Marketplace - Mobile Application (React Native / Expo)

تطبيق الهاتف المحمول لمنصة السوق المصري، مبني باستخدام **React Native (0.88)** و **Expo (SDK 58)** و **twrnc (Tailwind React Native)**، مع دعم شامل للمشترين والتجار، وتجربة مستخدم محلية مصممة خصيصاً للسوق المصري.

---

## 🏗️ هيكل المجلدات (Project Structure)

```text
mobile/
├── src/
│   ├── api/             # عميل Axios للاتصال بالـ Backend والتعامل مع التوكن
│   ├── components/      # مكونات الواجهة وتجربة المستخدم القابلة لإعادة الاستخدام
│   │   └── profile/     # مكونات بطاقات الأمان، اللغات، وإعدادات الملف الشخصي
│   ├── context/         # إدارة حالة الجلسة (AuthContext)، السلة (CartContext)، والبيومترك
│   ├── hooks/           # خطافات مخصصة لإدارة العمليات والحالات
│   ├── locales/         # ملفات الترجمة (العربية ar.json أساسي، والإنجليزية en.json)
│   ├── navigation/      # مسارات التنقل (المشتري Buyer، التاجر Seller، وشاشات المصادقة)
│   ├── screens/         # شاشات التطبيق الكاملة (تسوق، طلبات، دفع COD، متجر التاجر، الحساب)
│   ├── services/        # خدمات مساعدة (التخزين، التنبيهات، التحقق)
│   ├── theme/           # سمات التصميم والألوان والخطوط المتوافقة مع WCAG
│   └── utils/           # تطبيع الهواتف، التخزين المشفر SecureStore، ومعالجة الصور
├── assets/              # الأيقونات وصور البداية (Splash)
├── tests/               # اختبارات نزاهة الحزم وتطابق الشاشات
├── app.config.js        # إعدادات تطبيق Expo وبيئة العمل
├── eas.json             # إعدادات البناء السحابي EAS لإنتاج APK
└── package.json         # التبعيات والسكربتات
```

---

## 🛠️ المتطلبات التقنية (Prerequisites)

- **Node.js** (الإصدار `v20.x` أو `v24.x`)
- مدير الحزم **npm**
- تطبيق **Expo Go** على هاتفك الذكي، أو محاكي **Android Studio / iOS Simulator**
- أداة **EAS CLI** (في حال الرغبة في بناء ملف APK نهائي):
  ```powershell
  npm install -g eas-cli
  ```

---

## ⚙️ التثبيت والتشغيل المحلي (Setup & Run)

### 1. تثبيت الحزم (Install Dependencies):
```powershell
cd mobile
npm install
```

### 2. إعداد متغيرات الاتصال (Environment Variables):
أنشئ ملف `.env` بناءً على `.env.example`:
```env
EXPO_PUBLIC_API_URL=http://YOUR_LOCAL_IP:5209/api
```
*(ملاحظة: عند الاختبار على هاتف حقيقي عبر Expo Go، استخدم عنوان الـ IP المحلي لجهاز الكمبيوتر الخاص بك مثل `192.168.1.X` بدلاً من `localhost`).*

### 3. تشغيل وضع التطوير (Start Metro / Expo):
```powershell
npx expo start
```
- اضغط `a` للتشغيل على محاكي Android.
- اضغط `i` للتشغيل على محاكي iOS.
- امسح رمز الـ QR عبر كاميرا الهاتف أو تطبيق Expo Go للتشغيل الفوري.

### 4. بناء ملف APK للتثبيت المباشر:
```powershell
npm run build:apk
# أو باستخدام eas:
eas build --profile preview --platform android
```

---

## 🧪 الاختبارات وتدقيق الجودة (Testing & QA)

```powershell
# فحص تطابق مفاتيح الترجمة (عربي / إنجليزي)
node scripts/check-i18n.js

# فحص سلامة وتماسك تصدير المكونات
node tests/test_exports_integrity.js

# فحص مكونات الملف الشخصي ولوحة التحكم
node tests/test_profile_dashboard_redesign.js
```

---

## 🔒 الميزات الجوهرية ومعايير الأمان (Key Features & Security)

1. **القفل البيومتري (Biometric Lock):** دعم البصمة والتعرف على الوجه عبر `expo-local-authentication` مع شاشة قفل داخلية (`UnlockScreen`).
2. **التخزين الآمن:** حفظ وتشفير مفاتيح الجلسة والـ Refresh Token داخل مساحة النظام الآمنة عبر `expo-secure-store`.
3. **الدفع عند الاستلام (COD):** دورة طلب كاملة تدعم الدفع النقدي عند الاستلام مع حساب رسوم التوصيل والتحقق من رقم الهاتف المصري (`+20`).
4. **دعم العربية الكامل (RTL):** محاذاة وتخطيط مرن وسلس يدعم القراءة من اليمين إلى اليسار تلقائياً مع خطوط عربية واضحة.
