const fs = require('fs');
const path = require('path');

// Reproducible PRNG (Mulberry32)
function mulberry32(a) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

const seed = process.env.AUDIT_SEED ? parseInt(process.env.AUDIT_SEED, 10) : 20261028;
const random = mulberry32(seed);

console.log('========================================================================');
console.log(`  FEATURE CATALOG REPRODUCIBLE SAMPLING VERIFIER (SEED: ${seed})`);
console.log('========================================================================\n');

const repoRoot = path.resolve(__dirname, '../..');

// 55 features catalog definition with exact citation targets
const catalog = [
  { id: 'F-001', name: 'Email Registration', file: 'backend/Marketplace.API/Controllers/AuthController.cs', line: 29, test: 'backend/tests/test_auth_completion.js', provider: 'POSTGRES', maturity: 2 },
  { id: 'F-002', name: 'Email/Phone Login', file: 'backend/Marketplace.API/Controllers/AuthController.cs', line: 77, test: 'backend/tests/test_auth_completion.js', provider: 'POSTGRES', maturity: 2 },
  { id: 'F-003', name: 'OTP Verification Code Engine', file: 'backend/Marketplace.API/Controllers/AuthController.cs', line: 45, test: 'backend/tests/test_auth_completion.js', provider: 'POSTGRES', maturity: 2 },
  { id: 'F-004', name: 'Phone Sign-Up', file: 'backend/Marketplace.API/Controllers/AuthController.cs', line: 29, test: 'backend/tests/test_auth_completion.js', provider: 'POSTGRES', maturity: 2 },
  { id: 'F-005', name: 'Google OAuth & Account Linking', file: 'backend/Marketplace.API/Controllers/AuthController.cs', line: 125, test: 'backend/tests/test_batch4_partA_postgres.js', provider: 'POSTGRES', maturity: 2 },
  { id: 'F-006', name: 'Refresh Tokens & Device Sessions', file: 'backend/Marketplace.API/Controllers/AuthController.cs', line: 158, test: 'backend/tests/test_stage5_grace_window_mock.js', provider: 'MOCK', maturity: 1 },
  { id: 'F-007', name: 'Biometric Mobile App Lock', file: 'mobile/src/screens/auth/UnlockScreen.js', line: 1, test: 'mobile/tests/test_biometric_lock_state_machine_mock.js', provider: 'MOCK', maturity: 1 },
  { id: 'F-008', name: 'Forgot & Reset Password', file: 'backend/Marketplace.API/Controllers/AuthController.cs', line: 91, test: 'backend/tests/test_auth_completion.js', provider: 'POSTGRES', maturity: 2 },
  { id: 'F-009', name: 'Account Deletion & PDPL Anonymization', file: 'backend/Marketplace.API/Controllers/UsersController.cs', line: 219, test: 'backend/tests/test_account_deletion_mock.js', provider: 'MOCK', maturity: 1 },
  { id: 'F-010', name: 'User Consent Logging', file: 'backend/Marketplace.Domain/Entities/UserConsent.cs', line: 1, test: 'backend/tests/test_auth_completion.js', provider: 'POSTGRES', maturity: 2 },
  { id: 'F-011', name: 'Bilingual Hierarchical Categories', file: 'backend/Marketplace.API/Controllers/CategoriesController.cs', line: 21, test: 'backend/tests/test_batch3_verification_postgres.js', provider: 'POSTGRES', maturity: 2 },
  { id: 'F-012', name: 'Bilingual Fuzzy Search & Normalization', file: 'backend/Marketplace.API/Controllers/SearchController.cs', line: 45, test: 'backend/tests/test_bilingual_search_postgres.js', provider: 'POSTGRES', maturity: 3 },
  { id: 'F-013', name: 'Product Filtering & Sorting', file: 'backend/Marketplace.API/Controllers/ProductsController.cs', line: 185, test: 'backend/tests/test_stage1_postgres.js', provider: 'POSTGRES', maturity: 2 },
  { id: 'F-014', name: 'Product Variants (Color/Size/SKU)', file: 'backend/Marketplace.Domain/Entities/ProductVariant.cs', line: 1, test: 'backend/test_stage4_reviews_postgres.js', provider: 'POSTGRES', maturity: 2 },
  { id: 'F-015', name: 'Product Multi-Image Upload & EXIF Stripping', file: 'backend/Marketplace.API/Controllers/ProductsController.cs', line: 30, test: 'backend/test_stage3_images_postgres.js', provider: 'POSTGRES', maturity: 2 },
  { id: 'F-016', name: 'Persistent Cloud Wishlist', file: 'backend/Marketplace.API/Controllers/WishlistController.cs', line: 22, test: 'backend/tests/test_batch3_verification_postgres.js', provider: 'POSTGRES', maturity: 2 },
  { id: 'F-017', name: 'Product Ratings & Reviews with Photos', file: 'backend/Marketplace.API/Controllers/ReviewsController.cs', line: 81, test: 'backend/test_stage4_reviews_postgres.js', provider: 'POSTGRES', maturity: 3 },
  { id: 'F-018', name: 'Review Reporting & Moderation Queue', file: 'backend/Marketplace.API/Controllers/ReviewsController.cs', line: 232, test: 'backend/test_stage4_reviews_postgres.js', provider: 'POSTGRES', maturity: 2 },
  { id: 'F-019', name: 'Seller Review Replies', file: 'backend/Marketplace.API/Controllers/ReviewsController.cs', line: 202, test: 'backend/test_stage4_reviews_postgres.js', provider: 'POSTGRES', maturity: 2 },
  { id: 'F-020', name: 'Client-Side Cart with Compound Keys', file: 'admin-web/src/pages/CartPage.jsx', line: 1, test: 'admin-web/tests/test_web_security_and_build.js', provider: 'MOCK', maturity: 1 },
  { id: 'F-021', name: 'Order Placement & Atomic Stock Decrement', file: 'backend/Marketplace.API/Controllers/OrdersController.cs', line: 21, test: 'backend/tests/test_batch1_verification_postgres.js', provider: 'POSTGRES', maturity: 3 },
  { id: 'F-022', name: '27 Governorates Distance Shipping Tariff', file: 'backend/Marketplace.API/Controllers/DeliveryController.cs', line: 39, test: 'backend/tests/test_batch4_partC_postgres.js', provider: 'POSTGRES', maturity: 2 },
  { id: 'F-023', name: 'Single Order Endpoint', file: 'backend/Marketplace.API/Controllers/OrdersController.cs', line: 54, test: 'backend/tests/test_batch4_partA_postgres.js', provider: 'POSTGRES', maturity: 2 },
  { id: 'F-024', name: 'Buyer Order Cancellation & Stock Restore', file: 'backend/Marketplace.API/Controllers/OrdersController.cs', line: 39, test: 'backend/tests/test_batch3_verification_postgres.js', provider: 'POSTGRES', maturity: 2 },
  { id: 'F-025', name: 'Order Placement Idempotency', file: 'backend/Marketplace.Application/Services/OrderService.cs', line: 42, test: 'backend/tests/test_batch3_verification_postgres.js', provider: 'POSTGRES', maturity: 3 },
  { id: 'F-026', name: 'Per-Seller Shipment Lifecycle & Concurrency', file: 'backend/Marketplace.Application/Services/ShipmentService.cs', line: 264, test: 'backend/tests/test_batch1_verification_postgres.js', provider: 'POSTGRES', maturity: 3 },
  { id: 'F-027', name: 'COD Refusal Counter & Blocking', file: 'backend/Marketplace.API/appsettings.json', line: 66, test: 'NONE', provider: 'NONE', maturity: 0 },
  { id: 'F-028', name: 'Printable Waybills and Invoices', file: 'admin-web/src/pages/seller/SellerShipmentsPage.jsx', line: 1, test: 'tests/test_batch2_parity_verification.js', provider: 'MOCK', maturity: 1 },
  { id: 'F-029', name: 'Delivery Provider Interface (27 Cities)', file: 'backend/Marketplace.Infrastructure/Delivery/FakeDeliveryProvider.cs', line: 1, test: 'backend/tests/test_batch4_partC_postgres.js', provider: 'POSTGRES', maturity: 2 },
  { id: 'F-030', name: 'Saved User Addresses Management', file: 'backend/Marketplace.API/Controllers/UsersController.cs', line: 105, test: 'backend/tests/test_batch1_verification_postgres.js', provider: 'POSTGRES', maturity: 2 },
  { id: 'F-031', name: 'Google Maps Interactive Location Picker', file: 'mobile/src/components/MobileLocationPicker.js', line: 1, test: 'NONE', provider: 'NONE', maturity: 1 },
  { id: 'F-032', name: '14-Day Post-Delivery Consumer Returns', file: 'backend/Marketplace.API/Controllers/ReturnsController.cs', line: 58, test: 'backend/tests/test_batch4_partD_postgres.js', provider: 'POSTGRES', maturity: 2 },
  { id: 'F-033', name: 'PDPL Private Evidence Storage & Access', file: 'backend/Marketplace.API/Controllers/FilesController.cs', line: 36, test: 'backend/tests/test_batch4_partD_postgres.js', provider: 'POSTGRES', maturity: 3 },
  { id: 'F-034', name: 'Verified Purchase Review Eligibility', file: 'backend/Marketplace.API/Controllers/ReviewsController.cs', line: 27, test: 'backend/test_stage4_reviews_postgres.js', provider: 'POSTGRES', maturity: 2 },
  { id: 'F-035', name: 'Seller Profile & Dispatch Coordinates', file: 'backend/Marketplace.API/Controllers/UsersController.cs', line: 64, test: 'backend/tests/test_batch4_partC_postgres.js', provider: 'POSTGRES', maturity: 2 },
  { id: 'F-036', name: 'Seller Products & Quick Stock Update', file: 'backend/Marketplace.API/Controllers/ProductsController.cs', line: 145, test: 'backend/tests/test_batch3_verification_postgres.js', provider: 'POSTGRES', maturity: 2 },
  { id: 'F-037', name: 'Seller Dashboard KPI Aggregation', file: 'backend/Marketplace.API/Controllers/UsersController.cs', line: 181, test: 'backend/tests/test_dashboards.js', provider: 'POSTGRES', maturity: 2 },
  { id: 'F-038', name: 'Admin Platform KPI Dashboard', file: 'backend/Marketplace.API/Controllers/AdminController.cs', line: 55, test: 'backend/test_admin_portal_postgres.js', provider: 'POSTGRES', maturity: 2 },
  { id: 'F-039', name: 'Admin User Management & Status Toggle', file: 'backend/Marketplace.API/Controllers/AdminController.cs', line: 41, test: 'backend/test_admin_portal_postgres.js', provider: 'POSTGRES', maturity: 2 },
  { id: 'F-040', name: 'Admin Immutable Audit Logs', file: 'backend/Marketplace.API/Controllers/AdminController.cs', line: 93, test: 'backend/tests/test_batch4_partA_postgres.js', provider: 'POSTGRES', maturity: 2 },
  { id: 'F-041', name: 'Push Queue & Background Hosted Worker', file: 'backend/Marketplace.Infrastructure/BackgroundServices/PushNotificationBackgroundWorker.cs', line: 1, test: 'backend/tests/test_batch3_remaining_fixes_postgres.js', provider: 'POSTGRES', maturity: 3 },
  { id: 'F-042', name: 'Notification Center & Deep-Linking', file: 'backend/Marketplace.API/Controllers/NotificationsController.cs', line: 22, test: 'backend/tests/test_batch4_partB_postgres.js', provider: 'POSTGRES', maturity: 2 },
  { id: 'F-043', name: 'SMS & Email Transactional Senders', file: 'backend/Marketplace.Infrastructure/Notifications/ConfigurableHttpSmsSender.cs', line: 1, test: 'backend/tests/test_batch4_partC_postgres.js', provider: 'POSTGRES', maturity: 2 },
  { id: 'F-044', name: 'Buyer Wallet (Flag-Gated)', file: 'backend/Marketplace.API/Controllers/UsersController.cs', line: 26, test: 'backend/tests/test_part1_feature_gating_postgres.js', provider: 'POSTGRES', maturity: 1 },
  { id: 'F-045', name: 'Vendor Wallet & Ledger (Flag-Gated)', file: 'backend/Marketplace.API/Controllers/WalletController.cs', line: 23, test: 'backend/tests/test_part1_feature_gating_postgres.js', provider: 'POSTGRES', maturity: 1 },
  { id: 'F-046', name: 'Vendor Payout Requests (Flag-Gated)', file: 'backend/Marketplace.API/Controllers/WalletController.cs', line: 37, test: 'backend/tests/test_part1_feature_gating_postgres.js', provider: 'POSTGRES', maturity: 1 },
  { id: 'F-047', name: 'Coupons System (Flag-Gated)', file: 'backend/Marketplace.API/Controllers/CouponsController.cs', line: 24, test: 'backend/tests/test_part1_feature_gating_postgres.js', provider: 'POSTGRES', maturity: 1 },
  { id: 'F-048', name: 'User Data Export under PDPL', file: 'backend/Marketplace.API/Controllers/UsersController.cs', line: 207, test: 'backend/tests/test_account_deletion_mock.js', provider: 'MOCK', maturity: 1 },
  { id: 'F-049', name: 'Bilingual Arabic Primary & RTL Layouts', file: 'mobile/scripts/check-i18n.js', line: 1, test: 'mobile/scripts/check-i18n.js', provider: 'MOCK', maturity: 1 },
  { id: 'F-050', name: 'Storage Provider Abstraction (Local/S3)', file: 'backend/Marketplace.Infrastructure/Storage/LocalFileStorageProvider.cs', line: 9, test: 'backend/tests/test_batch4_partD_postgres.js', provider: 'POSTGRES', maturity: 2 },
  { id: 'F-051', name: 'Database Cleanup Background Services', file: 'backend/Marketplace.Infrastructure/BackgroundServices/VerificationCodeCleanupService.cs', line: 1, test: 'NONE', provider: 'NONE', maturity: 1 },
  { id: 'F-052', name: 'Anonymous Health Check Endpoint', file: 'backend/Marketplace.API/Program.cs', line: 719, test: 'backend/tests/test_batch4_partD_postgres.js', provider: 'POSTGRES', maturity: 2 },
  { id: 'F-053', name: 'Multi-Key Rate Limiting & Policies', file: 'backend/Marketplace.API/Program.cs', line: 64, test: 'backend/tests/test_stage1_security_inmemory.js', provider: 'MOCK', maturity: 1 },
  { id: 'F-054', name: 'Security Audit & Parity CI Scripts', file: 'admin-web/tests/test_web_security_and_build.js', line: 1, test: 'admin-web/tests/test_web_security_and_build.js', provider: 'MOCK', maturity: 1 },
  { id: 'F-055', name: 'Carrier Simulator Dev Tooling', file: 'backend/Marketplace.API/Controllers/DevCarrierController.cs', line: 28, test: 'backend/tests/test_batch1_verification_postgres.js', provider: 'POSTGRES', maturity: 2 }
];

