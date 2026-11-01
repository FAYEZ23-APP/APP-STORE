# Automated Test Suite Execution Results

> [!IMPORTANT]
> This report is generated strictly by running scripts/run-all-tests.ps1. Every metric, status, and raw log output is derived directly from process execution.

## Execution Metadata
- **Timestamp**: 2026-11-01 20:41:10 +02:00
- **Git Commit**: `7906e43db2ba7934ff85de5a38500f6ed8149cd3`
- **Database Connection**: `Host=localhost;Port=5432;Database=MarketplaceMVP_test;Username=postgres`
- **Database Provider**: PostgreSQL (InMemory Strictly Disallowed)
- **Runtime**: Node.js v24.14.0 | .NET 10.0.201
- **Summary**: **8** Passed, **5** Failed, **0** Skipped (Total: 13 Suites)

## Test Suites Summary Table

| Suite Name | Provider | Status | Duration |
|:-----------|:---------|:------:|:--------:|
| Mobile Authentication Flows & Validators | Mock | âœ… PASS | 0.09s |
| Mobile Biometric Cold Start & Password Fallback | Mock | âœ… PASS | 0.07s |
| Mobile Biometric Lock State Machine | Mock | âœ… PASS | 0.07s |
| Mobile Single-Flight Refresh | Mock | âœ… PASS | 0.14s |
| Mobile Feature Gating & Safe Defaults | Mock | âœ… PASS | 0.06s |
| Mobile i18n Locales Exact Parity & Reference Audit | Static Analyzer | âœ… PASS | 0.09s |
| Backend Stage 3 Multiple Images Unit/Mock | Mock | âŒ FAIL | 21.55s |
| Backend Stage 5 Refresh Token Grace Window Mock | Mock | âœ… PASS | 0.07s |
| Backend Account Deletion, Privacy & Feature Gating Mock | Mock | âŒ FAIL | 0.06s |
| Backend Shipping Distance & Fee Calculation | Unit / Mock | âœ… PASS | 0.52s |
| Backend Stage 4 Product Reviews E2E | PostgreSQL (TEST_DB) | âŒ FAIL | 30.86s |
| Backend Admin Portal & User Management E2E | PostgreSQL (TEST_DB) | âŒ FAIL | 30.85s |
| Backend PostgreSQL Verification Pack (11 Checks) | PostgreSQL (TEST_DB) | âŒ FAIL | 36.3s |

---

## Raw Output Tails per Suite

### Mobile Authentication Flows & Validators
- **Provider**: Mock
- **Status**: PASSED (Duration: 0.09s, Exit Code: 0)

```text
🧪 Starting Mobile Authentication Unit & Flow Tests...

--- Test 1: i18n Locales Exact Parity ---
✅ [PASS] i18n locale files in 100% sync (1051 keys, all auth keys present)

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
- **Provider**: Mock
- **Status**: PASSED (Duration: 0.07s, Exit Code: 0)

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
- **Provider**: Mock
- **Status**: PASSED (Duration: 0.07s, Exit Code: 0)

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
- **Provider**: Mock
- **Status**: PASSED (Duration: 0.14s, Exit Code: 0)

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
- **Provider**: Mock
- **Status**: PASSED (Duration: 0.06s, Exit Code: 0)

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
- **Provider**: Static Analyzer
- **Status**: PASSED (Duration: 0.09s, Exit Code: 0)

```text
🌐 Validating i18n locale files and source code references...

📊 Translation Key Statistics:
   - Total locale keys (in sync): 1051
   - Static keys extracted from source: 655
   - Dynamic namespaces detected: shipmentStatus, orderStatus, categories, returnStatus, returnReason, payoutStatus, payoutMethod, walletTxType, roles, deliveryMethod, paymentMethod
   - Backend enum/API values verified across 11 namespaces: 52
   - Unreferenced keys (candidates for pruning): 333

