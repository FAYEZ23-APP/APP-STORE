# تقرير تعديلات مستودع الكود (Git Change Report & File Diff)

يوثق هذا التقرير كافة الملفات التي خضعت للتعديل خلال مرحلة إصلاح العيوب الوظيفية، وإحصائيات الـ Diff الدقيقة، وتأكيد المحافظة على سلامة ونظافة شجرة Git.

---

## 1. الإحصائيات العامة للتعديلات (Git Diff Stat)

```text
 admin-web/src/locales/ar.json                      | 10 ++++-
 admin-web/src/locales/en.json                      | 10 ++++-
 admin-web/src/pages/SellerStorePage.jsx            | 25 +++++++++--
 admin-web/src/pages/admin/AdminPortalPage.jsx      |  4 +-
 admin-web/src/utils/enumTranslations.js            |  6 ++-
 backend/Marketplace.API/Controllers/CategoriesController.cs |  4 +-
 mobile/src/locales/ar.json                         |  9 +++-
 mobile/src/locales/en.json                         |  9 +++-
 mobile/src/navigation/AppNavigator.js              | 10 ++++-
 mobile/src/screens/buyer/CheckoutScreen.js         | 49 ++++++++++++++++++++++
 mobile/src/screens/buyer/SellerStoreScreen.js      | 23 ++++++++--
 mobile/src/utils/enumTranslations.js               |  6 ++-
 12 files changed, 146 insertions(+), 19 deletions(-)
```

---

## 2. تفصيل الملفات المعدلة حسب المشروع

### أ. مشروع الباك اند (`backend/`)
1. **`Marketplace.API/Controllers/CategoriesController.cs`**
   - **السطور المتأثرة:** 77 و 86.
   - **الغرض:** معالجة العيب `BUG-MED-001`.
   - **التعديل:** تغيير السمة `[ProducesResponseType(StatusCodes.Status204NoContent)]` وتعديل الاستجابة إلى `return NoContent();` لتوحيد نمط استجابات الحذف في المنصة.

### ب. مشروع لوحة إدارة الويب المتسوق (`admin-web/`)
2. **`admin-web/src/pages/SellerStorePage.jsx`**
   - **الغرض:** معالجة العيب `BUG-MED-002`.
   - **التعديل:** تمييز رمز 404 وعرض بطاقة مخصصة مع أيقونة المتجر ونصوص توضح أن المتجر متوقف مؤقتاً أو قيد المراجعة مع زر للعودة للكتالوج بدلاً من رسالة الخطأ العامة.
3. **`admin-web/src/pages/admin/AdminPortalPage.jsx`**
   - **الغرض:** معالجة العيب `BUG-LOW-006`.
   - **التعديل:** تصحيح شرطية تعطيل زر الصفحة التالية في جدولي سجلات الرقابة والشحنات لتعتمد على سقف الصفحات الدقيق: `page >= Math.max(1, Math.ceil(total / pageSize))`.
4. **`admin-web/src/utils/enumTranslations.js`**
   - **الغرض:** معالجة العيب `BUG-LOW-005`.
   - **التعديل:** تحديث دالة `getDeliveryMethodLabel` لترجع دائماً القيمة المترجمة المعربة `t('deliveryMethod.DoorDelivery', 'توصيل للمنزل')` كقيمة احتياطية بدلاً من السلسلة النصية الإنجليزية `Delivery`.
5. **`admin-web/src/locales/ar.json`**
   - **الغرض:** إضافة المفاتيح المعربة (`store.closedTitle`, `store.closedDesc`, `common.accessDenied`, `common.unauthorizedRoleScreen`, `checkout.pinLocationNudge`, `deliveryMethod.DoorDelivery`, `deliveryMethod.Delivery`).
6. **`admin-web/src/locales/en.json`**
   - **الغرض:** إضافة المفاتيح الإنجليزية المطابقة تماماً لملف اللغة العربية لضمان التطابق التام بنسبة 100%.

### ج. مشروع تطبيق الموبايل (`mobile/`)
7. **`mobile/src/screens/buyer/SellerStoreScreen.js`**
   - **الغرض:** معالجة العيب `BUG-MED-002`.
   - **التعديل:** إظهار بطاقة توضيحية لمتجر التاجر المغلق مع أيقونة `store-off-outline` ورسالة إرشادية للمتسوق.
8. **`mobile/src/navigation/AppNavigator.js`**
   - **الغرض:** معالجة العيب `BUG-LOW-003`.
   - **التعديل:** استيراد `Alert` وإطلاق تنبيه مرئي يوضح للمستخدم عدم امتلاكه الصلاحية الكافية عند حظر رابط عميق موجه لشاشات الإدارة.
9. **`mobile/src/screens/buyer/CheckoutScreen.js`**
   - **الغرض:** معالجة العيب `BUG-LOW-004`.
   - **التعديل:** إضافة شارة وزر "📍 أضف موقعك بدقة على الخريطة لتسليم أسرع" عند اختيار عنوان يفتقر لإحداثيات GPS، وربطه بمكون الخريطة `MobileLocationPicker`.
10. **`mobile/src/utils/enumTranslations.js`**
    - **الغرض:** معالجة العيب `BUG-LOW-005`.
    - **التعديل:** توحيد القيمة الاحتياطية لطريقة التوصيل إلى "توصيل للمنزل".
11. **`mobile/src/locales/ar.json`**
    - **الغرض:** إضافة المفاتيح المعربة للموبايل ومطابقتها للمتطلبات.
12. **`mobile/src/locales/en.json`**
    - **الغرض:** إضافة الترجمات الإنجليزية المناظرة وضمان اجتياز `npm run i18n:check` بنسبة 100% (1137 مفتاحاً).

---

## 3. التحقق من سلامة شجرة Git وضوابط النشر

- **حالة الـ Database Migrations:** صفر مايجريشن تم إنشاؤها (مخطط قاعدة البيانات ثابت ومستقر ولم يتطلب أي تعديل).
- **حالة النطاقات الأمنية المغلقة:** لم يتم تعديل أي ملف في نطاقات التوثيق الحساس أو الكوكيز أو التشفير أو الصلاحيات الرئيسية.
- **سلامة العمل:** كافة الملفات المعدلة تنتمي حصرياً للمشاريع الثلاثة المعتمدة في المستودع.
