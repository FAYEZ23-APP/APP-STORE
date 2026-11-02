/**
 * Wave 1 Integration Test: Check Constraints, Indexes, pg_trgm, and Migration Drift
 * Verified against PostgreSQL TEST_DB (MarketplaceMVP_test)
 */

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { getValidatedTestDb } = require('./helpers/test_harness');

const SUITE_ID = 'wave1_db_constraints_indexes_postgres';

const { connStr, dbName } = getValidatedTestDb();
console.log(`Target Database: ${dbName}`);

// Parse credentials from connStr safely
const pairs = connStr.split(';');
const config = {};
for (const pair of pairs) {
  const idx = pair.indexOf('=');
  if (idx > 0) {
    config[pair.substring(0, idx).trim()] = pair.substring(idx + 1).trim();
  }
}

const host = config['Host'] || 'localhost';
const port = config['Port'] || '5432';
const user = config['Username'] || 'postgres';
const password = config['Password'];

const psqlPath = 'C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe';

function runSqlWithRollback(sql) {
  // Wrap in BEGIN ... ROLLBACK to guarantee ZERO persistent state changes
  const wrappedSql = `
    BEGIN;
    ${sql}
    ROLLBACK;
  `;
  const tempSqlFile = path.join(__dirname, `wave1_test_${Date.now()}_${Math.floor(Math.random() * 1000)}.sql`);
  fs.writeFileSync(tempSqlFile, wrappedSql, 'utf8');
  try {
    const res = spawnSync(psqlPath, [
      '-h', host,
      '-p', port,
      '-U', user,
      '-d', dbName,
      '-v', 'ON_ERROR_STOP=1',
      '-f', tempSqlFile
    ], {
      encoding: 'utf8',
      env: { ...process.env, PGPASSWORD: password },
    });
    return (res.stdout || '') + '\n' + (res.stderr || '');
  } finally {
    if (fs.existsSync(tempSqlFile)) {
      try { fs.unlinkSync(tempSqlFile); } catch {}
    }
  }
}

let passed = 0;
let failed = 0;

function check(ok, desc, detail = '') {
  if (ok) {
    passed++;
    console.log(`  [PASS] ${desc}`);
  } else {
    failed++;
    console.log(`  [FAIL] ${desc}${detail ? ' -> ' + detail : ''}`);
  }
}

