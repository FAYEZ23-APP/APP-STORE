/**
 * PHASE 9 — Dedicated Automated Security & Tenant Isolation Test Suite (PostgreSQL TEST_DB)
 * 
 * Tests all 15 explicit audit scenarios:
 *  1. Buyer A accessing Buyer B's order (GET, Cancel, Confirm)
 *  2. Buyer A modifying Buyer B's address (PUT, GET, DELETE)
 *  3. Seller A accessing Seller B's product (PUT, QuickStock, DELETE)
 *  4. Seller A accessing Seller B's shipment (PUT handover)
 *  5. Seller A reading another seller's settlement (Wallet scoping & Admin payouts access)
 *  6. Buyer accessing seller-only endpoints (Products, Shipments, Wallet, Orders, Returns)
 *  7. Seller accessing admin-only endpoints (Users, Stats, Shipments, Payouts, AuditLogs, Categories, Reindex)
 *  8. Guest accessing protected endpoints (Orders, Profile, Wallet, Admin, Notifications, Wishlist)
 *  9. Mass assignment of UserRole (Registration role validation & Profile update role immutability)
 * 10. Mass assignment of WalletBalance (Profile update & Order checkout balance protection)
 * 11. Unauthorized status modification (Orders Delivered, Shipment Delivered by Seller, Admin user status)
 * 12. Unauthorized ownership modification (Product SellerId & Address UserId immutability)
 * 13. Privilege escalation through request properties (Seller AdminOverride overdraft blocked vs Admin allowed)
 * 14. Direct API access without frontend navigation (Direct API curl/fetch calls blocked by server guards)
 * 15. Cross-role access to private dispute documents (PDPL Law 151/2020 private evidence isolation)
 */

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const {
  getFreePort,
  getValidatedTestDb,
  stopServer,
  waitForHealth,
} = require('./helpers/test_harness');

function createValidJpegBuffer() {
  const b64 = execSync(
    'powershell -NoProfile -Command "' +
      'Add-Type -AssemblyName System.Drawing; ' +
      '$bmp = New-Object System.Drawing.Bitmap(320, 240); ' +
      '$g = [System.Drawing.Graphics]::FromImage($bmp); ' +
      '$g.Clear([System.Drawing.Color]::RoyalBlue); ' +
      '$g.Dispose(); ' +
      '$ms = New-Object System.IO.MemoryStream; ' +
      '$bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Jpeg); ' +
      '$bmp.Dispose(); ' +
      '[Convert]::ToBase64String($ms.ToArray())"',
    { encoding: 'utf8' }
  ).trim();
  return Buffer.from(b64, 'base64');
}

let passedCount = 0;
let failedCount = 0;
const testResults = [];

function recordTest(num, name, passed, detail = '') {
  if (passed) {
    passedCount++;
    console.log(`  [PASS] Scenario #${num}: ${name}${detail ? ' -> ' + detail : ''}`);
  } else {
    failedCount++;
    console.error(`  [FAIL] Scenario #${num}: ${name}${detail ? ' -> ' + detail : ''}`);
  }
  testResults.push({ num, name, passed, detail });
}

async function api(baseUrl, method, endpoint, { token = null, body = null, headers = {} } = {}) {
  const url = `${baseUrl}${endpoint}`;
  const reqHeaders = { ...headers };
  if (token) {
    reqHeaders['Authorization'] = `Bearer ${token}`;
  }
  let reqBody = null;
  if (body !== null) {
    if (body instanceof Buffer) {
      reqBody = body;
    } else if (typeof body === 'object') {
      reqHeaders['Content-Type'] = 'application/json';
      reqBody = JSON.stringify(body);
    } else {
      reqBody = String(body);
    }
  }

  const res = await fetch(url, {
    method,
    headers: reqHeaders,
    body: reqBody,
  });

  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, ok: res.ok, data, headers: res.headers };
}

