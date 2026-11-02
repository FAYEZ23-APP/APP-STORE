# Automated Test Suite Execution Results

> Generated exclusively from live process execution by `scripts/run-all-tests.ps1`. No hardcoded or persisted result tables exist.

## Execution Metadata
- **Timestamp**: 2026-11-02 03:41:49 +02:00
- **Git Commit**: `4e25dc547b557c5374eb45b2122796000abb28cc`
- **Database Name**: `MarketplaceMVP_test` (PostgreSQL; connection string redacted)
- **Runtime**: Node.js v24.14.0 | .NET 10.0.201
- **Suites Summary**: **18** PASS, **0** FAIL, **0** NOT RUN (Total: 18 Suites -- 11/11 POSTGRES, 7 MOCK/STATIC)

## Test Suites Summary Table

| # | Suite Name | Provider | Status | Duration |
|:-:|:-----------|:---------|:------:|:--------:|
| 1 | Mobile Authentication Flows & Validators | MOCK | PASS | 0.3s |
| 2 | Mobile Biometric Cold Start & Password Fallback | MOCK | PASS | 0.07s |
| 3 | Mobile Biometric Lock State Machine | MOCK | PASS | 0.07s |
| 4 | Mobile Single-Flight Refresh | MOCK | PASS | 0.15s |
| 5 | Mobile Feature Gating & Safe Defaults | MOCK | PASS | 0.07s |
| 6 | Mobile i18n Locales Exact Parity & Reference Audit | STATIC | PASS | 0.11s |
| 7 | Backend Stage 5 Refresh Token Grace Window Simulation | MOCK | PASS | 0.06s |
| 8 | Backend Shipping Distance & Fee Calculation | POSTGRES (TEST_DB) | PASS | 9.04s |
| 9 | Backend Stage 3 Multiple Images, EXIF Stripping & Magic Bytes | POSTGRES (TEST_DB) | PASS | 11.37s |
| 10 | Backend Stage 4 Product Reviews E2E | POSTGRES (TEST_DB) | PASS | 54.05s |
| 11 | Backend Admin Portal & User Management E2E | POSTGRES (TEST_DB) | PASS | 15.03s |
| 12 | Backend Account Deletion, Auth Privacy & 37-Route IDOR/Role Suite | POSTGRES (TEST_DB) | PASS | 27.52s |
| 13 | Backend Batch 5 PII & OTP Log Masking (D-002 / M0-02) | POSTGRES (TEST_DB) | PASS | 74.71s |
| 14 | Backend Batch 6 Unique Order Idempotency Race (D-003) | POSTGRES (TEST_DB) | PASS | 67.54s |
| 15 | Backend Batch 7 Cancel vs Handover Row-Lock Race (D-004) | POSTGRES (TEST_DB) | PASS | 64.38s |
| 16 | Backend Batch 8 PUT /api/orders/{id}/status Admin-Only Lock (D-005) | POSTGRES (TEST_DB) | PASS | 12.23s |
| 17 | Backend Batch 9 /api/health Redaction & 180/min Rate Limit (D-009, D-016) | POSTGRES (TEST_DB) | PASS | 15.09s |
| 18 | Backend PostgreSQL Verification Pack (11 Checks) | POSTGRES (TEST_DB) | PASS | 64.64s |

---

## Account Deletion, Auth Privacy & 37-Route Ownership/Role Checks (Current Run Output)

- **Source Suite**: `backend_account_deletion_and_idor_postgres` (POSTGRES (TEST_DB))
- **Check Totals**: **42** PASS, **0** FAIL, **0** NOT RUN (Total: 42)