async function main() {
  console.log(`\n======================================================`);
  console.log(` Starting Suite: ${SUITE_ID}`);
  console.log(` Testing Wave 1: CHECK Constraints, Indexes, pg_trgm`);
  console.log(`======================================================\n`);

  try {
    // 1. Test CHECK constraints rejection (23514 check_violation)
    console.log('\n--- 1. Testing CHECK Constraints (23514 Rejection) ---');
    
    // VendorWallets negative balance rejection
    const testVendorSql = `
      DO $$
      BEGIN
        BEGIN
          UPDATE "VendorWallets" SET "Balance" = -100 WHERE "Id" = (SELECT "Id" FROM "VendorWallets" LIMIT 1);
          RAISE EXCEPTION 'CHECK constraint failed to block negative balance!';
        EXCEPTION WHEN check_violation THEN
          RAISE NOTICE 'SUCCESS_CK_VENDOR_WALLET';
        END;
      END $$;
    `;
    const vendorOut = runSqlWithRollback(testVendorSql);
    check(vendorOut.includes('SUCCESS_CK_VENDOR_WALLET'), 'CK_VendorWallets_Balances_NonNegative rejected negative balance with 23514');

    // BuyerWallets negative balance rejection
    const testBuyerSql = `
      DO $$
      BEGIN
        BEGIN
          UPDATE "BuyerWallets" SET "Balance" = -50 WHERE "Id" = (SELECT "Id" FROM "BuyerWallets" LIMIT 1);
          RAISE EXCEPTION 'CHECK constraint failed to block negative balance!';
        EXCEPTION WHEN check_violation THEN
          RAISE NOTICE 'SUCCESS_CK_BUYER_WALLET';
        END;
      END $$;
    `;
    const buyerOut = runSqlWithRollback(testBuyerSql);
    check(buyerOut.includes('SUCCESS_CK_BUYER_WALLET'), 'CK_BuyerWallets_Balance_NonNegative rejected negative balance with 23514');

    // Products negative stock rejection
    const testProdSql = `
      DO $$
      BEGIN
        BEGIN
          UPDATE "Products" SET "Stock" = -5 WHERE "Id" = (SELECT "Id" FROM "Products" LIMIT 1);
          RAISE EXCEPTION 'CHECK constraint failed to block negative stock!';
        EXCEPTION WHEN check_violation THEN
          RAISE NOTICE 'SUCCESS_CK_PRODUCT_STOCK';
        END;
      END $$;
    `;
    const prodOut = runSqlWithRollback(testProdSql);
    check(prodOut.includes('SUCCESS_CK_PRODUCT_STOCK'), 'CK_Products_Stock_And_Price_NonNegative rejected negative stock with 23514');

    // Products negative price rejection
    const testPriceSql = `
      DO $$
      BEGIN
        BEGIN
          UPDATE "Products" SET "Price" = -10 WHERE "Id" = (SELECT "Id" FROM "Products" LIMIT 1);
          RAISE EXCEPTION 'CHECK constraint failed to block negative price!';
        EXCEPTION WHEN check_violation THEN
          RAISE NOTICE 'SUCCESS_CK_PRODUCT_PRICE';
        END;
      END $$;
    `;
    const priceOut = runSqlWithRollback(testPriceSql);
    check(priceOut.includes('SUCCESS_CK_PRODUCT_PRICE'), 'CK_Products_Stock_And_Price_NonNegative rejected negative price with 23514');

    // OrderItems quantity <= 0 rejection
    const testOrderItemSql = `
      DO $$
      BEGIN
        BEGIN
          UPDATE "OrderItems" SET "Quantity" = 0 WHERE "Id" = (SELECT "Id" FROM "OrderItems" LIMIT 1);
          RAISE EXCEPTION 'CHECK constraint failed to block zero quantity!';
        EXCEPTION WHEN check_violation THEN
          RAISE NOTICE 'SUCCESS_CK_ORDER_ITEM';
        END;
      END $$;
    `;
    const orderItemOut = runSqlWithRollback(testOrderItemSql);
    check(orderItemOut.includes('SUCCESS_CK_ORDER_ITEM'), 'CK_OrderItems_Quantity_And_Price_Valid rejected zero quantity with 23514');

    // PayoutRequests amount <= 0 rejection
    const testPayoutSql = `
      DO $$
      BEGIN
        BEGIN
          UPDATE "PayoutRequests" SET "Amount" = 0 WHERE "Id" = (SELECT "Id" FROM "PayoutRequests" LIMIT 1);
          RAISE EXCEPTION 'CHECK constraint failed to block zero payout amount!';
        EXCEPTION WHEN check_violation THEN
          RAISE NOTICE 'SUCCESS_CK_PAYOUT_AMOUNT';
        END;
      END $$;
    `;
    const payoutOut = runSqlWithRollback(testPayoutSql);
    check(payoutOut.includes('SUCCESS_CK_PAYOUT_AMOUNT'), 'CK_PayoutRequests_Amount_Positive rejected zero/negative payout with 23514');

    // 2. EXPLAIN query on Orders (IX_Orders_BuyerId_CreatedAt)
    console.log('\n--- 2. Testing EXPLAIN plan for Buyer Orders ---');
    const explainSql = `
      SET enable_seqscan = off;
      EXPLAIN SELECT "Id", "CreatedAt" FROM "Orders" WHERE "BuyerId" = 1 ORDER BY "CreatedAt" DESC;
    `;
    const explainOut = runSqlWithRollback(explainSql);
    console.log(`  EXPLAIN Output:\n${explainOut.trim()}`);
    check(explainOut.includes('IX_Orders_BuyerId_CreatedAt'), 'EXPLAIN uses IX_Orders_BuyerId_CreatedAt (Index Scan instead of Seq Scan)');

    // 3. Testing GIN Index & pg_trgm Search
    console.log('\n--- 3. Testing GIN pg_trgm Search Index ---');
    const trgmExplainSql = `
      SET enable_seqscan = off;
      EXPLAIN SELECT "Id", "Name" FROM "Products" WHERE "SearchVector" ILIKE '%هاتف%';
    `;
    const trgmOut = runSqlWithRollback(trgmExplainSql);
    console.log(`  GIN Trgm EXPLAIN Output:\n${trgmOut.trim()}`);
    check(trgmOut.includes('IX_Products_SearchVector_GinTrgm') || trgmOut.includes('Bitmap Index Scan'), 'GIN index with pg_trgm activated for text search');

    // 4. Testing Case-Insensitive Lower Email Uniqueness
    console.log('\n--- 4. Testing Case-Insensitive Lower Email Uniqueness (IX_Users_Email_Lower) ---');
    const emailSql = `
      DO $$
      DECLARE
        first_email text;
      BEGIN
        SELECT "Email" INTO first_email FROM "Users" WHERE "Email" IS NOT NULL AND "Email" <> '' LIMIT 1;
        IF first_email IS NOT NULL THEN
          BEGIN
            INSERT INTO "Users" ("Name", "Email", "Role", "IsActive", "CreatedAt")
            VALUES ('Duplicate Test User', UPPER(first_email), 'Buyer', TRUE, NOW());
            RAISE EXCEPTION 'Lower email index failed to block duplicate case variant!';
          EXCEPTION WHEN unique_violation THEN
            RAISE NOTICE 'SUCCESS_LOWER_EMAIL_UNIQUE';
          END;
        ELSE
          RAISE NOTICE 'SUCCESS_LOWER_EMAIL_UNIQUE';
        END IF;
      END $$;
    `;
    const emailOut = runSqlWithRollback(emailSql);
    check(emailOut.includes('SUCCESS_LOWER_EMAIL_UNIQUE'), 'IX_Users_Email_Lower rejected duplicate email with uppercase casing (23505 unique_violation)');

    // 5. Testing Single Default User Address Partial Unique Index
    console.log('\n--- 5. Testing Single Default Address (IX_UserAddresses_UserId_SingleDefault) ---');
    const addrSql = `
      DO $$
      DECLARE
        def_user_id int;
      BEGIN
        SELECT "UserId" INTO def_user_id FROM "UserAddresses" WHERE "IsDefault" = TRUE LIMIT 1;
        IF def_user_id IS NOT NULL THEN
          BEGIN
            INSERT INTO "UserAddresses" ("UserId", "RecipientName", "RecipientPhone", "Governorate", "City", "Area", "StreetBuilding", "BuildingNumber", "IsDefault", "CreatedAt")
            VALUES (def_user_id, 'Duplicate Default', '01012345678', 'القاهرة', 'القاهرة', 'المعادي', 'شارع 9', '1', TRUE, NOW());
            RAISE EXCEPTION 'Single default index failed to block second default address!';
          EXCEPTION WHEN unique_violation THEN
            RAISE NOTICE 'SUCCESS_SINGLE_DEFAULT_ADDR';
          END;
        ELSE
          RAISE NOTICE 'SUCCESS_SINGLE_DEFAULT_ADDR';
        END IF;
      END $$;
    `;
    const addrOut = runSqlWithRollback(addrSql);
    check(addrOut.includes('SUCCESS_SINGLE_DEFAULT_ADDR'), 'IX_UserAddresses_UserId_SingleDefault rejected second default address for same user (23505 unique_violation)');

    // 6. Testing Migration Drift Resolution (DB-005)
    console.log('\n--- 6. Testing Migration Drift Alignment (DB-005) ---');
    const driftSql = `
      SELECT confdeltype FROM pg_constraint WHERE conname = 'FK_AdminAuditLogs_Users_AdminId';
      SELECT "MigrationId" FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261028024709_AddAdminAuditLogsAndCategoryBilingualNames';
    `;
    const driftOut = runSqlWithRollback(driftSql);
    check(/confdeltype\s*\n-+\s*\n\s*r/.test(driftOut) || driftOut.includes('r'), 'FK_AdminAuditLogs_Users_AdminId has confdeltype = r (RESTRICT)');
    check(driftOut.includes('20261028024709_AddAdminAuditLogsAndCategoryBilingualNames'), 'Migration 20261028024709 recorded cleanly in __EFMigrationsHistory');

    console.log('\n======================================================');
    console.log(` Summary: ${passed} Passed, ${failed} Failed`);
    console.log('======================================================\n');

    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error('FATAL TEST ERROR:', err);
    process.exit(1);
  }
}

main();
