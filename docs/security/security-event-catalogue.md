# Security Event Catalogue & Monitoring Specification

> **Project**: Egypt Shop Marketplace  
> **Phase**: PHASE 14 — Security Monitoring, Threat Detection & Incident Response  
> **Reference Standards**: OWASP ASVS 5.0.0 (V15 Logging and Monitoring), ISO/IEC 27001 A.12.4, Egyptian PDPL Law 151/2020  
> **Status**: APPROVED & ACTIVE  

---

## 1. Monitoring Architecture & Event Schema

All security-relevant activities across Web, Mobile, Backend APIs, and Integrations are ingested by the centralized `ISecurityEventLogger` service into structured logs and in-memory audit buffers.

### Standard Security Event Schema:
```json
{
  "timestamp": "2026-11-07T10:45:00.123456Z",
  "eventId": "SEC_AUTH_TOKEN_REUSE_DETECTED",
  "category": "Authentication",
  "severity": "Critical",
  "actorId": "1042",
  "actorRole": "Buyer",
  "clientIp": "197.34.22.81",
  "userAgent": "Mozilla/5.0 (Linux; Android 14)...",
  "correlationId": "8f9a2b3c4d5e6f7a",
  "targetResource": "/api/auth/refresh-token",
  "outcome": "Blocked",
  "reason": "Consumed refresh token replayed for user 1042; token family revoked.",
  "metadata": {
    "familyId": "3b2e1f4a-...",
    "email": "fa***@example.com",
    "deviceId": "dev-and-4881"
  }
}
```

---

## 2. Complete Security Event Inventory

### الفئة 1: المصادقة وإدارة الجلسات (Authentication & Session Management)

| رمز الحدث (Event ID) | درجة الخطورة | مستوى الإنذار | الوصف وسبب الإطلاق | الإجراء الآلي للنظام |
|:---|:---:|:---:|:---|:---|
| `SEC_AUTH_LOGIN_SUCCESS` | Info | P3 | تسجيل دخول ناجح لكلمة المرور أو الرمز السري | تسجيل الحدث وتوليد JWT جديد |
| `SEC_AUTH_LOGIN_FAILED` | Warning | P3 | فشل تسجيل الدخول (كلمة مرور غير صحيحة أو مستخدم غير مسجل) | إخفاء سبب الفشل وتوحيد 401 |
| `SEC_AUTH_BRUTE_FORCE_DETECTED` | High | P2 | تجاوز 5 محاولات فاشلة خلال 5 دقائق للبريد أو الـ IP | تطبيق Rate-Limiter وحظر مؤقت |
| `SEC_AUTH_TOKEN_REFRESH_SUCCESS` | Info | P3 | تجديد ناجح لـ Access Token عبر Refresh Token دوّار | تدوير الرمز وتحديث العائلة |
| `SEC_AUTH_TOKEN_REFRESH_FAILED` | Warning | P3 | تقديم رمز تجديد منتهي الصلاحية أو غير موجود | رفض الطلب بـ 401 |
| `SEC_AUTH_TOKEN_REUSE_DETECTED` | **Critical** | **P1** | **إعادة استخدام رمز تجديد مستهلك سابقاً (Token Replay / Theft)** | **إلغاء فوري لكامل عائلة الرموز وطرد الجلسات النشطة** |
| `SEC_AUTH_SESSION_REVOKED` | Info | P3 | تسجيل خروج صريح أو إبطال إداري للجلسة | تعليم الرمز كـ Revoked |
| `SEC_AUTH_2FA_FAILED` | Warning | P2 | فشل التحقق من رمز TOTP الثنائي (2FA) للأدمن أو التاجر | حظر المحاولة بعد 3 تكرارات |
| `SEC_AUTH_STEPUP_FAILED` | Warning | P2 | فشل المصادقة المعززة للعمليات الحساسة (تسوية COD / حذف الحساب) | رفض العملية وإلغاء الـ Grant |

---

### الفئة 2: الصلاحيات وعزل المستأجرين (Authorization & Tenant Isolation)

