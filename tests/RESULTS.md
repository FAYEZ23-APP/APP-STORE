# Automated Test Suite Execution Results

> Generated exclusively from live process execution by `scripts/run-all-tests.ps1`. No hardcoded or persisted result tables exist.

## Execution Metadata
- **Timestamp**: 2026-11-02 11:34:52 +02:00
- **Git Commit**: `937973b3e743e59227d79ebc8363214f848d737d`
- **Database Name**: `MarketplaceMVP_test` (PostgreSQL; connection string redacted)
- **Runtime**: Node.js v24.14.0 | .NET 10.0.201
- **Suites Summary**: **7** PASS, **0** FAIL, **11** NOT RUN (Total: 18 Suites -- 0/11 POSTGRES, 7 MOCK/STATIC)

## Test Suites Summary Table

| # | Suite Name | Provider | Status | Duration |
|:-:|:-----------|:---------|:------:|:--------:|
| 1 | Mobile Authentication Flows & Validators | MOCK | PASS | 0.3s |
| 2 | Mobile Biometric Cold Start & Password Fallback | MOCK | PASS | 0.17s |
| 3 | Mobile Biometric Lock State Machine | MOCK | PASS | 0.22s |
| 4 | Mobile Single-Flight Refresh | MOCK | PASS | 0.21s |
| 5 | Mobile Feature Gating & Safe Defaults | MOCK | PASS | 0.12s |
| 6 | Mobile i18n Locales Exact Parity & Reference Audit | STATIC | PASS | 0.18s |
| 7 | Backend Stage 5 Refresh Token Grace Window Simulation | MOCK | PASS | 0.13s |
| 8 | Backend Shipping Distance & Fee Calculation | POSTGRES (TEST_DB) | NOT RUN | 0s |
| 9 | Backend Stage 3 Multiple Images, EXIF Stripping & Magic Bytes | POSTGRES (TEST_DB) | NOT RUN | 0s |
| 10 | Backend Stage 4 Product Reviews E2E | POSTGRES (TEST_DB) | NOT RUN | 0s |
| 11 | Backend Admin Portal & User Management E2E | POSTGRES (TEST_DB) | NOT RUN | 0s |
| 12 | Backend Account Deletion, Auth Privacy & 37-Route IDOR/Role Suite | POSTGRES (TEST_DB) | NOT RUN | 0s |
| 13 | Backend Batch 5 PII & OTP Log Masking (D-002 / M0-02) | POSTGRES (TEST_DB) | NOT RUN | 0s |
| 14 | Backend Batch 6 Unique Order Idempotency Race (D-003) | POSTGRES (TEST_DB) | NOT RUN | 0s |
| 15 | Backend Batch 7 Cancel vs Handover Row-Lock Race (D-004) | POSTGRES (TEST_DB) | NOT RUN | 0s |
| 16 | Backend Batch 8 PUT /api/orders/{id}/status Admin-Only Lock (D-005) | POSTGRES (TEST_DB) | NOT RUN | 0s |
| 17 | Backend Batch 9 /api/health Redaction & 180/min Rate Limit (D-009, D-016) | POSTGRES (TEST_DB) | NOT RUN | 0s |
| 18 | Backend PostgreSQL Verification Pack (11 Checks) | POSTGRES (TEST_DB) | NOT RUN | 0s |

---

## Account Deletion, Auth Privacy & 37-Route Ownership/Role Checks (Current Run Output)

- **Source Suite**: `backend_account_deletion_and_idor_postgres` (POSTGRES (TEST_DB))
- **Check Totals**: **0** PASS, **0** FAIL, **42** NOT RUN (Total: 42)