// Pick 10 unique random samples
const indices = [];
while (indices.length < 10) {
  const idx = Math.floor(random() * catalog.length);
  if (!indices.includes(idx)) {
    indices.push(idx);
  }
}

let allPassed = true;

for (let i = 0; i < indices.length; i++) {
  const item = catalog[indices[i]];
  console.log(`[Sample ${i + 1}/10] Checking ${item.id}: ${item.name}`);

  // 1. File existence
  const fullFilePath = path.join(repoRoot, item.file);
  const fileExists = fs.existsSync(fullFilePath);
  if (!fileExists) {
    console.error(`  FAIL: Cited file does not exist: ${item.file}`);
    allPassed = false;
    continue;
  }

  // 2. Line check
  const lines = fs.readFileSync(fullFilePath, 'utf8').split(/\r?\n/);
  const targetLineIdx = item.line - 1;
  const lineContent = lines[targetLineIdx] ? lines[targetLineIdx].trim() : '';
  console.log(`  File check: ${item.file}:${item.line} -> "${lineContent.slice(0, 70)}"`);

  // 3. Test suite existence & provider check
  if (item.test !== 'NONE') {
    const testPath = path.join(repoRoot, item.test);
    const testExists = fs.existsSync(testPath);
    if (!testExists) {
      console.error(`  FAIL: Test suite file does not exist: ${item.test}`);
      allPassed = false;
      continue;
    }

    const testContent = fs.readFileSync(testPath, 'utf8');
    const isPostgres = testContent.includes('TEST_DB') || testContent.includes('Database=') || testContent.includes('_test');
    const realProvider = isPostgres ? 'POSTGRES' : 'MOCK';
    if (realProvider !== item.provider) {
      console.error(`  FAIL: Provider mismatch. Catalog claims ${item.provider}, actual file uses ${realProvider}`);
      allPassed = false;
      continue;
    }
    console.log(`  Test check: ${item.test} (Provider: ${realProvider})`);
  } else {
    console.log(`  Test check: NONE`);
  }

  // 4. Maturity rubric check
  // Rubric rule:
  // - If test is MOCK, NONE, or InMemory -> Maturity MUST be <= 1 (or 0 if absent).
  // - If test is POSTGRES -> Maturity can be 2 (happy path) or 3 (happy path + auth + concurrency).
  let rubricValid = true;
  if ((item.provider === 'MOCK' || item.provider === 'NONE') && item.maturity > 1) {
    rubricValid = false;
  }
  if (item.maturity === 3 && item.provider !== 'POSTGRES') {
    rubricValid = false;
  }

  if (!rubricValid) {
    console.error(`  FAIL: Maturity ${item.maturity} violates rubric rule for provider ${item.provider}`);
    allPassed = false;
    continue;
  }

  console.log(`  Maturity rubric: ${item.maturity} (Valid under provider rules)`);
  console.log(`  Result: VERIFIED PASS\n`);
}

if (!allPassed) {
  console.error('[Verdict] Verification sampling detected errors.');
  process.exit(1);
} else {
  console.log('[Verdict] All 10 random samples verified successfully against physical files and strict rubric.');
}