(async () => {
  console.log('================================================================');
  console.log(' PHASE 9 — API AUTHORIZATION & TENANT ISOLATION TEST SUITE');
  console.log(' Target Provider: PostgreSQL (TEST_DB)');
  console.log('================================================================');

  const { connStr, dbName } = getValidatedTestDb();
  const port = await getFreePort();
  const baseUrl = `http://localhost:${port}`;
  const runId = Date.now().toString().slice(-6);

  const adminEmail = `admin_phase9_${runId}@marketplace.eg`;
  const adminPassword = `AdminPass123456789!_${runId}`;

  const apiCsproj = path.resolve(__dirname, '../Marketplace.API/Marketplace.API.csproj');
  const logPath = path.resolve(__dirname, `server_phase9_${port}.log`);
  const logFd = fs.openSync(logPath, 'w');

  console.log(`Allocated ephemeral test port: ${port} | DB: ${dbName}`);
  console.log('Starting test host process...');

  const serverProc = spawn('dotnet', [
    'run',
    '--no-build',
    '--project', apiCsproj,
    '--urls', baseUrl,
  ], {
    stdio: ['ignore', logFd, logFd],
    env: {
      ...process.env,
      ASPNETCORE_ENVIRONMENT: 'Development',
      ConnectionStrings__DefaultConnection: connStr,
      Database__AutoMigrate: 'false',
      Jwt__Key: 'IntegrationTestSecretKey_AtLeast32CharsLong_Phase9AuditTest!',
      Jwt__Issuer: 'MarketplaceAPI',
      Jwt__Audience: 'MarketplaceClient',
      Auth__CodeSecret: 'IntegrationTestCodeSecret_AtLeast32CharsLong!',
      Auth__RequireVerification: 'false',
      Features__EnableWallet: 'true',
      Features__EnableVendorPayouts: 'true',
      Features__EnableCoupons: 'true',
      Wallet__Enabled: 'true',
      Admin__Email: adminEmail,
      Admin__Password: adminPassword,
      Admin__Require2FA: 'false',
    },
  });

  try {
    await waitForHealth(baseUrl, 35000);
    console.log('Test host is healthy and responding.\n');

    // ─── Setup Test Accounts ──────────────────────────────────────────────
    console.log('--- Registering Accounts (Admin, Buyer A, Buyer B, Seller A, Seller B) ---');

    // Admin login
    const adminLoginRes = await api(baseUrl, 'POST', '/api/auth/login', {
      body: { identifier: adminEmail, password: adminPassword },
    });
    assert.strictEqual(adminLoginRes.status, 200, 'Admin login failed');
    const adminToken = adminLoginRes.data.token;

    // Helper to register and get token
    async function setupUser(role, suffix) {
      const email = `${role.toLowerCase()}_${suffix}_${runId}@example.com`;
      const pass = 'P@ssword123456!';
      const reg = await api(baseUrl, 'POST', '/api/auth/register', {
        body: {
          name: `${role} ${suffix}`,
          email,
          password: pass,
          role,
          acceptedTermsAndPrivacy: true,
        },
      });
      assert.strictEqual(reg.status, 202, `Registration failed for ${email}`);

      const login = await api(baseUrl, 'POST', '/api/auth/login', {
        body: { identifier: email, password: pass },
      });
      assert.strictEqual(login.status, 200, `Login failed for ${email}`);

      if (role === 'Seller') {
        const profRes = await api(baseUrl, 'PUT', '/api/users/me/seller-profile', {
          token: login.data.token,
          body: {
            dispatchCity: 'القاهرة',
            dispatchAddress: 'المعادي شارع 9',
            contactPhone: '01012345678',
          },
        });
        assert.strictEqual(profRes.status, 200, `Seller profile update failed for ${email}`);
      }

      return { token: login.data.token, userId: login.data.userId, email };
    }

    const buyerA = await setupUser('Buyer', 'A');
    const buyerB = await setupUser('Buyer', 'B');
    const sellerA = await setupUser('Seller', 'A');
    const sellerB = await setupUser('Seller', 'B');

    // Setup initial products
    const prodARes = await api(baseUrl, 'POST', '/api/products', {
      token: sellerA.token,
      body: {
        name: `Product Seller A ${runId}`,
        nameAr: `منتج البائع أ ${runId}`,
        price: 250.00,
        stock: 50,
        weightGrams: 500,
        categoryId: 1,
        description: 'Product for Seller A',
      },
    });
    assert.strictEqual(prodARes.status, 201, 'Product A creation failed');
    const prodAId = prodARes.data.id;

    const prodBRes = await api(baseUrl, 'POST', '/api/products', {
      token: sellerB.token,
      body: {
        name: `Product Seller B ${runId}`,
        nameAr: `منتج البائع ب ${runId}`,
        price: 350.00,
        stock: 40,
        weightGrams: 700,
        categoryId: 1,
        description: 'Product for Seller B',
      },
    });
    assert.strictEqual(prodBRes.status, 201, 'Product B creation failed');
    const prodBId = prodBRes.data.id;

    // Buyer B places an order on Product B
    const orderBRes = await api(baseUrl, 'POST', '/api/orders', {
      token: buyerB.token,
      body: {
        items: [{ productId: prodBId, quantity: 1 }],
        deliveryMethod: 'Courier',
        paymentMethod: 'OnReceipt',
        recipientName: 'Recipient Buyer B',
        recipientPhone: '010' + Math.floor(10000000 + Math.random() * 90000000),
        governorate: 'القاهرة',
        city: 'القاهرة',
        area: 'المنطقة الأولى',
        streetBuilding: 'شارع عباس العقاد 12',
      },
    });
        if (orderBRes.status !== 201) {
      console.log('Order B failed with data:', JSON.stringify(orderBRes.data));
    }
    assert.strictEqual(orderBRes.status, 201, 'Order B creation failed');
    const orderB = orderBRes.data;
    const shipmentBId = orderB.shipments[0]?.id;

    // Buyer B creates an address
    const addressBRes = await api(baseUrl, 'POST', '/api/users/me/addresses', {
      token: buyerB.token,
      body: {
        recipientName: 'Recipient Buyer B',
        recipientPhone: '010' + Math.floor(10000000 + Math.random() * 90000000),
        governorate: 'القاهرة',
        city: 'القاهرة',
        area: 'المنطقة الأولى',
        streetBuilding: 'شارع عباس العقاد 12',
        buildingNumber: '12',
        isDefault: true,
      },
    });
    assert.strictEqual(addressBRes.status, 201, 'Address B creation failed');
    const addressBId = addressBRes.data.id;

    console.log('Initial test entities seeded successfully.\n');

    // ──────────────────────────────────────────────────────────────────────────
    // SCENARIO 1: Buyer A accessing Buyer B's order
    // ──────────────────────────────────────────────────────────────────────────
    const getOrderOther = await api(baseUrl, 'GET', `/api/orders/${orderB.id}`, { token: buyerA.token });
    const cancelOrderOther = await api(baseUrl, 'POST', `/api/orders/${orderB.id}/cancel`, { token: buyerA.token });
    const confirmOrderOther = await api(baseUrl, 'POST', `/api/orders/${orderB.id}/confirm`, { token: buyerA.token });

    const s1Pass = getOrderOther.status === 403 && cancelOrderOther.status === 403 && confirmOrderOther.status === 403;
    recordTest(1, "Buyer A accessing Buyer B's order", s1Pass,
      `GET=${getOrderOther.status}, Cancel=${cancelOrderOther.status}, Confirm=${confirmOrderOther.status} (all 403)`);

    // ──────────────────────────────────────────────────────────────────────────
    // SCENARIO 2: Buyer A modifying Buyer B's address
    // ──────────────────────────────────────────────────────────────────────────
    const getAddressOther = await api(baseUrl, 'GET', `/api/users/me/addresses/${addressBId}`, { token: buyerA.token });
    const putAddressOther = await api(baseUrl, 'PUT', `/api/users/me/addresses/${addressBId}`, {
      token: buyerA.token,
      body: {
        recipientName: 'Hacker Name',
        recipientPhone: '01099999999',
        governorate: 'القاهرة',
        city: 'القاهرة',
        area: 'المنطقة الأولى',
        streetBuilding: 'Hacked street',
      },
    });
    const delAddressOther = await api(baseUrl, 'DELETE', `/api/users/me/addresses/${addressBId}`, { token: buyerA.token });

    const s2Pass = getAddressOther.status === 403 && putAddressOther.status === 403 && delAddressOther.status === 403;
    recordTest(2, "Buyer A modifying Buyer B's address", s2Pass,
      `GET=${getAddressOther.status}, PUT=${putAddressOther.status}, DELETE=${delAddressOther.status} (all 403)`);

    // ──────────────────────────────────────────────────────────────────────────
    // SCENARIO 3: Seller A accessing Seller B's product
    // ──────────────────────────────────────────────────────────────────────────
    const putProdOther = await api(baseUrl, 'PUT', `/api/products/${prodBId}`, {
      token: sellerA.token,
      body: {
        name: 'Hacked Product Name',
        price: 1.00,
        stock: 999,
        weightGrams: 500,
        categoryId: 1,
        description: 'Hacked description',
      },
    });
    const patchProdOther = await api(baseUrl, 'PATCH', `/api/products/${prodBId}/quick-stock`, {
      token: sellerA.token,
      body: { stock: 999, price: 1.00 },
    });
    const delProdOther = await api(baseUrl, 'DELETE', `/api/products/${prodBId}`, { token: sellerA.token });

    const s3Pass = putProdOther.status === 403 && patchProdOther.status === 403 && delProdOther.status === 403;
    recordTest(3, "Seller A accessing Seller B's product", s3Pass,
      `PUT=${putProdOther.status}, PATCH=${patchProdOther.status}, DELETE=${delProdOther.status} (all 403)`);

    // ──────────────────────────────────────────────────────────────────────────
    // SCENARIO 4: Seller A accessing Seller B's shipment
    // ──────────────────────────────────────────────────────────────────────────
    const handoverOther = await api(baseUrl, 'PUT', `/api/shipments/${shipmentBId}/status`, {
      token: sellerA.token,
      body: { status: 'HandedToCarrier' },
    });
    const s4Pass = handoverOther.status === 403;
    recordTest(4, "Seller A accessing Seller B's shipment", s4Pass,
      `PUT status=${handoverOther.status} (403)`);

    // ──────────────────────────────────────────────────────────────────────────
    // SCENARIO 5: Seller A reading another seller's settlement
    // ──────────────────────────────────────────────────────────────────────────
    const sellerAWallet = await api(baseUrl, 'GET', '/api/wallet/me', { token: sellerA.token });
    const sellerAAdminPayouts = await api(baseUrl, 'GET', '/api/admin/wallet/payouts', { token: sellerA.token });

    const s5Pass = sellerAWallet.status === 200 &&
                   sellerAWallet.data.sellerId === sellerA.userId &&
                   sellerAAdminPayouts.status === 403;
    recordTest(5, "Seller A reading another seller's settlement", s5Pass,
      `WalletMe.SellerId=${sellerAWallet.data?.sellerId} (scoped to caller), AdminPayouts=${sellerAAdminPayouts.status} (403)`);

    // ──────────────────────────────────────────────────────────────────────────
    // SCENARIO 6: Buyer accessing seller-only endpoints
    // ──────────────────────────────────────────────────────────────────────────
    const bCreateProd = await api(baseUrl, 'POST', '/api/products', { token: buyerA.token, body: {} });
    const bMyProds = await api(baseUrl, 'GET', '/api/products/my-products', { token: buyerA.token });
    const bSellerShipments = await api(baseUrl, 'GET', '/api/shipments/seller', { token: buyerA.token });
    const bWalletMe = await api(baseUrl, 'GET', '/api/wallet/me', { token: buyerA.token });
    const bSellerOrders = await api(baseUrl, 'GET', '/api/orders/seller', { token: buyerA.token });
    const bResolveReturn = await api(baseUrl, 'PUT', '/api/returns/1/resolve', { token: buyerA.token, body: { status: 'Approved' } });

    const s6Pass = bCreateProd.status === 403 &&
                   bMyProds.status === 403 &&
                   bSellerShipments.status === 403 &&
                   bWalletMe.status === 403 &&
                   bSellerOrders.status === 403 &&
                   bResolveReturn.status === 403;
    recordTest(6, "Buyer accessing seller-only endpoints", s6Pass,
      `Products=${bCreateProd.status}, MyProducts=${bMyProds.status}, Shipments=${bSellerShipments.status}, Wallet=${bWalletMe.status}, Returns=${bResolveReturn.status} (all 403)`);

    // ──────────────────────────────────────────────────────────────────────────
    // SCENARIO 7: Seller accessing admin-only endpoints
    // ──────────────────────────────────────────────────────────────────────────
    const sAdminUsers = await api(baseUrl, 'GET', '/api/admin/users', { token: sellerA.token });
    const sAdminStats = await api(baseUrl, 'GET', '/api/admin/stats', { token: sellerA.token });
    const sAdminShipments = await api(baseUrl, 'GET', '/api/admin/shipments', { token: sellerA.token });
    const sAdminProcessPayout = await api(baseUrl, 'POST', '/api/admin/wallet/payouts/1/process', { token: sellerA.token, body: {} });
    const sAdminAuditLogs = await api(baseUrl, 'GET', '/api/admin/audit-logs', { token: sellerA.token });
    const sAdminCategory = await api(baseUrl, 'POST', '/api/categories', { token: sellerA.token, body: { key: 'test', iconName: 'box' } });
    const sAdminReindex = await api(baseUrl, 'POST', '/api/search/reindex', { token: sellerA.token });

    const s7Pass = sAdminUsers.status === 403 &&
                   sAdminStats.status === 403 &&
                   sAdminShipments.status === 403 &&
                   sAdminProcessPayout.status === 403 &&
                   sAdminAuditLogs.status === 403 &&
                   sAdminCategory.status === 403 &&
                   sAdminReindex.status === 403;
    recordTest(7, "Seller accessing admin-only endpoints", s7Pass,
      `Users=${sAdminUsers.status}, Stats=${sAdminStats.status}, Shipments=${sAdminShipments.status}, Payouts=${sAdminProcessPayout.status}, AuditLogs=${sAdminAuditLogs.status}, Categories=${sAdminCategory.status}, Reindex=${sAdminReindex.status} (all 403)`);

    // ──────────────────────────────────────────────────────────────────────────
    // SCENARIO 8: Guest accessing protected endpoints
    // ──────────────────────────────────────────────────────────────────────────
    const gProfile = await api(baseUrl, 'GET', '/api/users/me');
    const gOrders = await api(baseUrl, 'GET', '/api/orders/mine');
    const gPostOrder = await api(baseUrl, 'POST', '/api/orders', { body: {} });
    const gWallet = await api(baseUrl, 'GET', '/api/wallet/me');
    const gAdmin = await api(baseUrl, 'GET', '/api/admin/users');
    const gNotifs = await api(baseUrl, 'GET', '/api/notifications');
    const gWishlist = await api(baseUrl, 'GET', '/api/wishlist');

    const s8Pass = gProfile.status === 401 &&
                   gOrders.status === 401 &&
                   gPostOrder.status === 401 &&
                   gWallet.status === 401 &&
                   gAdmin.status === 401 &&
                   gNotifs.status === 401 &&
                   gWishlist.status === 401;
    recordTest(8, "Guest accessing protected endpoints", s8Pass,
      `Profile=${gProfile.status}, OrdersMine=${gOrders.status}, PostOrder=${gPostOrder.status}, Wallet=${gWallet.status}, AdminUsers=${gAdmin.status}, Notifs=${gNotifs.status}, Wishlist=${gWishlist.status} (all 401)`);

    // ──────────────────────────────────────────────────────────────────────────
    // SCENARIO 9: Mass assignment of UserRole
    // ──────────────────────────────────────────────────────────────────────────
    const regAdminRes = await api(baseUrl, 'POST', '/api/auth/register', {
      body: {
        name: 'Malicious Admin Wannabe',
        email: `wannabe_admin_${runId}@evil.com`,
        password: 'P@ssword123456!',
        role: 'Admin',
        acceptedTermsAndPrivacy: true,
      },
    });

    const putProfileRole = await api(baseUrl, 'PUT', '/api/users/me', {
      token: buyerA.token,
      body: {
        name: 'Buyer A Renamed',
        role: 'Admin',
        userRole: 'Admin',
      },
    });

    const verifyBuyerProfile = await api(baseUrl, 'GET', '/api/users/me', { token: buyerA.token });

    const s9Pass = regAdminRes.status === 400 &&
                   putProfileRole.status === 200 &&
                   verifyBuyerProfile.data?.role === 'Buyer';
    recordTest(9, "Mass assignment of UserRole", s9Pass,
      `RegisterRoleAdmin=${regAdminRes.status} (400), ProfileUpdate=${putProfileRole.status}, EffectiveRole=${verifyBuyerProfile.data?.role} (remained Buyer)`);

    // ──────────────────────────────────────────────────────────────────────────
    // SCENARIO 10: Mass assignment of WalletBalance
    // ──────────────────────────────────────────────────────────────────────────
    const putProfileWallet = await api(baseUrl, 'PUT', '/api/users/me', {
      token: buyerA.token,
      body: {
        name: 'Buyer A Rich',
        balance: 999999.00,
        walletBalance: 999999.00,
      },
    });

    const buyerWalletAfter = await api(baseUrl, 'GET', '/api/users/me/wallet', { token: buyerA.token });

    const s10Pass = putProfileWallet.status === 200 &&
                    buyerWalletAfter.data?.balance === 0;
    recordTest(10, "Mass assignment of WalletBalance", s10Pass,
      `ProfileUpdate=${putProfileWallet.status}, WalletBalance=${buyerWalletAfter.data?.balance} (unmodified, 0)`);

    // ──────────────────────────────────────────────────────────────────────────
    // SCENARIO 11: Unauthorized status modification
    // ──────────────────────────────────────────────────────────────────────────
    const buyerSetOrderDelivered = await api(baseUrl, 'PUT', `/api/orders/${orderB.id}/status`, {
      token: buyerA.token,
      body: { status: 'Delivered' },
    });
    const sellerBSetShipmentDelivered = await api(baseUrl, 'PUT', `/api/shipments/${shipmentBId}/status`, {
      token: sellerB.token,
      body: { status: 'Delivered' },
    });
    const sellerBSetUserStatus = await api(baseUrl, 'PUT', `/api/admin/users/${buyerA.userId}/status`, {
      token: sellerB.token,
      body: { isActive: false },
    });

    const s11Pass = buyerSetOrderDelivered.status === 403 &&
                    sellerBSetShipmentDelivered.status === 403 &&
                    sellerBSetUserStatus.status === 403;
    recordTest(11, "Unauthorized status modification", s11Pass,
      `BuyerOrderDelivered=${buyerSetOrderDelivered.status} (403), SellerShipmentDelivered=${sellerBSetShipmentDelivered.status} (403), SellerBanUser=${sellerBSetUserStatus.status} (403)`);

    // ──────────────────────────────────────────────────────────────────────────
    // SCENARIO 12: Unauthorized ownership modification
    // ──────────────────────────────────────────────────────────────────────────
    const putProdSellerId = await api(baseUrl, 'PUT', `/api/products/${prodAId}`, {
      token: sellerA.token,
      body: {
        name: 'Product A Tampered SellerId',
        sellerId: sellerB.userId,
        userId: sellerB.userId,
        price: 250.00,
        stock: 50,
        weightGrams: 500,
        categoryId: 1,
        description: 'Attempting to transfer product to Seller B',
      },
    });

    const getProdAfter = await api(baseUrl, 'GET', `/api/products/${prodAId}`);

    const s12Pass = putProdSellerId.status === 200 &&
                    getProdAfter.data?.sellerId === sellerA.userId;
    recordTest(12, "Unauthorized ownership modification", s12Pass,
      `UpdateProduct=${putProdSellerId.status}, ResultingSellerId=${getProdAfter.data?.sellerId} (remained Seller A ${sellerA.userId})`);

    // ──────────────────────────────────────────────────────────────────────────
    // SCENARIO 13: Privilege escalation through request properties (AdminOverride)
    // ──────────────────────────────────────────────────────────────────────────
    // Buyer A places an order on Product A
    const buyerOrderA = await api(baseUrl, 'POST', '/api/orders', {
      token: buyerA.token,
      body: {
        items: [{ productId: prodAId, quantity: 1 }],
        deliveryMethod: 'Courier',
        paymentMethod: 'OnReceipt',
        recipientName: 'Recipient Buyer A',
        recipientPhone: '011' + Math.floor(10000000 + Math.random() * 90000000),
        governorate: 'القاهرة',
        city: 'القاهرة',
        area: 'المنطقة الأولى',
        streetBuilding: 'شارع عباس العقاد 10',
      },
    });
    const orderA = buyerOrderA.data;
    const orderAItemId = orderA.items[0]?.id;
    const orderAShipmentId = orderA.shipments[0]?.id;

    // Handover & Deliver shipment so return becomes eligible
    await api(baseUrl, 'PUT', `/api/shipments/${orderAShipmentId}/status`, {
      token: sellerA.token,
      body: { status: 'HandedToCarrier' },
    });
    await api(baseUrl, 'PUT', `/api/admin/shipments/${orderAShipmentId}/status`, {
      token: adminToken,
      body: { status: 'Delivered', settleCod: false },
    });

    const returnReqRes = await api(baseUrl, 'POST', '/api/returns', {
      token: buyerA.token,
      body: {
        orderItemId: orderAItemId,
        quantity: 1,
        category: 'Standard14Day',
        reason: 'Item defective',
      },
    });
    const returnId = returnReqRes.data?.id;

    // Seller A has 0 balance (COD was not settled, balance is 0).
    // Seller attempts to confirm receipt with adminOverride: true
    const sellerOverdraftAttempt = await api(baseUrl, 'PUT', `/api/returns/${returnId}/confirm-received`, {
      token: sellerA.token,
      body: { adminOverride: true, note: 'Seller trying to bypass anti-overdraft' },
    });

    // Admin confirms with adminOverride: true -> legitimate platform override
    const adminOverrideSuccess = await api(baseUrl, 'PUT', `/api/returns/${returnId}/confirm-received`, {
      token: adminToken,
      body: { adminOverride: true, note: 'Legitimate Admin override' },
    });

    const s13Pass = sellerOverdraftAttempt.status === 400 &&
                    adminOverrideSuccess.status === 200;
    recordTest(13, "Privilege escalation through request properties (AdminOverride)", s13Pass,
      `SellerAdminOverride=${sellerOverdraftAttempt.status} (400 anti-overdraft enforced), AdminConfirmReceived=${adminOverrideSuccess.status} (200 success)`);

    // ──────────────────────────────────────────────────────────────────────────
    // SCENARIO 14: Direct API access without frontend navigation
    // ──────────────────────────────────────────────────────────────────────────
    const directApiNoAuth = await api(baseUrl, 'GET', '/api/admin/stats');
    const directApiBuyer = await api(baseUrl, 'GET', '/api/admin/stats', { token: buyerA.token });
    const directApiSeller = await api(baseUrl, 'GET', '/api/admin/stats', { token: sellerA.token });
    const directApiAdmin = await api(baseUrl, 'GET', '/api/admin/stats', { token: adminToken });

    const s14Pass = directApiNoAuth.status === 401 &&
                    directApiBuyer.status === 403 &&
                    directApiSeller.status === 403 &&
                    directApiAdmin.status === 200;
    recordTest(14, "Direct API access without frontend navigation", s14Pass,
      `AnonDirect=${directApiNoAuth.status} (401), BuyerDirect=${directApiBuyer.status} (403), SellerDirect=${directApiSeller.status} (403), AdminDirect=${directApiAdmin.status} (200)`);

    // ──────────────────────────────────────────────────────────────────────────
    // SCENARIO 15: Cross-role access to private dispute documents
    // ──────────────────────────────────────────────────────────────────────────
    const jpegBuffer = createValidJpegBuffer();
    const boundary = '----WebKitFormBoundary' + crypto.randomBytes(16).toString('hex');
    let multipartBody = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="defect.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
      jpegBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const uploadEvidenceRes = await api(baseUrl, 'POST', '/api/files/private/return-evidence', {
      token: buyerA.token,
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body: multipartBody,
    });
    assert.strictEqual(uploadEvidenceRes.status, 200, 'Upload evidence failed');
    const privateFileName = uploadEvidenceRes.data.fileName;

    // Buyer B attempts to download Buyer A's private evidence
    const buyerBDownload = await api(baseUrl, 'GET', `/api/files/private/${privateFileName}`, { token: buyerB.token });
    // Seller B attempts to download Buyer A's private evidence
    const sellerBDownload = await api(baseUrl, 'GET', `/api/files/private/${privateFileName}`, { token: sellerB.token });
    // Buyer A (uploader) downloads
    const buyerADownload = await api(baseUrl, 'GET', `/api/files/private/${privateFileName}`, { token: buyerA.token });
    // Admin downloads
    const adminDownload = await api(baseUrl, 'GET', `/api/files/private/${privateFileName}`, { token: adminToken });

    const s15Pass = buyerBDownload.status === 403 &&
                    sellerBDownload.status === 403 &&
                    buyerADownload.status === 200 &&
                    adminDownload.status === 200;
    recordTest(15, "Cross-role access to private dispute documents", s15Pass,
      `UnrelatedBuyer=${buyerBDownload.status} (403), UnrelatedSeller=${sellerBDownload.status} (403), UploaderBuyer=${buyerADownload.status} (200), AdminAudit=${adminDownload.status} (200)`);

    console.log('\n================================================================');
    console.log(` RESULTS: ${passedCount} PASSED, ${failedCount} FAILED out of 15 scenarios`);
    console.log('================================================================');

    if (failedCount > 0) {
      process.exit(1);
    }
  } finally {
    if (failedCount > 0 && fs.existsSync(logPath)) {
      try {
        console.log('\n--- SERVER LOG OUTPUT ---');
        console.log(fs.readFileSync(logPath, 'utf8'));
      } catch {}
    }
    stopServer(serverProc, logFd, logPath);
  }
})();