| Check | Scenario / Route Verification | Provider | Status | Live Run Output |
|:-----:|:------------------------------|:---------|:------:|:----------------|
| A1 | Login with correct password returns 200; wrong password returns generic 401 | POSTGRES (TEST_DB) | NOT RUN | Backend dotnet build failed prior to suite startup. |
| A2 | Inactive user login returns generic 401 (identical to wrong password, never 403) | POSTGRES (TEST_DB) | NOT RUN | Backend dotnet build failed prior to suite startup. |
| A3 | GET /api/users/me/export-data includes user records and ZERO password/token/code hashes | POSTGRES (TEST_DB) | NOT RUN | Backend dotnet build failed prior to suite startup. |
| A4 | Seller deletion blocked (409); Buyer deletion (204) scrubs order PII, revokes JWT (401), blocks login (401), and anonymizes review | POSTGRES (TEST_DB) | NOT RUN | Backend dotnet build failed prior to suite startup. |
| A5 | Real-money routes (Wallet, VendorPayouts, Coupons) default to OFF and return 404 | POSTGRES (TEST_DB) | NOT RUN | Backend dotnet build failed prior to suite startup. |
| R01 | POST /api/admin/reviews/{id:int}/hide enforces Admin role | POSTGRES (TEST_DB) | NOT RUN | Backend dotnet build failed prior to suite startup. |
| R02 | POST /api/admin/reviews/{id:int}/unhide enforces Admin role | POSTGRES (TEST_DB) | NOT RUN | Backend dotnet build failed prior to suite startup. |
| R03 | POST /api/admin/shipments/{id:int}/settle-cod enforces Admin role + step-up Password & TOTP | POSTGRES (TEST_DB) | NOT RUN | Backend dotnet build failed prior to suite startup. |
| R04 | PUT /api/admin/users/{id:int}/status enforces Admin role & blocks self-deactivation | POSTGRES (TEST_DB) | NOT RUN | Backend dotnet build failed prior to suite startup. |
| R05 | POST /api/admin/wallet/payouts/{id:int}/process enforces Admin role | POSTGRES (TEST_DB) | NOT RUN | Backend dotnet build failed prior to suite startup. |
| R06 | DELETE /api/categories/{id:int} enforces Admin role | POSTGRES (TEST_DB) | NOT RUN | Backend dotnet build failed prior to suite startup. |
| R07 | GET /api/categories/{id:int} allows public read of active category & 404 after delete | POSTGRES (TEST_DB) | NOT RUN | Backend dotnet build failed prior to suite startup. |
| R08 | PUT /api/categories/{id:int} enforces Admin role | POSTGRES (TEST_DB) | NOT RUN | Backend dotnet build failed prior to suite startup. |
| R09 | POST /api/dev/carrier/shipments/{id:int}/settle-cod rejects invalid secret (401) & accepts valid secret in Dev | POSTGRES (TEST_DB) | NOT RUN | Backend dotnet build failed prior to suite startup. |
| R10 | PUT /api/dev/carrier/shipments/{id:int}/status rejects invalid secret (401) & accepts valid secret in Dev | POSTGRES (TEST_DB) | NOT RUN | Backend dotnet build failed prior to suite startup. |
| R11 | GET /api/files/private/{fileName} enforces PDPL party ownership (Uploader BuyerA, Counterparty SellerA, Admin only) | POSTGRES (TEST_DB) | NOT RUN | Backend dotnet build failed prior to suite startup. |
| R12 | PUT /api/notifications/{id:int}/read scopes lookup to n.UserId == userId (404 for other user) | POSTGRES (TEST_DB) | NOT RUN | Backend dotnet build failed prior to suite startup. |
| R13 | GET /api/orders/{id:int} enforces Buyer/Admin role & order.BuyerId == userId | POSTGRES (TEST_DB) | NOT RUN | Backend dotnet build failed prior to suite startup. |
| R14 | POST /api/orders/{id:int}/cancel enforces Buyer role & order.BuyerId == buyerId | POSTGRES (TEST_DB) | NOT RUN | Backend dotnet build failed prior to suite startup. |
| R15 | PUT /api/orders/{id:int}/status enforces Admin-only role (D-005 closed) | POSTGRES (TEST_DB) | NOT RUN | Backend dotnet build failed prior to suite startup. |
| R16 | DELETE /api/products/{id:int} enforces Seller role & product.SellerId == sellerId | POSTGRES (TEST_DB) | NOT RUN | Backend dotnet build failed prior to suite startup. |
| R17 | GET /api/products/{id:int} allows public read of active product & 404 when soft-deleted | POSTGRES (TEST_DB) | NOT RUN | Backend dotnet build failed prior to suite startup. |
| R18 | PUT /api/products/{id:int} enforces Seller role & product.SellerId == sellerId | POSTGRES (TEST_DB) | NOT RUN | Backend dotnet build failed prior to suite startup. |
| R19 | PATCH /api/products/{id:int}/quick-stock enforces Seller role & product.SellerId == sellerId | POSTGRES (TEST_DB) | NOT RUN | Backend dotnet build failed prior to suite startup. |
| R20 | GET /api/products/{id:int}/review-eligibility enforces Authenticated user & scopes to caller | POSTGRES (TEST_DB) | NOT RUN | Backend dotnet build failed prior to suite startup. |
| R21 | GET /api/products/{productId:int}/reviews allows public read of non-hidden reviews | POSTGRES (TEST_DB) | NOT RUN | Backend dotnet build failed prior to suite startup. |
| R22 | POST /api/products/{productId:int}/reviews enforces Buyer role & Delivered shipment ownership | POSTGRES (TEST_DB) | NOT RUN | Backend dotnet build failed prior to suite startup. |
| R23 | GET /api/products/store/{sellerId:int} allows public read of active Seller & 404 for non-Seller | POSTGRES (TEST_DB) | NOT RUN | Backend dotnet build failed prior to suite startup. |
| R24 | PUT /api/returns/{id:int}/resolve enforces Seller role & return.SellerId == currentUserId | POSTGRES (TEST_DB) | NOT RUN | Backend dotnet build failed prior to suite startup. |
| R25 | DELETE /api/reviews/{id:int} enforces review.BuyerId == userId \|\| isAdmin | POSTGRES (TEST_DB) | NOT RUN | Backend dotnet build failed prior to suite startup. |
| R26 | PUT /api/reviews/{id:int} enforces Buyer role & review.BuyerId == buyerId | POSTGRES (TEST_DB) | NOT RUN | Backend dotnet build failed prior to suite startup. |
| R27 | POST /api/reviews/{id:int}/reply enforces Seller role & product.SellerId == sellerId | POSTGRES (TEST_DB) | NOT RUN | Backend dotnet build failed prior to suite startup. |
| R28 | POST /api/reviews/{id:int}/report enforces Authenticated caller & one report per reporter | POSTGRES (TEST_DB) | NOT RUN | Backend dotnet build failed prior to suite startup. |
| R29 | GET /api/reviews/can-review/{productId:int} enforces Authenticated user & scopes to caller | POSTGRES (TEST_DB) | NOT RUN | Backend dotnet build failed prior to suite startup. |
| R30 | PUT /api/shipments/{id:int}/status enforces Seller role, shipment.SellerId == sellerId, and HandedToCarrier-only transition | POSTGRES (TEST_DB) | NOT RUN | Backend dotnet build failed prior to suite startup. |
| R31 | DELETE /api/users/me/addresses/{id:int} enforces address.UserId == userId | POSTGRES (TEST_DB) | NOT RUN | Backend dotnet build failed prior to suite startup. |
| R32 | GET /api/users/me/addresses/{id:int} enforces address.UserId == userId | POSTGRES (TEST_DB) | NOT RUN | Backend dotnet build failed prior to suite startup. |
| R33 | PUT /api/users/me/addresses/{id:int} enforces address.UserId == userId | POSTGRES (TEST_DB) | NOT RUN | Backend dotnet build failed prior to suite startup. |
| R34 | POST /api/wishlist/{productId:int}/toggle enforces Buyer-only role & scopes to caller userId | POSTGRES (TEST_DB) | NOT RUN | Backend dotnet build failed prior to suite startup. |
| R35 | PUT /api/admin/shipments/{id:int}/status enforces Admin role | POSTGRES (TEST_DB) | NOT RUN | Backend dotnet build failed prior to suite startup. |
| R36 | POST /api/orders/{id:int}/confirm enforces Buyer/Admin role & order.BuyerId == userId | POSTGRES (TEST_DB) | NOT RUN | Backend dotnet build failed prior to suite startup. |
| R37 | PUT /api/returns/{id:int}/confirm-received enforces Seller/Admin role & return.SellerId == actorId | POSTGRES (TEST_DB) | NOT RUN | Backend dotnet build failed prior to suite startup. |

