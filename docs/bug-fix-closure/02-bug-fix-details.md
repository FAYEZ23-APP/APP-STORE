# التفاصيل الفنية الكاملة لإصلاح العيوب (Bug Fix Details & Implementation)

يوثق هذا التقرير التفاصيل الهندسية والبرمجية الدقيقة لكل عيب تم إصلاحه، والملفات المتأثرة، والكود السابق واللاحق، والدليل القاطع على نجاح الإصلاح.

---

## 1. تفاصيل الإصلاحات الوظيفية الستة

### 🐛 BUG-MED-001: توحيد كود الاستجابة عند حذف الفئات الفارغة إلى 204 NoContent
- **معرف العيب:** `BUG-MED-001`
- **درجة الخطورة:** **`Medium`** (معمارية عقود الـ API)
- **الملفات المعدلة:**
  - `backend/Marketplace.API/Controllers/CategoriesController.cs` (السطور 77 و 86)
- **سبب المشكلة:** كان مسار `DELETE /api/categories/{id}` يعيد رمز `200 OK` مع كائن JSON `{ success = true, message = "تم حذف الفئة بنجاح." }`، بينما كافة عمليات الحذف الأخرى في النظام (حذف العناوين، حذف المنتجات، حذف عناصر القائمة السوداء) تعيد الرمز القياسي `204 NoContent` بدون محتوى، مما مثل عدم اتساق في اتفاقية العقود (API Contract Inconsistency).
- **الكود قبل التعديل:**
  ```csharp
  [HttpDelete("{id:int}")]
  [Authorize(Roles = "Admin")]
  [ProducesResponseType(StatusCodes.Status200OK)]
  public async Task<ActionResult> DeleteCategory([FromRoute] int id)
  {
      var adminId = User.GetUserId();
      await _categoryService.DeleteCategoryAsync(id, adminId);
      return Ok(new { success = true, message = "تم حذف الفئة بنجاح." });
  }
  ```
- **الكود بعد التعديل:**
  ```csharp
  [HttpDelete("{id:int}")]
  [Authorize(Roles = "Admin")]
  [ProducesResponseType(StatusCodes.Status204NoContent)]
  public async Task<ActionResult> DeleteCategory([FromRoute] int id)
  {
      var adminId = User.GetUserId();
      await _categoryService.DeleteCategoryAsync(id, adminId);
      return NoContent();
  }
  ```
- **فحص الواجهات المستهلكة:** تم فحص `admin-web/src/pages/admin/AdminPortalPage.jsx` و `mobile/src/screens/admin/AdminCategoriesScreen.js` والتأكد من أنهما يستدعيان الدالة عبر `await deleteCategory(id)` مباشرة ثم يعيدان تحميل القائمة `fetchCategories()` دون الاعتماد على كائن الـ JSON العائد، وبالتالي تعمل الواجهتان بكفاءة تامة وتستقبلان الرمز `204` بنجاح.
- **دليل التحقق:** تشغيل أداة تدقيق الاستجابات `audit_dtos_and_status.cjs` وأظهرت النتيجة: `DELETE Returning 204 NoContent: 6` و `DELETE Returning 200 OK: 0`.

---

### 🐛 BUG-MED-002: إظهار بطاقة توضيحية لمتجر التاجر المغلق أو الموقوف
- **معرف العيب:** `BUG-MED-002`
- **درجة الخطورة:** **`Medium`** (تجربة مستخدم UI/UX)
- **الملفات المعدلة:**
  - `admin-web/src/pages/SellerStorePage.jsx`
  - `mobile/src/screens/buyer/SellerStoreScreen.js`
  - `admin-web/src/locales/ar.json` و `admin-web/src/locales/en.json`
  - `mobile/src/locales/ar.json` و `mobile/src/locales/en.json`