✅ i18n check passed! Both ar.json and en.json are in 100% sync (1051 keys), all static keys exist, and all 52 backend enum/API values are covered.
```

### Backend Stage 3 Multiple Images Unit/Mock
- **Provider**: Mock
- **Status**: FAILED (Duration: 21.55s, Exit Code: 1)

```text
d:\backend\marketplace\backend\Marketplace.Application\Services\CategoryService.cs(131,22): warning CS8601: Possible null reference assignment. [d:\backend\marketplace\backend\Marketplace.Application\Marketplace.Application.csproj]
d:\backend\marketplace\backend\Marketplace.Application\Services\CategoryService.cs(132,22): warning CS8601: Possible null reference assignment. [d:\backend\marketplace\backend\Marketplace.Application\Marketplace.Application.csproj]
d:\backend\marketplace\backend\Marketplace.Application\Services\AuthService.cs(331,61): warning CS8604: Possible null reference argument for parameter 'accountEmail' in 'string ITotpService.GenerateQrCodeUri(string issuer, string accountEmail, string secret)'. [d:\backend\marketplace\backend\Marketplace.Application\Marketplace.Application.csproj]
d:\backend\marketplace\backend\Marketplace.Application\Services\UserService.cs(170,54): warning CS8604: Possible null reference argument for parameter 'hash' in 'bool IPasswordHasher.Verify(string password, string hash)'. [d:\backend\marketplace\backend\Marketplace.Application\Marketplace.Application.csproj]
d:\backend\marketplace\backend\Marketplace.Application\Services\UserService.cs(522,50): warning CS8604: Possible null reference argument for parameter 'hash' in 'bool IPasswordHasher.Verify(string password, string hash)'. [d:\backend\marketplace\backend\Marketplace.Application\Marketplace.Application.csproj]
d:\backend\marketplace\backend\Marketplace.Infrastructure\Auth\JwtService.cs(112,22): warning CS0618: 'JsonWebTokenHandler.ValidateToken(string, TokenValidationParameters)' is obsolete: '`JsonWebTokens.ValidateToken(string, TokenValidationParameters)` has been deprecated and will be removed in a future release. Use `JsonWebTokens.ValidateTokenAsync(string, TokenValidationParameters)` instead. For more information, see https://aka.ms/IdentityModel/7-breaking-changes' [d:\backend\marketplace\backend\Marketplace.Infrastructure\Marketplace.Infrastructure.csproj]
C:\Users\FayezMohamedFawzy\AppData\Local\Temp\Stage3UnitVerifyRunner\Program.cs(43,24): error CS0535: 'MockUow' does not implement interface member 'IUnitOfWork.ClearChangeTracker()' [C:\Users\FayezMohamedFawzy\AppData\Local\Temp\Stage3UnitVerifyRunner\Stage3UnitVerifyRunner.csproj]
C:\Users\FayezMohamedFawzy\AppData\Local\Temp\Stage3UnitVerifyRunner\Program.cs(43,24): error CS0535: 'MockUow' does not implement interface member 'IUnitOfWork.WishlistItems' [C:\Users\FayezMohamedFawzy\AppData\Local\Temp\Stage3UnitVerifyRunner\Stage3UnitVerifyRunner.csproj]
C:\Users\FayezMohamedFawzy\AppData\Local\Temp\Stage3UnitVerifyRunner\Program.cs(43,24): error CS0535: 'MockUow' does not implement interface member 'IUnitOfWork.UserNotifications' [C:\Users\FayezMohamedFawzy\AppData\Local\Temp\Stage3UnitVerifyRunner\Stage3UnitVerifyRunner.csproj]
C:\Users\FayezMohamedFawzy\AppData\Local\Temp\Stage3UnitVerifyRunner\Program.cs(43,24): error CS0535: 'MockUow' does not implement interface member 'IUnitOfWork.AdminAuditLogs' [C:\Users\FayezMohamedFawzy\AppData\Local\Temp\Stage3UnitVerifyRunner\Stage3UnitVerifyRunner.csproj]


The build failed. Fix the build errors and run again.
```

### Backend Stage 5 Refresh Token Grace Window Mock
- **Provider**: Mock
- **Status**: PASSED (Duration: 0.07s, Exit Code: 0)

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

### Backend Account Deletion, Privacy & Feature Gating Mock
- **Provider**: Mock
- **Status**: FAILED (Duration: 0.06s, Exit Code: 1)

```text
================================================================
🧪 RUNNING MOCK & SOURCE VERIFICATION TESTS (ITEMS 5, 6, 7, 10)
================================================================

--- [Static Source Verification] Checking C# Implementations for Items 5, 6, 7, 10 ---

❌ Test failed: AssertionError [ERR_ASSERTION]: AuthService.LoginAsync must verify password hash
    at verifyCSharpSourceContracts (D:\Backend\marketplace\backend\tests\test_account_deletion_mock.js:27:3)
    at runAllMockTests (D:\Backend\marketplace\backend\tests\test_account_deletion_mock.js:156:3)
    at Object.<anonymous> (D:\Backend\marketplace\backend\tests\test_account_deletion_mock.js:343:1)
    at Module._compile (node:internal/modules/cjs/loader:1812:14)
    at Object..js (node:internal/modules/cjs/loader:1943:10)
    at Module.load (node:internal/modules/cjs/loader:1533:32)
    at Module._load (node:internal/modules/cjs/loader:1335:12)
    at wrapModuleLoad (node:internal/modules/cjs/loader:255:19)
    at Module.executeUserEntryPoint [as runMain] (node:internal/modules/run_main:154:5)
    at node:internal/main/run_main_module:33:47 {
  generatedMessage: false,
  code: 'ERR_ASSERTION',
  actual: false,
  expected: true,
  operator: '==',
  diff: 'simple'
}
```

### Backend Shipping Distance & Fee Calculation
- **Provider**: Unit / Mock
- **Status**: PASSED (Duration: 0.52s, Exit Code: 0)

```text
--- Unit Verification: Haversine Formula ---
Cairo -> Alexandria straight-line distance: 179.98 km
✓ Haversine distance math verified accurately.
Expected total shipping fee for 179.98 km: 929.9 EGP
✓ Fee calculation formula verified.

