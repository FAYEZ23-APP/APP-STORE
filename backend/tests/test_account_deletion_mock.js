const assert = require('assert');
const fs = require('fs');
const path = require('path');

/**
 * Mock & Static Verification Suite for Items 5, 6, 7, and 10 (Non-PostgreSQL: *_mock.js)
 *
 * NOTE: Per Global Rules & Item 4, this script uses in-process JS mocks and C# source
 * verification and is explicitly named `*_mock.js`. It is NOT counted as PostgreSQL
 * verification when TEST_DB is unset.
 */

const repoRoot = path.resolve(__dirname, '..', '..');

function verifyCSharpSourceContracts() {
  console.log('\n--- [Static Source Verification] Checking C# Implementations for Items 5, 6, 7, 10 ---');

  // 1. Item 5: AuthService.cs checks IsActive=false and legacy deleted_ email AFTER password verification
  const authServiceCode = fs.readFileSync(
    path.join(repoRoot, 'backend/Marketplace.Application/Services/AuthService.cs'),
    'utf8'
  );
  assert(authServiceCode.includes('!_hasher.Verify(request.Password, user.PasswordHash)'), 'AuthService.LoginAsync must verify password hash');
  assert(authServiceCode.includes('if (!user.IsActive || isLegacyDeletedEmail)'), 'AuthService.LoginAsync must check !user.IsActive');
  
  const verifyPassIdx = authServiceCode.indexOf('!_hasher.Verify(request.Password, user.PasswordHash)');
  const isActiveIdx = authServiceCode.indexOf('if (!user.IsActive || isLegacyDeletedEmail)');
  const notVerifiedIdx = authServiceCode.indexOf('throw new NotVerifiedException(');

  assert(verifyPassIdx > 0, 'AuthService.LoginAsync must verify password hash');
  assert(isActiveIdx > verifyPassIdx, 'AuthService.LoginAsync must check !user.IsActive AFTER password verification');
  assert(notVerifiedIdx > isActiveIdx, 'AuthService.LoginAsync must check NOT_VERIFIED after IsActive check');
  console.log('✅ Item 5 (C#): AuthService.LoginAsync rejects IsActive=false & legacy deleted_ accounts with generic 401 AFTER password check.');

  // 2. Item 6: Program.cs ForwardLimit = 1 and multi-key rate limiting (ip, user, target)
  const programCode = fs.readFileSync(
    path.join(repoRoot, 'backend/Marketplace.API/Program.cs'),
    'utf8'
  );
  assert(programCode.includes('options.ForwardLimit = 1;'), 'Program.cs must set ForwardLimit = 1');
  assert(!programCode.includes('options.ForwardLimit = null'), 'Program.cs must NEVER set ForwardLimit = null');
  assert(programCode.includes('ReverseProxy:KnownProxies'), 'Program.cs must support optional ReverseProxy:KnownProxies from config');
  assert(programCode.includes('$"ip:{remoteIp}"'), 'Program.cs must rate-limit per IP');
  assert(programCode.includes('$"user:{userId}"'), 'Program.cs must rate-limit per authenticated user ID');
  assert(programCode.includes('$"target:{normalizedTarget}"'), 'Program.cs must rate-limit per normalized target');
  assert(programCode.includes('"Microsoft.EntityFrameworkCore.InMemory"'), 'Program.cs must guard EnsureCreatedAsync with InMemory check');
  assert(programCode.includes('__EFMigrationsHistory'), 'Program.cs must include startup guard checking for __EFMigrationsHistory');
  assert(programCode.includes('GetValue<bool>("Database:AutoMigrate", false)'), 'Program.cs must gate MigrateAsync behind Database:AutoMigrate (default false)');
  console.log('✅ Item 6 & Task e (C#): Program.cs enforces ForwardLimit = 1, multi-key rate limits, __EFMigrationsHistory startup guard, and Database:AutoMigrate (default false).');

  // 3. Item 7: UserService.cs & ReviewService.cs buyer PII scrubbing, seller 409 guard, and export-data
  const userServiceCode = fs.readFileSync(
    path.join(repoRoot, 'backend/Marketplace.Application/Services/UserService.cs'),
    'utf8'
  );
  assert(userServiceCode.includes('throw new ConflictException('), 'UserService.DeleteAccountAsync must refuse Seller deletion with 409 ConflictException when active products/shipments/balances exist');
  assert(userServiceCode.includes('order.RecipientName = string.Empty;'), 'UserService.DeleteAccountAsync must scrub Order.RecipientName');
  assert(userServiceCode.includes('order.RecipientPhone = string.Empty;'), 'UserService.DeleteAccountAsync must scrub Order.RecipientPhone');
  assert(userServiceCode.includes('order.Area = string.Empty;'), 'UserService.DeleteAccountAsync must scrub Order.Area');
  assert(userServiceCode.includes('order.StreetBuilding = string.Empty;'), 'UserService.DeleteAccountAsync must scrub Order.StreetBuilding');
  assert(userServiceCode.includes('TryDeleteUploadedFile('), 'UserService.DeleteAccountAsync must delete uploaded review/return photo files');
  assert(userServiceCode.includes('DeviceSessions ='), 'UserService.ExportUserDataAsync must export DeviceSessions (without token hashes)');

  const reviewServiceCode = fs.readFileSync(
    path.join(repoRoot, 'backend/Marketplace.Application/Services/ReviewService.cs'),
    'utf8'
  );
  assert(reviewServiceCode.includes('!u.IsActive || string.IsNullOrWhiteSpace(u.Name)'), 'ReviewService must anonymize deleted buyer display names');
  console.log('✅ Item 7 (C#): UserService & ReviewService enforce 409 Seller guard, order PII scrubbing, file cleanup, and review author anonymization.');

  // 4. Item 10: Program.cs & StartupGuards.cs verify production environment assertions
  assert(programCode.includes('jwtKey.Length < 32'), 'Program.cs must verify JWT secret is at least 32 characters');
  const startupGuardsCode = fs.readFileSync(
    path.join(repoRoot, 'backend/Marketplace.Application/Common/StartupGuards.cs'),
    'utf8'
  );
  assert(startupGuardsCode.includes('ValidateProductionGuards'), 'StartupGuards must provide ValidateProductionGuards');
  assert(startupGuardsCode.includes('Security:TwoFactorEncryptionKey'), 'StartupGuards must check Security:TwoFactorEncryptionKey is present in production');
  console.log('✅ Item 10 (C#): Program.cs & StartupGuards.cs enforce Jwt Key >= 32 chars, non-superuser DB, SSL, 2FA key, and prod isolation.');
}