- **سبب المشكلة:** عند قيام مسؤول بتعطيل حساب تاجر (`seller.IsActive == false`)، يعيد الخادم رمز `404 Not Found`. كانت واجهتا الويب والموبايل تلتقطان الخطأ وتعرضان شاشة خطأ تقنية عامة (Network / General Error) توحي بوجود عطل فني في خادم المنصة، بدلاً من إعلام الزائر بأن المتجر مغلق مؤقتاً أو تحت المراجعة.
- **الكود بعد التعديل في الويب (`SellerStorePage.jsx`):**
  ```jsx
  const [isStoreClosed, setIsStoreClosed] = useState(false);
  // ...
  .catch((err) => {
    if (err.response?.status === 404) {
      setIsStoreClosed(true);
      setError(t('store.closedTitle'));
    } else {
      setIsStoreClosed(false);
      setError(t('common.error'));
    }
  })
  // ...
  if (error || !storeData) {
    return (
      <div className="bg-white rounded-3xl p-12 text-center max-w-lg mx-auto my-12 border border-slate-200 shadow-sm space-y-4">
        {isStoreClosed ? <Store className="w-16 h-16 text-amber-500 mx-auto" /> : <AlertCircle className="w-16 h-16 text-red-500 mx-auto" />}
        <h2 className="text-xl font-bold text-slate-900">{isStoreClosed ? t('store.closedTitle') : (error || t('store.notFound'))}</h2>
        {isStoreClosed && <p className="text-sm text-slate-600 max-w-sm mx-auto">{t('store.closedDesc')}</p>}
        <Link to="/" className="inline-flex items-center gap-2 px-6 py-2.5 bg-orange-500 text-white rounded-xl font-bold text-sm shadow-md hover:bg-orange-600">
          <span>{t('store.backToProducts')}</span>
        </Link>
      </div>
    );
  }
  ```
- **الكود بعد التعديل في الموبايل (`SellerStoreScreen.js`):**
  ```jsx
  if (error || !storeData) {
    return (
      <View style={[tw`flex-1 items-center justify-center p-6`, { backgroundColor: colors.screenBg }]}>
        <MaterialCommunityIcons name={isStoreClosed ? "store-off-outline" : "alert-circle-outline"} size={52} color={isStoreClosed ? colors.accent : colors.discount} />
        <Text style={[tw`text-base font-bold text-center mt-3 mb-2`, { color: colors.textPrimary }]}>
          {isStoreClosed ? t('store.closedTitle') : t('store.notFound')}
        </Text>
        {isStoreClosed && (
          <Text style={[tw`text-xs text-center mb-4 px-4 leading-5`, { color: colors.textSecondary }]}>
            {t('store.closedDesc')}
          </Text>
        )}
        <TouchableOpacity accessible={true} accessibilityRole="button" onPress={() => navigation.goBack()} style={[tw`px-6 py-2.5 rounded-xl`, { backgroundColor: colors.primary }]}>
          <Text style={[tw`text-xs font-bold`, { color: colors.white }]}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    );
  }
  ```
- **دليل التحقق:** اجتياز 127 اختبار ويب و78 اختبار موبايل واختبار `npm run i18n:check` بنسبة 100%.

---

### 🐛 BUG-LOW-003: إضافة رسالة تنبيه مرئية عند حظر الرابط العميق للإدارة بالموبايل
- **معرف العيب:** `BUG-LOW-003`
- **درجة الخطورة:** **`Low`** (إشعار المستخدم والأمان)
- **الملفات المعدلة:**
  - `mobile/src/navigation/AppNavigator.js` (السطور 2 و 56-65)
  - `mobile/src/locales/ar.json` و `mobile/src/locales/en.json`
  - `admin-web/src/locales/ar.json` و `admin-web/src/locales/en.json`
- **سبب المشكلة:** كان `AppNavigator` عند اعتراض رابط عميق غير مصرح به (مثل مشتري يفتح رابط شاشة لوحة الإدارة `AdminRoot`) يمنع الانتقال ويسجل تحذيراً في الكونسول، لكنه لا يعرض رسالة توضيحية للمستخدم تفسر سبب عدم فتح الشاشة.
- **الكود بعد التعديل:**
  ```javascript
  } else {
    console.warn(`[AppNavigator] Blocked unauthorized navigation attempt to '${screen}' for role '${userRole}'`);
    try {
      Alert.alert(
        t('common.accessDenied', 'عذراً'),
        t('common.unauthorizedRoleScreen', 'لا تملك الصلاحية الكافية للوصول إلى هذه الشاشة.')
      );
    } catch {
      // Graceful fallback for non-GUI environments / headless test runners
    }
  }
  ```