---

## PostgreSQL Verification Pack Per-Check Results (Current Run Output)

- **Source Suite**: `backend_verification_pack_postgres` (POSTGRES (TEST_DB))
- **Check Totals**: **0** PASS, **0** FAIL, **11** NOT RUN (Total: 11)

| Check | Scenario / Route Verification | Provider | Status | Live Run Output |
|:-----:|:------------------------------|:---------|:------:|:----------------|
| 1 | 2 Parallel Orders on LAST Unit (Stock=1) | POSTGRES (TEST_DB) | NOT RUN | Backend dotnet build failed prior to suite startup. |
| 2 | 10 Parallel Orders on LAST Unit (Stock=1) | POSTGRES (TEST_DB) | NOT RUN | Backend dotnet build failed prior to suite startup. |
| 3 | Idempotency Key on POST /api/orders | POSTGRES (TEST_DB) | NOT RUN | Backend dotnet build failed prior to suite startup. |
| 4 | Buyer Cancel before HandedToCarrier | POSTGRES (TEST_DB) | NOT RUN | Backend dotnet build failed prior to suite startup. |
| 5 | Email & Phone Uniqueness in Parallel & Case-Insensitive | POSTGRES (TEST_DB) | NOT RUN | Backend dotnet build failed prior to suite startup. |
| 6 | Account Deletion on Real Tables | POSTGRES (TEST_DB) | NOT RUN | Backend dotnet build failed prior to suite startup. |
| 7 | Review Eligibility & 10 Parallel Reviews | POSTGRES (TEST_DB) | NOT RUN | Backend dotnet build failed prior to suite startup. |
| 8 | Image Upload Rules Enforcement | POSTGRES (TEST_DB) | NOT RUN | Backend dotnet build failed prior to suite startup. |
| 9 | Refresh Token Rotation under Parallel Calls | POSTGRES (TEST_DB) | NOT RUN | Backend dotnet build failed prior to suite startup. |
| 10 | Login Rejects Inactive and Deleted Accounts | POSTGRES (TEST_DB) | NOT RUN | Backend dotnet build failed prior to suite startup. |
| 11 | /api/dev/* and Swagger Absent in Staging & Production | POSTGRES (TEST_DB) | NOT RUN | Backend dotnet build failed prior to suite startup. |

---

## Raw Output Tails per Suite

### Mobile Authentication Flows & Validators
- **Provider**: MOCK
- **Status**: PASS (Duration: 0.3s, Exit Code: 0)

```text
🧪 Starting Mobile Authentication Unit & Flow Tests...
--- Test 1: i18n Locales Exact Parity ---
✅ [PASS] i18n locale files in 100% sync (1096 keys, all auth keys present)
--- Test 2: Egyptian Phone Validation & Normalization ---
✅ [PASS] Egyptian phone validator, normalizer, and formatter all accurate
--- Test 3: OTP 6-Box Logic Simulation ---
✅ [PASS] OTP 6-digit input and paste handling verified
--- Test 4: Cooldown 60s Resend State Machine ---
✅ [PASS] 60-second cooldown timer state machine verified
--- Test 5: AppNavigator Stack Screens Verification ---
✅ [PASS] All 5 auth screens verified in AppNavigator (Login, Register, Verify, ForgotPassword, ResetPassword)
🎉 ALL MOBILE AUTH COMPLETION TESTS PASSED SUCCESSFULLY!
```

### Mobile Biometric Cold Start & Password Fallback
- **Provider**: MOCK
- **Status**: PASS (Duration: 0.17s, Exit Code: 0)

```text
================================================================
🧪 RUNNING B.2 & B.4 BIOMETRIC COLD START & LOGOUT UNIT TESTS
================================================================
--- TEST 1: Cold start with biometrics enabled makes ZERO network calls ---
✅ TEST 1 PASSED: App locked immediately with 0 network calls.
--- TEST 2: Successful biometric unlock performs refresh and unlocks ---
✅ TEST 2 PASSED: Refresh executed only after unlock, tokens updated, app unlocked.
--- TEST 3: "Use Password" revokes refresh token on server and wipes local credentials ---
✅ TEST 3 PASSED: Server revocation called best-effort and local storage wiped.
================================================================
🎉 ALL B.2 AND B.4 UNIT TESTS PASSED SUCCESSFULLY! (3/3)
================================================================
```

### Mobile Biometric Lock State Machine
- **Provider**: MOCK
- **Status**: PASS (Duration: 0.22s, Exit Code: 0)

```text
================================================================
🧪 BIOMETRIC LOCK / UNLOCK STATE MACHINE UNIT TESTS
================================================================
✅ PASS: Cold start: biometrics enabled + refresh token -> transitions to LOCKED
✅ PASS: Cold start: biometrics disabled -> transitions to UNLOCKED
✅ PASS: Cold start: no refresh token -> transitions to LOGGED_OUT
✅ PASS: Resume < 2 minutes (e.g. 45s): remains UNLOCKED
✅ PASS: Resume < 2 minutes (boundary 119,999ms): remains UNLOCKED
✅ PASS: Resume exactly 2 minutes (120,000ms): transitions to LOCKED
✅ PASS: Resume > 2 minutes (e.g. 5m): transitions to LOCKED
✅ PASS: Resume > 2 minutes but biometrics disabled: remains UNLOCKED
✅ PASS: Resume > 2 minutes but no refresh token: transitions to LOGGED_OUT
✅ PASS: Custom configurable timeout (e.g. 30s): locks after 31s
✅ PASS: Unlock prompt: biometric success + refresh success -> transitions to UNLOCKED and resumes app
✅ PASS: Unlock prompt: biometric cancelled/failed -> remains LOCKED with retry
✅ PASS: Unlock prompt: biometric succeeded but backend refresh failed (401/expired) -> transitions to LOGGED_OUT
✅ PASS: Fresh install detection: first run wipes credentials and marks initialized
================================================================
TOTAL: 14 | PASSED: 14 | FAILED: 0
================================================================
```

### Mobile Single-Flight Refresh
- **Provider**: MOCK
- **Status**: PASS (Duration: 0.21s, Exit Code: 0)

```text
--- Running Mobile Single-Flight Refresh Unit Tests ---
[Test 1] 5 parallel requests with expired access token...
✅ Test 1 Passed: Exactly ONE /auth/refresh call made, rotated tokens saved before resolving, all 5 requests succeeded.
[Test 2] Sequential request with already refreshed token...
✅ Test 2 Passed: No redundant refresh call when access token is already fresh.
[Test 3] Refresh failure rejects all waiting callers and clears storage...
✅ Test 3 Passed: In-flight refresh failure propagates cleanly to all 5 parallel callers.
All Single-Flight Refresh Tests Passed Successfully!
```

### Mobile Feature Gating & Safe Defaults
- **Provider**: MOCK
- **Status**: PASS (Duration: 0.12s, Exit Code: 0)

```text
--- STARTING MOBILE FEATURE GATING UNIT TESTS ---
[PASS] DEFAULT_CONFIG defaults every optional feature to OFF (false)
[PASS] DEFAULT_CONFIG is immutable (frozen)
[PASS] Returns all features OFF when API rejects (network down / 500)
[PASS] Returns all features OFF when API response data is null or empty
[PASS] Correctly parses and types boolean flags when API responds with true
[PASS] Hides Google sign-in button when googleEnabled is false
[PASS] Hides Wallet card and Coupon input in Checkout when flags are false
[PASS] Hides Buyer Wallet section in Profile when walletEnabled is false
[PASS] Hides Admin Payouts tab when vendorPayoutsEnabled and walletEnabled are false
Results: 9 passed, 0 failed.
```

### Mobile i18n Locales Exact Parity & Reference Audit
- **Provider**: STATIC
- **Status**: PASS (Duration: 0.18s, Exit Code: 0)

```text
🌐 Validating i18n locale files and source code references...
📊 Translation Key Statistics:
   - Total locale keys (in sync): 1096
   - Static keys extracted from source: 682
   - Dynamic namespaces detected: shipmentStatus, orderStatus, categories, returnStatus, returnReason, payoutStatus, payoutMethod, walletTxType, roles, deliveryMethod, paymentMethod
   - Backend enum/API values verified across 11 namespaces: 53
   - Unreferenced keys (candidates for pruning): 355
✅ i18n check passed! Both ar.json and en.json are in 100% sync (1096 keys), all static keys exist, and all 53 backend enum/API values are covered.
```

### Backend Stage 5 Refresh Token Grace Window Simulation
- **Provider**: MOCK
- **Status**: PASS (Duration: 0.13s, Exit Code: 0)

```text
================================================================
🧪 RUNNING B.3 SERVER REFRESH TOKEN GRACE WINDOW UNIT TESTS
================================================================
--- TEST 1: Standard token rotation T1 -> T2 ---
✅ TEST 1 PASSED: T1 rotated to T2 successfully.
--- TEST 2: Crash recovery within 20s grace window (T1 -> T3) ---
✅ TEST 2 PASSED: T1 accepted under grace window; T2 revoked and fresh T3 issued.
--- TEST 3: Repeat use of T1 (2nd retry) triggers reuse detection & kills family ---
✅ TEST 3 PASSED: Second reuse of T1 detected and family revoked with HTTP 401.
--- TEST 4: Reuse attempt beyond 20-second grace window kills family ---
✅ TEST 4 PASSED: Attempt beyond 20s grace window killed token family with HTTP 401.
--- TEST 5: Explicitly revoked token without rotation never receives grace ---
✅ TEST 5 PASSED: Explicitly revoked token rejected immediately without grace.
================================================================
🎉 ALL B.3 SERVER GRACE WINDOW TESTS PASSED SUCCESSFULLY! (5/5)
================================================================
```

### Backend Shipping Distance & Fee Calculation
- **Provider**: POSTGRES (TEST_DB)
- **Status**: NOT RUN (Duration: 0s, Exit Code: -1)

```text
Backend dotnet build failed prior to suite startup.
```

### Backend Stage 3 Multiple Images, EXIF Stripping & Magic Bytes
- **Provider**: POSTGRES (TEST_DB)
- **Status**: NOT RUN (Duration: 0s, Exit Code: -1)

```text
Backend dotnet build failed prior to suite startup.
```

### Backend Stage 4 Product Reviews E2E
- **Provider**: POSTGRES (TEST_DB)
- **Status**: NOT RUN (Duration: 0s, Exit Code: -1)

```text
Backend dotnet build failed prior to suite startup.
```

### Backend Admin Portal & User Management E2E
- **Provider**: POSTGRES (TEST_DB)
- **Status**: NOT RUN (Duration: 0s, Exit Code: -1)

```text
Backend dotnet build failed prior to suite startup.
```

### Backend Account Deletion, Auth Privacy & 37-Route IDOR/Role Suite
- **Provider**: POSTGRES (TEST_DB)
- **Status**: NOT RUN (Duration: 0s, Exit Code: -1)

```text
Backend dotnet build failed prior to suite startup.
```

### Backend Batch 5 PII & OTP Log Masking (D-002 / M0-02)
- **Provider**: POSTGRES (TEST_DB)
- **Status**: NOT RUN (Duration: 0s, Exit Code: -1)

```text
Backend dotnet build failed prior to suite startup.
```

### Backend Batch 6 Unique Order Idempotency Race (D-003)
- **Provider**: POSTGRES (TEST_DB)
- **Status**: NOT RUN (Duration: 0s, Exit Code: -1)

```text
Backend dotnet build failed prior to suite startup.
```

### Backend Batch 7 Cancel vs Handover Row-Lock Race (D-004)
- **Provider**: POSTGRES (TEST_DB)
- **Status**: NOT RUN (Duration: 0s, Exit Code: -1)

```text
Backend dotnet build failed prior to suite startup.
```

### Backend Batch 8 PUT /api/orders/{id}/status Admin-Only Lock (D-005)
- **Provider**: POSTGRES (TEST_DB)
- **Status**: NOT RUN (Duration: 0s, Exit Code: -1)

```text
Backend dotnet build failed prior to suite startup.
```

### Backend Batch 9 /api/health Redaction & 180/min Rate Limit (D-009, D-016)
- **Provider**: POSTGRES (TEST_DB)
- **Status**: NOT RUN (Duration: 0s, Exit Code: -1)

```text
Backend dotnet build failed prior to suite startup.
```

### Backend PostgreSQL Verification Pack (11 Checks)
- **Provider**: POSTGRES (TEST_DB)
- **Status**: NOT RUN (Duration: 0s, Exit Code: -1)

```text
Backend dotnet build failed prior to suite startup.
```