| رمز الحدث (Event ID) | درجة الخطورة | مستوى الإنذار | الوصف وسبب الإطلاق | الإجراء الآلي للنظام |
|:---|:---:|:---:|:---|:---|
| `SEC_AUTHZ_UNAUTHORIZED` | Warning | P3 | استدعاء endpoint محمي بدون ترويسة Authorization صالحة | حجب فوري برمز 401 |
| `SEC_AUTHZ_FORBIDDEN` | Warning | P2 | استدعاء عملية لا يملك المستخدم صلاحيتها (BOLA / IDOR) | حجب فوري برمز 403 ومنع تسريب البيانات |
| `SEC_AUTHZ_CROSS_TENANT_ATTEMPT` | High | P2 | محاولة تاجر أو مشتري الوصول لبيانات تاجر/مشتري آخر | تسجيل معرفات الطرفين وإرجاع 403/404 |
| `SEC_AUTHZ_PRIVILEGE_ESCALATION` | **Critical** | **P1** | محاولة تعديل Role أو تمرير AdminOverride في الـ Request | رفض فوري 403/400 وتسجيل محاولة الاختراق |
| `SEC_AUTHZ_ADMIN_ROUTE_BLOCKED` | High | P2 | محاولة مستخدم غير مصرح استدعاء بوابات الإدارة `/api/admin/*` | حجب فوري 403 وتسجيل الـ IP |

---

### الفئة 3: الاحتيال التجاري والنزاهة المالية (Marketplace Fraud & Financial Integrity)

| رمز الحدث (Event ID) | درجة الخطورة | مستوى الإنذار | الوصف وسبب الإطلاق | الإجراء الآلي للنظام |
|:---|:---:|:---:|:---|:---|
| `SEC_FRAUD_PRICE_MANIPULATION` | High | P2 | تلاعب العميل بسعر الوحدة UnitPrice في الـ Payload | تجاهل السعر وتطبيق سعر قاعدة البيانات المعتمد |
| `SEC_FRAUD_DISCOUNT_TAMPERING` | High | P2 | تلاعب العميل بقيمة الخصم بدون كوبون صالح | تصفير الخصم وإعادة احتساب الإجمالي Authoritative |
| `SEC_FRAUD_SHIPPING_TAMPERING` | High | P2 | تلاعب العميل بتكلفة الشحن المرسلة من الواجهة | تطبيق تسعيرة الشحن الرسمية المعتمدة |
| `SEC_FRAUD_CONCURRENCY_RACE` | Warning | P3 | سباق تزامني لشراء آخر قطعة مخزون (Race Condition) | نجاح أول طلب فقط ورفض الآخر بـ 400 بأمان |
| `SEC_FRAUD_IDEMPOTENCY_REPLAYED` | Info | P3 | إعادة إرسال طلب شراء بنفس مفتاح Idempotency-Key | إرجاع النتيجة السابقة بأمان ودون تكرار الخصم |
| `SEC_FRAUD_COUPON_ABUSE` | Warning | P2 | محاولة استهلاك كوبون تجاوز الحد الأقصى للاستخدام | رفض تطبيق الكوبون وإشعار العميل |
| `SEC_FRAUD_COD_REFUSAL_EXCEEDED` | Warning | P2 | وصول المشتري إلى حد تكرار رفض الاستلام (>= 3 مرات) | حظر خيار الدفع نقداً عند الاستلام COD وتوجيهه للدفع المسبق |
| `SEC_FRAUD_WALLET_TAMPERING` | **Critical** | **P1** | محاولة التلاعب برصيد المحفظة أو السحب المزدوج الموازي | رفض المعاملة بـ Row-Level Lock وحظر السحب |
| `SEC_FRAUD_DUPLICATE_SETTLEMENT` | High | P1 | محاولة تسوية مستحقات COD لشحنة مسواة مسبقاً | إرجاع 200 Idempotent ومنع تكرار القيد المحاسبي |

---

### الفئة 4: البنية التحتية والخوادم (Infrastructure & Server Hardening)