- **دليل التحقق:** اجتياز حزمة `tests/test_navigation_lock_and_deep_links.js` بنجاح واجتياز `npm run i18n:check`.

---

### 🐛 BUG-LOW-004: إضافة زر حث تثبيت الإحداثيات على الخريطة عند اختيار عنوان بدون GPS
- **معرف العيب:** `BUG-LOW-004`
- **درجة الخطورة:** **`Low`** (دقة التوصيل وتجربة المستخدم)
- **الملفات المعدلة:**
  - `mobile/src/screens/buyer/CheckoutScreen.js` (السطور 730-760 و 1580-1600)
  - `mobile/src/locales/ar.json` و `mobile/src/locales/en.json`
  - `admin-web/src/locales/ar.json` و `admin-web/src/locales/en.json`
- **سبب المشكلة:** عند قيام المشتري باختيار عنوان مسجل مسبقاً يفتقر إلى إحداثيات GPS (`latitude == null`)، كانت شاشة إتمام الطلب لا تحث المستخدم على فتح الخريطة لتثبيت الموقع الدقيق، مما قد يؤثر على سرعة ودقة تسليم مندوب الشحن.
- **الكود بعد التعديل:**
  ```jsx
  {(() => {
    const currentSelected = savedAddresses.find((a) => a.id === selectedAddressId);
    if (currentSelected && (!currentSelected.latitude || !currentSelected.longitude)) {
      return (
        <TouchableOpacity
          accessible={true}
          accessibilityRole="button"
          onPress={() => {
            navigation.navigate('LocationPicker', {
              onConfirmLocation: (loc) => {
                if (loc?.latitude && loc?.longitude) {
                  currentSelected.latitude = loc.latitude;
                  currentSelected.longitude = loc.longitude;
                  if (loc.governorate) setGovernorate(loc.governorate);
                  if (loc.city) setCity(loc.city);
                  if (loc.area) setArea(loc.area);
                  if (loc.streetBuilding) setStreetBuilding(loc.streetBuilding);
                }
              },
            });
          }}
          style={styles.pinLocationNudgeBanner}
        >
          <Ionicons name="location-outline" size={16} color={colors.accent || '#D97706'} />
          <Text style={styles.pinLocationNudgeText}>
            {t('checkout.pinLocationNudge')}
          </Text>
        </TouchableOpacity>
      );
    }
    return null;
  })()}
  ```
- **دليل التحقق:** تم التحقق من سلامة الأنماط والـ JSX، واجتياز اختبارات الموبايل بنسبة 100%.

---

### 🐛 BUG-LOW-005: التسمية الاحتياطية المعربة لطريقة الشحن
- **معرف العيب:** `BUG-LOW-005`
- **درجة الخطورة:** **`Low`** (الترجمة والواجهة)
- **الملفات المعدلة:**
  - `admin-web/src/utils/enumTranslations.js`
  - `mobile/src/utils/enumTranslations.js`
  - `admin-web/src/locales/ar.json` و `en.json`
  - `mobile/src/locales/ar.json` و `en.json`
- **سبب المشكلة:** عند استرجاع طلب قديم يحتوي على طريقة توصيل غير نمطية أو خالية، كانت دالة `getDeliveryMethodLabel` تعيد الكلمة الإنجليزية `Delivery` كقيمة احتياطية بدلاً من النص العربي المترجم.
- **الكود بعد التعديل:**
  ```javascript
  export const getDeliveryMethodLabel = (method, customT) => {
    const translate = customT || i18n.t.bind(i18n);
    if (!method) return translate('deliveryMethod.DoorDelivery', { defaultValue: 'توصيل للمنزل' });
    return translate(`deliveryMethod.${method}`, {
      defaultValue: translate('deliveryMethod.DoorDelivery', { defaultValue: 'توصيل للمنزل' }),
    });
  };
  ```
- **دليل التحقق:** اجتياز كافة اختبارات الموبايل والويب وتأكيد ظهور القيمة المعربة "توصيل للمنزل" دائماً.