| Check | Scenario / Route Verification | Provider | Status | Live Run Output |
|:-----:|:------------------------------|:---------|:------:|:----------------|
| A1 | Login with correct password returns 200; wrong password returns generic 401 | PostgreSQL (TEST_DB) | PASS | goodLogin=200, wrongPass=401 (Invalid email or password.) |
| A2 | Inactive user login returns generic 401 (identical to wrong password, never 403) | PostgreSQL (TEST_DB) | PASS | rightPass=401 ("Invalid email or password."), wrongPass=401 |
| A3 | GET /api/users/me/export-data includes user records and ZERO password/token/code hashes | PostgreSQL (TEST_DB) | PASS | status=200, orders=1, reviews=1, sessions=2, hashViolations=0 |
| A4 | Seller deletion blocked (409); Buyer deletion (204) scrubs order PII, revokes JWT (401), blocks login (401), and anonymizes review | PostgreSQL (TEST_DB) | PASS | SellerDel=409, BuyerDel=204, OldJwt=401, Relogin=401, ScrubbedRecipient="", KeptGov="القاهرة", Reviewer="مشتري" |
| A5 | Real-money routes (Wallet, VendorPayouts, Coupons) default to OFF and return 404 | PostgreSQL (TEST_DB) | PASS | me/wallet=404, admin/payouts=404, process=404, settle-cod=404, coupons=404 |
| R01 | POST /api/admin/reviews/{id:int}/hide enforces Admin role | PostgreSQL (TEST_DB) | PASS | Buyer=403, Admin=200 |
| R02 | POST /api/admin/reviews/{id:int}/unhide enforces Admin role | PostgreSQL (TEST_DB) | PASS | Seller=403, Admin=200 |
| R03 | POST /api/admin/shipments/{id:int}/settle-cod enforces Admin role + step-up Password & TOTP | PostgreSQL (TEST_DB) | PASS | Seller=403, WrongStepUpPass=401, AdminWithTotp=200 |
| R04 | PUT /api/admin/users/{id:int}/status enforces Admin role & blocks self-deactivation | PostgreSQL (TEST_DB) | PASS | Buyer=403, AdminSelf=400, AdminTarget=200 |
| R05 | POST /api/admin/wallet/payouts/{id:int}/process enforces Admin role | PostgreSQL (TEST_DB) | PASS | Seller=403, Admin=200 |
| R06 | DELETE /api/categories/{id:int} enforces Admin role | PostgreSQL (TEST_DB) | PASS | Buyer=403, Admin=200 |
| R07 | GET /api/categories/{id:int} allows public read of active category & 404 after delete | PostgreSQL (TEST_DB) | PASS | AnonGet=200 |
| R08 | PUT /api/categories/{id:int} enforces Admin role | PostgreSQL (TEST_DB) | PASS | Seller=403, Admin=200 |
| R09 | POST /api/dev/carrier/shipments/{id:int}/settle-cod rejects invalid secret (401) & accepts valid secret in Dev | PostgreSQL (TEST_DB) | PASS | BadSecret=401, ValidSecret=200 |
| R10 | PUT /api/dev/carrier/shipments/{id:int}/status rejects invalid secret (401) & accepts valid secret in Dev | PostgreSQL (TEST_DB) | PASS | BadSecret=401 |
| R11 | GET /api/files/private/{fileName} enforces PDPL party ownership (Uploader BuyerA, Counterparty SellerA, Admin only) | PostgreSQL (TEST_DB) | PASS | Anon=401, BuyerB=403, SellerB=403, BuyerA=200, SellerA=200, Admin=200 |
| R12 | PUT /api/notifications/{id:int}/read scopes lookup to n.UserId == userId (404 for other user) | PostgreSQL (TEST_DB) | PASS | BuyerB=404, BuyerA=200 |
| R13 | GET /api/orders/{id:int} enforces Buyer/Admin role & order.BuyerId == userId | PostgreSQL (TEST_DB) | PASS | Seller=403, BuyerB=403, BuyerA=200, Admin=200 |
| R14 | POST /api/orders/{id:int}/cancel enforces Buyer role & order.BuyerId == buyerId | PostgreSQL (TEST_DB) | PASS | Seller=403, BuyerB=403, BuyerA=200 |
| R15 | PUT /api/orders/{id:int}/status enforces Admin-only role (D-005 closed) | PostgreSQL (TEST_DB) | PASS | Seller=403, Buyer=403, Admin=204 |
| R16 | DELETE /api/products/{id:int} enforces Seller role & product.SellerId == sellerId | PostgreSQL (TEST_DB) | PASS | SellerB=403, SellerA=204, GetAfterDelete=404 |
| R17 | GET /api/products/{id:int} allows public read of active product & 404 when soft-deleted | PostgreSQL (TEST_DB) | PASS | Active=200, SoftDeleted=404 |
| R18 | PUT /api/products/{id:int} enforces Seller role & product.SellerId == sellerId | PostgreSQL (TEST_DB) | PASS | Buyer=403, SellerB=403, SellerA=200 |
| R19 | PATCH /api/products/{id:int}/quick-stock enforces Seller role & product.SellerId == sellerId | PostgreSQL (TEST_DB) | PASS | SellerB=403, SellerA=200 |
| R20 | GET /api/products/{id:int}/review-eligibility enforces Authenticated user & scopes to caller | PostgreSQL (TEST_DB) | PASS | Anon=401, EligibleBuyerB=true |
| R21 | GET /api/products/{productId:int}/reviews allows public read of non-hidden reviews | PostgreSQL (TEST_DB) | PASS | Status=200, Count=1 |
| R22 | POST /api/products/{productId:int}/reviews enforces Buyer role & Delivered shipment ownership | PostgreSQL (TEST_DB) | PASS | OwnSeller=403, DeliveredBuyerA=200 |
| R23 | GET /api/products/store/{sellerId:int} allows public read of active Seller & 404 for non-Seller | PostgreSQL (TEST_DB) | PASS | SellerA=200, NonSellerBuyer=404 |
| R24 | PUT /api/returns/{id:int}/resolve enforces Seller role & return.SellerId == currentUserId | PostgreSQL (TEST_DB) | PASS | Buyer=403, SellerB=403, SellerA=200 |
| R25 | DELETE /api/reviews/{id:int} enforces review.BuyerId == userId \|\| isAdmin | PostgreSQL (TEST_DB) | PASS | OtherBuyerA=403, OwnerBuyerB=204 |
| R26 | PUT /api/reviews/{id:int} enforces Buyer role & review.BuyerId == buyerId | PostgreSQL (TEST_DB) | PASS | BuyerB=403, BuyerA=200 |
| R27 | POST /api/reviews/{id:int}/reply enforces Seller role & product.SellerId == sellerId | PostgreSQL (TEST_DB) | PASS | SellerB=403, SellerA=200 |
| R28 | POST /api/reviews/{id:int}/report enforces Authenticated caller & one report per reporter | PostgreSQL (TEST_DB) | PASS | Anon=401, AuthBuyerB=200 |
| R29 | GET /api/reviews/can-review/{productId:int} enforces Authenticated user & scopes to caller | PostgreSQL (TEST_DB) | PASS | Anon=401, AuthBuyerB=200 |
| R30 | PUT /api/shipments/{id:int}/status enforces Seller role, shipment.SellerId == sellerId, and HandedToCarrier-only transition | PostgreSQL (TEST_DB) | PASS | Buyer=403, SellerB=403, SellerADelivered=403, SellerAHandover=200 |
| R31 | DELETE /api/users/me/addresses/{id:int} enforces address.UserId == userId | PostgreSQL (TEST_DB) | PASS | BuyerB=403, BuyerA=204 |
| R32 | GET /api/users/me/addresses/{id:int} enforces address.UserId == userId | PostgreSQL (TEST_DB) | PASS | BuyerB=403, BuyerA=200 |
| R33 | PUT /api/users/me/addresses/{id:int} enforces address.UserId == userId | PostgreSQL (TEST_DB) | PASS | BuyerB=403, BuyerA=200 |
| R34 | POST /api/wishlist/{productId:int}/toggle enforces Buyer-only role & scopes to caller userId | PostgreSQL (TEST_DB) | PASS | Seller=403, Admin=403, BuyerA=200 |
| R35 | PUT /api/admin/shipments/{id:int}/status enforces Admin role | PostgreSQL (TEST_DB) | PASS | Seller=403, Buyer=403, Admin=200 |
| R36 | POST /api/orders/{id:int}/confirm enforces Buyer/Admin role & order.BuyerId == userId | PostgreSQL (TEST_DB) | PASS | Seller=403, BuyerB=500 (unmodified=true), BuyerA=200 |
| R37 | PUT /api/returns/{id:int}/confirm-received enforces Seller/Admin role & return.SellerId == actorId | PostgreSQL (TEST_DB) | PASS | Buyer=403, SellerB=403, Admin=200 |