| رمز الحدث (Event ID) | درجة الخطورة | مستوى الإنذار | الوصف وسبب الإطلاق | الإجراء الآلي للنظام |
|:---|:---:|:---:|:---|:---|
| `SEC_INFRA_KESTREL_LIMIT_EXCEEDED`| Warning | P2 | تجاوز حجم الطلب 10MB أو مهلة القراءة 30 ثانية | قطع الاتصال برمز 413 Payload Too Large |
| `SEC_INFRA_DEV_ROUTE_BLOCKED` | High | P2 | محاولة استدعاء مسارات التطوير `/api/dev/*` في الإنتاج | حجب فوري 404 Not Found كأن المسار غير موجود |
| `SEC_INFRA_PATH_TRAVERSAL_BLOCKED`| **Critical** | **P1** | محاولة استخدام `../` للوصول لملفات النظام من مسار المرفقات | رفض فوري 400 Bad Request وحظر المسار |
| `SEC_INFRA_SWAGGER_BLOCKED` | Info | P3 | استدعاء Swagger UI أو OpenAPI JSON في الإنتاج | إرجاع 404 تلقائياً |
| `SEC_INFRA_ADMIN_PORTAL_DISABLED` | Warning | P2 | استدعاء بوابة الأدمن عند تعطيل Feature Flag | إرجاع 404 لحجب وجود لوحة التحكم |

---

### الفئة 5: التكاملات الخارجية وخطافات الويب (External Integrations)

| رمز الحدث (Event ID) | درجة الخطورة | مستوى الإنذار | الوصف وسبب الإطلاق | الإجراء الآلي للنظام |
|:---|:---:|:---:|:---|:---|
| `SEC_INTEGRATION_WEBHOOK_VALID` | Info | P3 | استلام إشعار بوسطة صالح ومطابق لتوقيع HMAC | تحديث حالة الشحنة |
| `SEC_INTEGRATION_WEBHOOK_TAMPERED`| **Critical** | **P1** | **توقيع HMAC غير مطابق أو مفقود في إشعار بوسطة** | **حجب 401 وتسجيل محاولة التزوير والـ IP** |
| `SEC_INTEGRATION_WEBHOOK_EXPIRED` | Warning | P2 | فارق توقيت الإشعار تجاوز 5 دقائق (Timestamp Skew) | رفض الطلب 400 لمنع هجمات الإعادة Replay |
| `SEC_INTEGRATION_WEBHOOK_REPLAYED`| Info | P3 | استلام نفس معرف الحدث الخارجي مرة أخرى | تأكيد الاستلام 200 دون تكرار العمليات |
| `SEC_INTEGRATION_SSRF_BLOCKED` | **Critical** | **P1** | **محاولة إرسال طلب خادم لـ IP محلي/خاص أو Cloud Metadata**| **حجب فوري للطلب وقطع الاتصال** |

---

## 3. مستويات الإنذار وتصعيد الحوادث (Alerting Levels)

- **P1 (Critical — استجابة فورية خلال 15 دقيقة)**:
  - سرقة رمز التجديد وإعادة استخدامه (`SEC_AUTH_TOKEN_REUSE_DETECTED`).
  - محاولة هجوم SSRF على الخدمات الداخلية أو الـ Metadata (`SEC_INTEGRATION_SSRF_BLOCKED`).
  - تزوير توقيع خطافات الشحن أو الدفع (`SEC_INTEGRATION_WEBHOOK_TAMPERED`).
  - محاولات اختراق وتجاوز مسارات الملفات (`SEC_INFRA_PATH_TRAVERSAL_BLOCKED`).
- **P2 (High — استجابة وتدقيق خلال ساعتين)**:
  - هجمات التخمين Brute-force وتكرار محاولات الدخول الفاشلة (`SEC_AUTH_BRUTE_FORCE_DETECTED`).
  - تكرار محاولات تجاوز الصلاحيات BOLA/IDOR من نفس الحساب أو الـ IP.
  - تلاعب العميل بالأسعار أو الخصومات في طلبات الشراء.
- **P3 (Medium/Low — مراجعة تشغيلية يومية)**:
  - محاولات الدخول الفردية الفاشلة، انتهاء صلاحية الرموز الطبيعي، وتجاوز حدود المخزون العادية.