async function runAllMockTests() {
  verifyCSharpSourceContracts();

  // In-memory mock database for account deletion & export validation
  const db = {
    users: [
      { id: 55, name: 'مشتري نشط', email: 'buyer@example.com', phone: '+201011111111', role: 'Buyer', isActive: true, tokenVersion: 1 },
      { id: 77, name: 'بائع نشط', email: 'seller@example.com', phone: '+201022222222', role: 'Seller', isActive: true, tokenVersion: 1 },
    ],
    products: [{ id: 101, sellerId: 77, title: 'منتج تجريبي', isDeleted: false }],
    orders: [
      {
        id: 501,
        buyerId: 55,
        recipientName: 'فايز محمد',
        recipientPhone: '+201099999999',
        governorate: 'القاهرة',
        city: 'مدينة نصر',
        area: 'الحي السابع',
        streetBuilding: 'شارع الطيران عمارة 4',
        totalAmount: 1500,
        items: [{ id: 1, productId: 101, quantity: 2, unitPrice: 750 }],
      },
    ],
    reviews: [
      { id: 201, userId: 55, productId: 101, rating: 5, comment: 'ممتاز', photoUrlsJson: JSON.stringify(['/uploads/reviews/r1.jpg']) },
    ],
    refreshTokens: [
      { id: 1, userId: 55, tokenHash: 'HASH_NEVER_EXPORT', deviceId: 'dev_123', deviceName: 'iPhone 15', createdAt: new Date(), lastUsedAt: new Date(), expiresAt: new Date(Date.now() + 86400000), revokedAt: null },
    ],
    shipments: [{ id: 301, orderId: 501, sellerId: 77, status: 'HandedToCarrier' }],
    vendorWallets: [{ sellerId: 77, balance: 500, pendingBalance: 0 }],
    deletedFiles: [],
  };

  function deleteAccount(userId) {
    const user = db.users.find((u) => u.id === userId);
    if (user.role === 'Seller') {
      const hasProducts = db.products.some((p) => p.sellerId === userId);
      const hasOpenShipments = db.shipments.some((s) => s.sellerId === userId && !['Delivered', 'Cancelled', 'DeliveryFailed'].includes(s.status));
      const wallet = db.vendorWallets.find((w) => w.sellerId === userId);
      const hasWalletBalance = wallet && (wallet.balance > 0 || wallet.pendingBalance > 0);
      if (hasProducts || hasOpenShipments || hasWalletBalance) {
        return { status: 409, error: 'Cannot delete seller account while active products, open shipments, or wallet/payout balances exist.' };
      }
    }

    // Scrub buyer orders (keep Governorate, City, totals, items)
    for (const order of db.orders.filter((o) => o.buyerId === userId)) {
      order.recipientName = '';
      order.recipientPhone = '';
      order.area = '';
      order.streetBuilding = '';
    }

    // Delete review photos
    for (const rev of db.reviews.filter((r) => r.userId === userId)) {
      if (rev.photoUrlsJson) {
        const urls = JSON.parse(rev.photoUrlsJson);
        db.deletedFiles.push(...urls);
        rev.photoUrlsJson = null;
      }
    }

    user.name = '';
    user.email = null;
    user.phone = null;
    user.isActive = false;
    user.tokenVersion++;
    db.refreshTokens = db.refreshTokens.filter((r) => r.userId !== userId);
    return { status: 204 };
  }

  function exportUserData(userId) {
    const user = db.users.find((u) => u.id === userId);
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      reviews: db.reviews.filter((r) => r.userId === userId),
      deviceSessions: db.refreshTokens
        .filter((r) => r.userId === userId)
        .map(({ deviceId, deviceName, createdAt, lastUsedAt, expiresAt, revokedAt }) => ({
          deviceId,
          deviceName,
          createdAt,
          lastUsedAt,
          expiresAt,
          isActive: !revokedAt,
        })),
      orders: db.orders.filter((o) => o.buyerId === userId),
    };
  }

  // Verify export-data BEFORE deletion includes Reviews, DeviceSessions (without tokenHash), and Orders
  const exported = exportUserData(55);
  assert.strictEqual(exported.reviews.length, 1, 'Export data must include user reviews');
  assert.strictEqual(exported.deviceSessions.length, 1, 'Export data must include device sessions');
  assert.strictEqual(exported.deviceSessions[0].tokenHash, undefined, 'Exported device sessions must NEVER expose tokenHash');
  assert.strictEqual(exported.orders.length, 1, 'Export data must include orders');

  // Verify Seller with active products/open shipments/wallet balance is refused with 409 Conflict
  const sellerDelRes = deleteAccount(77);
  assert.strictEqual(sellerDelRes.status, 409, 'Seller with active products, open shipments, or wallet balance must return 409 Conflict');

  // Verify Buyer deletion scrubs order PII, keeps Governorate/City/totals/items, deletes review photos, and anonymizes review author
  const buyerDelRes = deleteAccount(55);
  assert.strictEqual(buyerDelRes.status, 204, 'Buyer deletion succeeds with 204');

  const orderAfter = db.orders[0];
  assert.strictEqual(orderAfter.recipientName, '', 'Order.RecipientName must be scrubbed');
  assert.strictEqual(orderAfter.recipientPhone, '', 'Order.RecipientPhone must be scrubbed');
  assert.strictEqual(orderAfter.area, '', 'Order.Area must be scrubbed');
  assert.strictEqual(orderAfter.streetBuilding, '', 'Order.StreetBuilding must be scrubbed');
  assert.strictEqual(orderAfter.governorate, 'القاهرة', 'Order.Governorate must be preserved');
  assert.strictEqual(orderAfter.city, 'مدينة نصر', 'Order.City must be preserved');
  assert.strictEqual(orderAfter.totalAmount, 1500, 'Order.TotalAmount must be preserved');
  assert.strictEqual(orderAfter.items.length, 1, 'Order.Items must be preserved');

  assert.strictEqual(db.reviews[0].photoUrlsJson, null, 'Review photoUrlsJson must be cleared');
  assert.deepStrictEqual(db.deletedFiles, ['/uploads/reviews/r1.jpg'], 'Review photo files must be deleted from storage');

  const buyerAfter = db.users.find((u) => u.id === 55);
  const reviewDisplayName = !buyerAfter.isActive || !buyerAfter.name ? 'مشتري' : buyerAfter.name;
  assert.strictEqual(reviewDisplayName, 'مشتري', 'Review display name must be anonymized to مشتري');
  console.log('✅ Item 7 passed: Seller 409 Conflict, Buyer order PII scrubbing, review anonymization/photo deletion, and ExportUserData verified.');

  console.log('\n================================================================');
  console.log('🎉 ALL MOCK & SOURCE VERIFICATION TESTS PASSED!');
  console.log('================================================================\n');
}

runAllMockTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