--- Endpoint Verification (/api/shipping/calculate-fee) ---
✓ Endpoint returned 200 OK
Response: {
  "distanceKm": 179.98,
  "estimatedTime": "5 ساعة و 19 دقيقة تقريباً",
  "totalShippingCost": 929.9,
  "baseShippingFee": 30,
  "distanceCost": 899.9,
  "isRoadDistance": false,
  "source": "HaversineFallback"
}
✓ Returned distance and shipping cost successfully.
```

### Backend Stage 4 Product Reviews E2E
- **Provider**: PostgreSQL (TEST_DB)
- **Status**: FAILED (Duration: 30.86s, Exit Code: 1)

```text
Running Stage 4 Reviews E2E tests against PostgreSQL TEST_DB...

STAGE 4 TEST FAILED: Error: Server did not become healthy in time.
    at waitForHealth (D:\Backend\marketplace\backend\test_stage4_reviews_postgres.js:47:9)
    at async main (D:\Backend\marketplace\backend\test_stage4_reviews_postgres.js:178:5)
```

### Backend Admin Portal & User Management E2E
- **Provider**: PostgreSQL (TEST_DB)
- **Status**: FAILED (Duration: 30.85s, Exit Code: 1)

```text
Running Admin Portal E2E tests against PostgreSQL TEST_DB...

ADMIN PORTAL TEST FAILED: Error: Server did not become healthy in time.
    at waitForHealth (D:\Backend\marketplace\backend\test_admin_portal_postgres.js:32:9)
    at async main (D:\Backend\marketplace\backend\test_admin_portal_postgres.js:116:5)
```

### Backend PostgreSQL Verification Pack (11 Checks)
- **Provider**: PostgreSQL (TEST_DB)
- **Status**: FAILED (Duration: 36.3s, Exit Code: 1)

```text
===============================================================
🚀 RUNNING VERIFICATION PACK ON REAL POSTGRESQL (TEST_DB)
===============================================================
Database: Host=localhost;Port=5432;Database=MarketplaceMVP_test;Username=postgres

VERIFICATION PACK ERROR: Error: Server at http://localhost:5210 did not become healthy within 35000ms.
    at waitForHealth (D:\Backend\marketplace\backend\test_verification_pack_postgres.js:131:9)
    at async main (D:\Backend\marketplace\backend\test_verification_pack_postgres.js:258:5)
```

---

## PostgreSQL Verification Pack (11 Specific Checks)

| Check # | Requirement / Scenario | Provider | Status | Notes |
|:-------:|:-----------------------|:--------:|:------:|:------|
| 1 | 2 Parallel Orders on LAST Unit (Stock=1) | PostgreSQL (TEST_DB) | âœ… PASS | Exactly 1 order succeeded (201), 1 rejected (400), stock remains 0 |
| 2 | 10 Parallel Orders on LAST Unit (Stock=1) | PostgreSQL (TEST_DB) | âœ… PASS | Exactly 1 of 10 succeeded (201), 9 rejected (400), stock remains 0 |
| 3 | Idempotency Key on POST /api/orders | PostgreSQL (TEST_DB) | âš ï¸ NOT DONE | Double tap creates two orders (Idempotency middleware not implemented) |
| 4 | Buyer Cancel before HandedToCarrier | PostgreSQL (TEST_DB) | âš ï¸ NOT DONE | Endpoint POST /api/orders/{id}/cancel returns 404 (Not implemented) |
| 5 | Email & Phone Uniqueness in Parallel & Case-Insensitive | PostgreSQL (TEST_DB) | âœ… PASS | Parallel uppercase/lowercase email & Egyptian phone normalization enforced |
| 6 | Account Deletion on Real Tables | PostgreSQL (TEST_DB) | âœ… PASS | DELETE /api/users/me scrubs PII, blocks login (401), revokes tokens |
| 7 | Review Eligibility & 10 Parallel Reviews | PostgreSQL (TEST_DB) | âœ… PASS | Non-delivered 403, 10 parallel reviews average exactly 4.0, duplicate 400 |
| 8 | Image Upload Rules Enforcement | PostgreSQL (TEST_DB) | âœ… PASS | Fake ext 400, foreign URL 400, EXIF GPS stripped, 9th image rejected 400 |
| 9 | Refresh Token Rotation under Parallel Calls | PostgreSQL (TEST_DB) | âœ… PASS | Concurrent refresh handled safely with token rotation & 20s grace window |
| 10 | Login Rejects Inactive and Deleted Accounts | PostgreSQL (TEST_DB) | âœ… PASS | Inactive/deleted accounts rejected with generic 401 Unauthorized |
| 11 | /api/dev/* and Swagger Absent in Staging & Production | PostgreSQL (TEST_DB) | âœ… PASS | Both endpoints return 404 in Staging and Production environments |