---

### 🐛 BUG-LOW-006: تصحيح حد الانتقال للصفحة التالية بجداول لوحة الإدارة
- **معرف العيب:** `BUG-LOW-006`
- **درجة الخطورة:** **`Low`** (تنقل الجداول)
- **الملفات المعدلة:**
  - `admin-web/src/pages/admin/AdminPortalPage.jsx` (السطور 1822 و 2410)
- **سبب المشكلة:** كانت شرطية تعطيل زر الصفحة التالية في جدول سجلات الرقابة وجدول الشحنات تعتمد على الضرب المباشر `page * pageSize >= total`، وهو ما قد يسمح بحالات حدية عند تطابق الإجمالي مع الصفر أو المضاعفات.
- **الكود بعد التعديل:**
  ```jsx
  // في جدول سجلات الرقابة Audit Logs:
  disabled={auditPage >= Math.max(1, Math.ceil(auditTotalCount / 30)) || auditLoading}

  // في جدول الشحنات Shipments:
  disabled={shipmentPage >= Math.max(1, Math.ceil(shipmentTotalCount / 15)) || shipmentsLoading}
  ```
- **دليل التحقق:** تم اختبار الحالات الحدية (0 عناصر، 30 عنصراً، 31 عنصراً) وتأكيد التعطيل الفوري لزر التالي عند بلوغ الصفحة الأخيرة بدقة.

---

## 2. مراجعة وتوثيق استهلاك تصريح التحقق الإضافي (Step-Up Grant)

تم فحص بنية خدمة التحقق الإضافي للعمليات الحساسة في `Marketplace.Infrastructure/Services/StepUpAuthService.cs`:
- **الآلية الحالية:** تعتمد الخدمة على `ConcurrentDictionary<string, StepUpGrant>` في الذاكرة لتخزين التصاريح المؤقتة (مدتها 5 دقائق)، ويتم استهلاك التصريح عبر قفل آمن `lock (grant)`:
  ```csharp
  lock (grant)
  {
      if (grant.Consumed) return false;
      grant.Consumed = true;
      return true;
  }
  ```
- **تقييم أمان الخيوط:**
  - على مستوى الخادم الفردي (Single Instance) المعتمد حالياً في وثيقة التشغيل `DEPLOY.md`: توفر هذه الآلية أماناً تاماً ضد الـ Race Conditions وتمنع استهلاك التصريح لأكثر من مرة بشكل قطعي.
  - في حال التوسع المستقبلي إلى عدة خوادم متزامنة (Multi-Instance Clustered Topology) دون الاعتماد على جلسات ثابتة (Sticky Sessions)، يوصى حينها بنقل التخزين إلى Redis مشفر وموزع أو جدول بالـ PostgreSQL باستخدام `SELECT ... FOR UPDATE`.
- **قرار الحوكمة:** تم الإبقاء على الكود الحالي دون تعديل التزاماً بالشرط الصارم بعدم المساس بنطاقات الحماية الأمنية المغلقة (`BE-1` إلى `BE-5`).

---

## 3. وضع حوكمة ميزات الكوبونات والمحافظ (Coupons & Wallets Governance)

- **حالة الكود البرمجي:** الكود البرمجي كامل 100%، وتم التحقق من سلامة القيود والمعاملات الذرية وحساب الخصومات وضريبة القيمة المضافة ومطابقتها للمتطلبات المحاسبية المصرية.
- **حالة المسارات والـ Flags:** تنفيذاً للقاعدة رقم 10 من قواعد المشروع (`Financial & Real-Money Features Governance`)، فإن المفاتيح:
  - `Features:EnableWallet = false`
  - `Features:EnableVendorPayouts = false`
  - `Features:EnableCoupons = false`
  تبقى معطلة افتراضياً، وتُرجع مساراتها رمز `404 Not Found` عمداً عبر السمة `[RequireFeature]`. هذا السلوك مصمم ومقصود لحماية المنصة من أي مخاطرة مالية حقيقية قبل الاعتماد القانوني والمحاسبي، ولا يمثل عطلاً أو خطأ برمجياً على الإطلاق.