---

## PostgreSQL Verification Pack Per-Check Results (Current Run Output)

- **Source Suite**: `backend_verification_pack_postgres` (POSTGRES (TEST_DB))
- **Check Totals**: **11** PASS, **0** FAIL, **0** NOT RUN (Total: 11)

| Check | Scenario / Route Verification | Provider | Status | Live Run Output |
|:-----:|:------------------------------|:---------|:------:|:----------------|
| 1 | 2 Parallel Orders on LAST Unit (Stock=1) | PostgreSQL (TEST_DB) | PASS | Statuses=[201,400], stock=0 |
| 2 | 10 Parallel Orders on LAST Unit (Stock=1) | PostgreSQL (TEST_DB) | PASS | 201=1, 400=9, stock=0 |
| 3 | Idempotency Key on POST /api/orders | PostgreSQL (TEST_DB) | PASS | Both returned Order #822, stock 10->9 |
| 4 | Buyer Cancel before HandedToCarrier | PostgreSQL (TEST_DB) | PASS | Order #824 Cancelled, parallel cancel=[200,200], stock=5 |
| 5 | Email & Phone Uniqueness in Parallel & Case-Insensitive | PostgreSQL (TEST_DB) | PASS | Email=[202,409], Phone=[202,409], UpperLogin=200 |
| 6 | Account Deletion on Real Tables | PostgreSQL (TEST_DB) | PASS | DELETE=204, Relogin=401, OldToken=401 |
| 7 | Review Eligibility & 10 Parallel Reviews | PostgreSQL (TEST_DB) | PASS | Ineligible=403, 10-parallel avg=4 (count=10), dup=400 |
| 8 | Image Upload Rules Enforcement | PostgreSQL (TEST_DB) | PASS | Fake=400, Foreign=400, ExifRemoved=true, 9th=400 |
| 9 | Refresh Token Rotation under Parallel Calls | PostgreSQL (TEST_DB) | PASS | Parallel statuses=[200,200] |
| 10 | Login Rejects Inactive and Deleted Accounts | PostgreSQL (TEST_DB) | PASS | HTTP 401 |
| 11 | /api/dev/* and Swagger Absent in Staging & Production | PostgreSQL (TEST_DB) | PASS | Staging404=true, Production404=true |

---

## Raw Output Tails per Suite

### Mobile Authentication Flows & Validators
- **Provider**: MOCK
- **Status**: PASS (Duration: 0.3s, Exit Code: 0)

```text
🧪 Starting Mobile Authentication Unit & Flow Tests...
--- Test 1: i18n Locales Exact Parity ---
✅ [PASS] i18n locale files in 100% sync (1077 keys, all auth keys present)
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
- **Status**: PASS (Duration: 0.07s, Exit Code: 0)

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
- **Status**: PASS (Duration: 0.07s, Exit Code: 0)

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
- **Status**: PASS (Duration: 0.15s, Exit Code: 0)

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
- **Status**: PASS (Duration: 0.07s, Exit Code: 0)

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
- **Status**: PASS (Duration: 0.11s, Exit Code: 0)

```text
🌐 Validating i18n locale files and source code references...
📊 Translation Key Statistics:
   - Total locale keys (in sync): 1077
   - Static keys extracted from source: 672
   - Dynamic namespaces detected: shipmentStatus, orderStatus, categories, returnStatus, returnReason, payoutStatus, payoutMethod, walletTxType, roles, deliveryMethod, paymentMethod
   - Backend enum/API values verified across 11 namespaces: 53
   - Unreferenced keys (candidates for pruning): 346
✅ i18n check passed! Both ar.json and en.json are in 100% sync (1077 keys), all static keys exist, and all 53 backend enum/API values are covered.
```

### Backend Stage 5 Refresh Token Grace Window Simulation
- **Provider**: MOCK
- **Status**: PASS (Duration: 0.06s, Exit Code: 0)

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
- **Status**: PASS (Duration: 9.04s, Exit Code: 0)

```text
Database Name: MarketplaceMVP_test
--- Unit Verification: Haversine Formula ---
Cairo -> Alexandria straight-line distance: 179.98 km
Expected Haversine fallback shipping fee: 929.9 EGP
--- Live Endpoint Verification against MarketplaceMVP_test (http://localhost:56211/api/shipping/calculate-fee) ---
Response: {"distanceKm":179.98,"estimatedTime":"5 ساعة و 19 دقيقة تقريباً","totalShippingCost":929.9,"baseShippingFee":30,"distanceCost":899.9,"isRoadDistance":false,"source":"HaversineFallback"}
ALL SHIPPING CALCULATION CHECKS PASSED!
```

### Backend Stage 3 Multiple Images, EXIF Stripping & Magic Bytes
- **Provider**: POSTGRES (TEST_DB)
- **Status**: PASS (Duration: 11.37s, Exit Code: 0)

```text
Database Name: MarketplaceMVP_test
Running Stage 3 PostgreSQL E2E tests against http://localhost:60292 (DB: MarketplaceMVP_test)...
Test 1 (Upload 2000x1500 JPEG with EXIF GPS): 200 {
  url: '/uploads/b6caeffc-fc02-4361-ae50-9c9cd89a06ce.jpg',
  width: 1600,
  height: 1200,
  sizeBytes: 11537
}
Test 1b (Stored file EXIF/GPS check): {
  storedPath: 'D:\\Backend\\marketplace\\backend\\Marketplace.API\\wwwroot\\uploads\\b6caeffc-fc02-4361-ae50-9c9cd89a06ce.jpg',
  sizeBytes: 11537,
  stillHasExif: false
}
Test 2 (Fake .png with text content): 400 {
  status: 400,
  error: 'Invalid image file header. Magic bytes do not match expected image signature.'
}
Test 3 (Foreign/external URL rejected): 400 {"status":400,"error":"One or more validation errors occurred.","errors":{"ImageUrls[0]":["Each ImageUrl must be a relative path '/uploads/<guid>.<ext>' (external URLs are not allowed)."]}}
Test 4 (Another seller file rejected): 400 {"status":400,"error":"Image '/uploads/ec4e823d-8fc7-4b3d-bde4-17a0137fd055.jpg' belongs to another seller and cannot be used."}
Test 5 (9th image rejected): 400 {"status":400,"error":"One or more validation errors occurred.","errors":{"ImageUrls":["A product cannot have more than 8 images."]}}
Test 6 (8 ordered images accepted): 201 { id: 512, imageCount: 8, firstIsMain: true, orderMatches: true }
ALL STAGE 3 POSTGRESQL TESTS PASSED!
```

### Backend Stage 4 Product Reviews E2E
- **Provider**: POSTGRES (TEST_DB)
- **Status**: PASS (Duration: 54.05s, Exit Code: 0)

```text
200, 200
  ]
}
TEST 5 (Duplicate review rejected with 400): { status: 400 }
TEST 6 (Rating average & count after 10 parallel reviews + reviewer privacy + sort): {
  productRatingAverage: 4,
  productRatingCount: 10,
  summaryRatingAverage: 4,
  summaryRatingCount: 10,
  firstReviewerName: 'أحمد م.',
  highestFirstRating: 5
}
TEST 7 (Seller reply rules): {
  wrongSellerStatus: 403,
  ownerSellerStatus: 200,
  duplicateReplyStatus: 400
}
TEST 8a (Report abuse endpoint): { status: 200 }
TEST 8b (Admin hide review -> hidden review not returned & count=9): {
  hideStatus: 200,
  hiddenStillPresent: false,
  ratingCountAfterHide: 9,
  ratingAverageAfterHide: 3.9
}
ALL STAGE 4 POSTGRESQL E2E CHECKS PASSED!
```

### Backend Admin Portal & User Management E2E
- **Provider**: POSTGRES (TEST_DB)
- **Status**: PASS (Duration: 15.03s, Exit Code: 0)

```text
Database Name: MarketplaceMVP_test
Running Admin Portal E2E tests against PostgreSQL TEST_DB (MarketplaceMVP_test) on http://localhost:49295...
TEST 1 (Non-admin access rejected with 403): { status: 403 }
TEST 2 (Admin stats 200 OK): { status: 200 }
Stats Data: {
  totalUsers: 1022,
  totalBuyers: 734,
  totalSellers: 274,
  totalOrders: 643,
  totalVolume: 144867.8
}
TEST 3 (Admin list & filter users): {
  totalUsersReturned: 1022,
  sellersReturned: 274,
  firstUserRole: 'Buyer'
}
TEST 4 (Admin self-deactivation rejected with 400): { status: 400 }
TEST 5a (Suspend user): { status: 200 }
TEST 5b (Suspended user login rejected with 400/401/403): { status: 401 }
TEST 5c (Reactivate user): { status: 200 }
TEST 6 (Fetch reported reviews): { status: 200 }
Found 11 reported reviews in system.
ALL ADMIN PORTAL POSTGRESQL E2E CHECKS PASSED!
```

### Backend Account Deletion, Auth Privacy & 37-Route IDOR/Role Suite
- **Provider**: POSTGRES (TEST_DB)
- **Status**: PASS (Duration: 27.52s, Exit Code: 0)

```text
[PASS] #R15 PUT /api/orders/{id:int}/status enforces Admin-only role (D-005 closed) -> Seller=403, Buyer=403, Admin=204
  [PASS] #R36 POST /api/orders/{id:int}/confirm enforces Buyer/Admin role & order.BuyerId == userId -> Seller=403, BuyerB=500 (unmodified=true), BuyerA=200
  [PASS] #R16 DELETE /api/products/{id:int} enforces Seller role & product.SellerId == sellerId -> SellerB=403, SellerA=204, GetAfterDelete=404
  [PASS] #R17 GET /api/products/{id:int} allows public read of active product & 404 when soft-deleted -> Active=200, SoftDeleted=404
  [PASS] #R18 PUT /api/products/{id:int} enforces Seller role & product.SellerId == sellerId -> Buyer=403, SellerB=403, SellerA=200
  [PASS] #R19 PATCH /api/products/{id:int}/quick-stock enforces Seller role & product.SellerId == sellerId -> SellerB=403, SellerA=200
  [PASS] #R23 GET /api/products/store/{sellerId:int} allows public read of active Seller & 404 for non-Seller -> SellerA=200, NonSellerBuyer=404
  [PASS] #R20 GET /api/products/{id:int}/review-eligibility enforces Authenticated user & scopes to caller -> Anon=401, EligibleBuyerB=true
  [PASS] #R21 GET /api/products/{productId:int}/reviews allows public read of non-hidden reviews -> Status=200, Count=1
  [PASS] #R22 POST /api/products/{productId:int}/reviews enforces Buyer role & Delivered shipment ownership -> OwnSeller=403, DeliveredBuyerA=200
  [PASS] #R25 DELETE /api/reviews/{id:int} enforces review.BuyerId == userId || isAdmin -> OtherBuyerA=403, OwnerBuyerB=204
  [PASS] #R26 PUT /api/reviews/{id:int} enforces Buyer role & review.BuyerId == buyerId -> BuyerB=403, BuyerA=200
  [PASS] #R27 POST /api/reviews/{id:int}/reply enforces Seller role & product.SellerId == sellerId -> SellerB=403, SellerA=200
  [PASS] #R28 POST /api/reviews/{id:int}/report enforces Authenticated caller & one report per reporter -> Anon=401, AuthBuyerB=200
  [PASS] #R29 GET /api/reviews/can-review/{productId:int} enforces Authenticated user & scopes to caller -> Anon=401, AuthBuyerB=200
  [PASS] #R30 PUT /api/shipments/{id:int}/status enforces Seller role, shipment.SellerId == sellerId, and HandedToCarrier-only transition -> Buyer=403, SellerB=403, SellerADelivered=403, SellerAHandover=200
  [PASS] #R31 DELETE /api/users/me/addresses/{id:int} enforces address.UserId == userId -> BuyerB=403, BuyerA=204
  [PASS] #R32 GET /api/users/me/addresses/{id:int} enforces address.UserId == userId -> BuyerB=403, BuyerA=200
  [PASS] #R33 PUT /api/users/me/addresses/{id:int} enforces address.UserId == userId -> BuyerB=403, BuyerA=200
  [PASS] #R34 POST /api/wishlist/{productId:int}/toggle enforces Buyer-only role & scopes to caller userId -> Seller=403, Admin=403, BuyerA=200
  [PASS] #A4 Seller deletion blocked (409); Buyer deletion (204) scrubs order PII, revokes JWT (401), blocks login (401), and anonymizes review -> SellerDel=409, BuyerDel=204, OldJwt=401, Relogin=401, ScrubbedRecipient="", KeptGov="القاهرة", Reviewer="مشتري"
  [PASS] #A5 Real-money routes (Wallet, VendorPayouts, Coupons) default to OFF and return 404 -> me/wallet=404, admin/payouts=404, process=404, settle-cod=404, coupons=404
================================================================
ACCOUNT DELETION & 34-ROUTE IDOR SUITE COMPLETE — Failures: 0
================================================================
```

### Backend Batch 5 PII & OTP Log Masking (D-002 / M0-02)
- **Provider**: POSTGRES (TEST_DB)
- **Status**: PASS (Duration: 74.71s, Exit Code: 0)

```text
Suite provider: POSTGRES | DB name: MarketplaceMVP_test
  [PASS] email register accepted (HTTP 202)
  [PASS] phone register accepted (HTTP 202)
  (waiting 61s for the existing 60-second per-target resend cooldown before the password-reset path)
  [PASS] forgot-password accepted (HTTP 202)
  [PASS] dev endpoint still returns OTP for email target
  [PASS] dev endpoint still returns OTP for phone target
  [PASS] server log contains masked OTP marker "******" (log lines were emitted)
  [PASS] raw OTP ****** (value #1) NOT present in logs
  [PASS] raw OTP ****** (value #2) NOT present in logs
  [PASS] full email NOT present in logs
  [PASS] full local phone (01x...) NOT present in logs
  [PASS] full normalized phone (+20...) NOT present in logs
  [PASS] no Console.WriteLine OTP banner in stdout
ALL OTP/PII LOG-MASKING CHECKS PASSED
```

### Backend Batch 6 Unique Order Idempotency Race (D-003)
- **Provider**: POSTGRES (TEST_DB)
- **Status**: PASS (Duration: 67.54s, Exit Code: 0)

```text
statuses: 201, 201, 201, 201, 201 | order ids: 787, 787, 787, 787, 787
  [PASS] all parallel requests returned 2xx (no 500)
  [PASS] all parallel requests returned the same Order Id
  [PASS] exactly 1 order row in PostgreSQL (found 1)
  [PASS] product stock decremented once (Stock=4, expected 4)
--- Round 3/5: 5 parallel POST /api/orders, same buyer, same Idempotency-Key, stock=5 ---
  statuses: 201, 201, 201, 201, 201 | order ids: 792, 792, 792, 792, 792
  [PASS] all parallel requests returned 2xx (no 500)
  [PASS] all parallel requests returned the same Order Id
  [PASS] exactly 1 order row in PostgreSQL (found 1)
  [PASS] product stock decremented once (Stock=4, expected 4)
--- Round 4/5: 5 parallel POST /api/orders, same buyer, same Idempotency-Key, stock=5 ---
  statuses: 201, 201, 201, 201, 201 | order ids: 797, 797, 797, 797, 797
  [PASS] all parallel requests returned 2xx (no 500)
  [PASS] all parallel requests returned the same Order Id
  [PASS] exactly 1 order row in PostgreSQL (found 1)
  [PASS] product stock decremented once (Stock=4, expected 4)
--- Round 5/5: 5 parallel POST /api/orders, same buyer, same Idempotency-Key, stock=5 ---
  statuses: 201, 201, 201, 201, 201 | order ids: 802, 802, 802, 802, 802
  [PASS] all parallel requests returned 2xx (no 500)
  [PASS] all parallel requests returned the same Order Id
  [PASS] exactly 1 order row in PostgreSQL (found 1)
  [PASS] product stock decremented once (Stock=4, expected 4)
  INFO: unique-violation (23505) on IX_Orders_BuyerId_IdempotencyKey observed in server log: 68 time(s) (race caught by the DB index and handled)
ALL IDEMPOTENCY CONCURRENCY CHECKS PASSED
```

### Backend Batch 7 Cancel vs Handover Row-Lock Race (D-004)
- **Provider**: POSTGRES (TEST_DB)
- **Status**: PASS (Duration: 64.38s, Exit Code: 0)

```text
[PASS] round 7: exactly one operation won (cancel=200, handover=400)
  [PASS] round 7: no 5xx
  [PASS] round 7: cancel won -> order+shipment Cancelled, stock restored (5)
  round 8: cancel=200 handover=400 -> order=Cancelled shipment=Cancelled stock=5
  [PASS] round 8: exactly one operation won (cancel=200, handover=400)
  [PASS] round 8: no 5xx
  [PASS] round 8: cancel won -> order+shipment Cancelled, stock restored (5)
  round 9: cancel=200 handover=400 -> order=Cancelled shipment=Cancelled stock=5
  [PASS] round 9: exactly one operation won (cancel=200, handover=400)
  [PASS] round 9: no 5xx
  [PASS] round 9: cancel won -> order+shipment Cancelled, stock restored (5)
  round 10: cancel=200 handover=400 -> order=Cancelled shipment=Cancelled stock=5
  [PASS] round 10: exactly one operation won (cancel=200, handover=400)
  [PASS] round 10: no 5xx
  [PASS] round 10: cancel won -> order+shipment Cancelled, stock restored (5)
  round 11: cancel=400 handover=200 -> order=Shipped shipment=HandedToCarrier stock=4
  [PASS] round 11: exactly one operation won (cancel=400, handover=200)
  [PASS] round 11: no 5xx
  [PASS] round 11: handover won -> shipment HandedToCarrier, order not cancelled, stock not restored (4)
  round 12: cancel=200 handover=400 -> order=Cancelled shipment=Cancelled stock=5
  [PASS] round 12: exactly one operation won (cancel=200, handover=400)
  [PASS] round 12: no 5xx
  [PASS] round 12: cancel won -> order+shipment Cancelled, stock restored (5)
  INFO: cancel won 9 round(s), handover won 3 round(s)
ALL CANCEL-VS-HANDOVER RACE CHECKS PASSED
```

### Backend Batch 8 PUT /api/orders/{id}/status Admin-Only Lock (D-005)
- **Provider**: POSTGRES (TEST_DB)
- **Status**: PASS (Duration: 12.23s, Exit Code: 0)

```text
Suite provider: POSTGRES | DB name: MarketplaceMVP_test
--- 1. Seller attempts to update order status directly (D-005 loophole) ---
  [PASS] Seller calling PUT /api/orders/819/status with Delivered is rejected with 403 Forbidden (Got 403)
  [PASS] Seller calling PUT /api/orders/819/status with Shipped is rejected with 403 Forbidden (Got 403)
  [PASS] Seller calling PUT /api/orders/819/status with Cancelled is rejected with 403 Forbidden (Got 403)
--- 2. Buyer and Unauthenticated attempts ---
  [PASS] Buyer calling PUT /api/orders/819/status is rejected with 403 Forbidden (Got 403)
  [PASS] Unauthenticated caller on PUT /api/orders/819/status is rejected with 401 Unauthorized (Got 401)
--- 3. Verify order status in DB was NOT tampered with ---
  [PASS] Order status remains unchanged as Pending (Got Pending)
--- 4. Verify Seller shipment transition rules via ShipmentsController ---
  [PASS] Seller setting Delivered on shipment is rejected with 403 Forbidden (Got 403)
  [PASS] Seller setting HandedToCarrier on shipment SUCCEEDS with 200 OK (Got 200)
--- 5. Verify Admin has legitimate authority on PUT /api/orders/{id}/status ---
  [PASS] Admin calling PUT /api/orders/819/status SUCCEEDS with 204 NoContent (Got 204)
  [PASS] Order status successfully updated to Delivered by Admin (Got Delivered)
ALL D-005 ORDER STATUS AUTHORIZATION CHECKS PASSED
```

### Backend Batch 9 /api/health Redaction & 180/min Rate Limit (D-009, D-016)
- **Provider**: POSTGRES (TEST_DB)
- **Status**: PASS (Duration: 15.09s, Exit Code: 0)

```text
[PASS] GET /health returns HTTP 200 OK
  /health response payload: {"status":"Healthy","database":"Connected"}
  [PASS] /health reports status == "Healthy"
  [PASS] /health reports database == "Connected"
  [PASS] /health does NOT contain "version" property
  [PASS] /health does NOT contain "commit" property
  [PASS] /health does NOT contain "buildDate" property
  [PASS] /health strictly contains ONLY { database, status } and zero leakage fields
  [PASS] GET /api/health returns HTTP 200 OK
  /api/health response payload: {"status":"Healthy","database":"Connected"}
  [PASS] /api/health reports status == "Healthy"
  [PASS] /api/health reports database == "Connected"
  [PASS] /api/health does NOT contain "version" property
  [PASS] /api/health does NOT contain "commit" property
  [PASS] /api/health does NOT contain "buildDate" property
  [PASS] /api/health strictly contains ONLY { database, status } and zero leakage fields
--- 2. Public Catalog Browsing (80 rapid requests without 429 - D-016) ---
  Executed 80 rapid requests: 200 OK=80, 429 TooManyRequests=0
  [PASS] All 80 rapid public catalog requests succeeded with HTTP 200 OK (Got 80/80)
  [PASS] Zero 429 throttling occurred during 80 rapid browsing requests (Previous limit was 60)
--- 3. Verifying Upper Bound of 180 req/min is still actively enforced ---
  [PASS] Exceeding 180 req/min threshold actively triggers HTTP 429 (Triggered at request #180)
--- 4. Sensitive auth-policy Rate Limiting (15 req/min) Remains Strictly Enforced ---
  [PASS] Sensitive auth endpoint is strictly throttled with 429 when exceeding 15 req/min (Throttled at request #1)
ALL RATE-LIMIT AND HEALTH HARDENING CHECKS PASSED
```

### Backend PostgreSQL Verification Pack (11 Checks)
- **Provider**: POSTGRES (TEST_DB)
- **Status**: PASS (Duration: 64.64s, Exit Code: 0)

```text
--- CHECK 10: Login rejects inactive and legacy accounts ---
Check 10 (Login with inactive/deleted account rejected): { status: 401 }
✅ Check 10 PASSED: Inactive and deleted accounts rejected with 401 Unauthorized.
--- CHECK 11: /api/dev/* and Swagger absent in Staging & Production ---
Environment Staging check (port 62446): { swagger: 404, swaggerJson: 404, devCarrier: 404 }
Environment Production check (port 64271): { swagger: 404, swaggerJson: 404, devCarrier: 404 }
✅ Check 11 PASSED: Swagger and /api/dev/* return 404 in Staging and Production.
===============================================================
📊 VERIFICATION PACK SUMMARY
===============================================================
PASSED (11):
  ✅ Two parallel orders on LAST unit (Stock=1): exactly 1 succeeded, stock=0
  ✅ Ten parallel orders on LAST unit (Stock=1): exactly 1 succeeded, 9 rejected (400), stock=0
  ✅ Idempotency Key on POST /api/orders
  ✅ Buyer cancel before HandedToCarrier restores stock once
  ✅ Email/phone uniqueness case-insensitively and in parallel
  ✅ Account deletion on real tables (PII scrubbed, login blocked, tokens revoked)
  ✅ Review eligibility, 1 review per buyer/product, 10 parallel reviews rating avg=4.0
  ✅ Image upload rules (fake ext rejected, foreign URL rejected, EXIF removed, 9th rejected)
  ✅ Refresh rotation under parallel calls
  ✅ Login rejects inactive and legacy deleted accounts (401 Unauthorized)
  ✅ /api/dev/* and Swagger absent in Staging and Production (404)
NOT DONE (0):
FAILED (0):
===============================================================
```
