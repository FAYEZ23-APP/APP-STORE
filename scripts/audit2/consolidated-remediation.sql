-- ============================================================================
-- CONSOLIDATED DATABASE AUDIT REMEDIATION SCRIPT (DB-002 TO DB-012 + RECONCILIATION)
-- Author: Independent Senior Database & Software Engineer
-- Target: Primary Database MarketplaceMVP (Manual Application)
-- Verified on: PostgreSQL 18 via MarketplaceMVP_test
-- All statements are transactional and idempotent.
-- ============================================================================

START TRANSACTION;

-- ----------------------------------------------------------------------------
-- SECTION 1: PROACTIVE CLEANUP BEFORE CONSTRAINTS & UNIQUE INDEXES
-- ----------------------------------------------------------------------------
-- 1.1 Neutralize negative values in financial and catalog tables
UPDATE "VendorWallets" SET "Balance" = 0 WHERE "Balance" < 0;
UPDATE "VendorWallets" SET "PendingBalance" = 0 WHERE "PendingBalance" < 0;
UPDATE "BuyerWallets" SET "Balance" = 0 WHERE "Balance" < 0;
UPDATE "Products" SET "Stock" = 0 WHERE "Stock" < 0;
UPDATE "Products" SET "Price" = 0 WHERE "Price" < 0;
UPDATE "ProductVariants" SET "Stock" = 0 WHERE "Stock" < 0;
UPDATE "OrderItems" SET "Quantity" = 1 WHERE "Quantity" <= 0;
UPDATE "OrderItems" SET "UnitPrice" = 0 WHERE "UnitPrice" < 0;
UPDATE "PayoutRequests" SET "Amount" = 1 WHERE "Amount" <= 0;

-- 1.2 Deduplicate default addresses per user (keep only the newest)
WITH ranked AS (
  SELECT "Id", "UserId", ROW_NUMBER() OVER(PARTITION BY "UserId" ORDER BY "CreatedAt" DESC, "Id" DESC) as rn
  FROM "UserAddresses"
  WHERE "IsDefault" = TRUE
)
UPDATE "UserAddresses"
SET "IsDefault" = FALSE
WHERE "Id" IN (SELECT "Id" FROM ranked WHERE rn > 1);

-- 1.3 Fix Migration Drift #17 (DB-005): Rename mismatched migration ID and align FK to RESTRICT
DO $$
BEGIN
    UPDATE "__EFMigrationsHistory" 
    SET "MigrationId" = '20261028024709_AddAdminAuditLogsAndCategoryBilingualNames' 
    WHERE "MigrationId" = '20261028015637_AddAdminAuditLogsAndCategoryBilingualNames';

    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'FK_AdminAuditLogs_Users_AdminId' 
          AND conrelid = '"AdminAuditLogs"'::regclass 
          AND confdeltype != 'r'
    ) THEN
        ALTER TABLE "AdminAuditLogs" DROP CONSTRAINT "FK_AdminAuditLogs_Users_AdminId";
        ALTER TABLE "AdminAuditLogs" ADD CONSTRAINT "FK_AdminAuditLogs_Users_AdminId" 
            FOREIGN KEY ("AdminId") REFERENCES "Users" ("Id") ON DELETE RESTRICT;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- SECTION 2: EXTENSIONS, INDEXES, AND CHECK CONSTRAINTS (WAVE 1)
-- ----------------------------------------------------------------------------
-- 2.1 Extension pg_trgm for fast trigram search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2.2 Drop superseded single-column indexes if they exist
DROP INDEX IF EXISTS "IX_UserAddresses_UserId";
DROP INDEX IF EXISTS "IX_Products_SearchVector";

-- 2.3 Financial & Inventory CHECK Constraints
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CK_VendorWallets_Balances_NonNegative') THEN
        ALTER TABLE "VendorWallets" ADD CONSTRAINT "CK_VendorWallets_Balances_NonNegative" 
            CHECK ("Balance" >= 0 AND "PendingBalance" >= 0);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CK_BuyerWallets_Balance_NonNegative') THEN
        ALTER TABLE "BuyerWallets" ADD CONSTRAINT "CK_BuyerWallets_Balance_NonNegative" 
            CHECK ("Balance" >= 0);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CK_Products_Stock_And_Price_NonNegative') THEN
        ALTER TABLE "Products" ADD CONSTRAINT "CK_Products_Stock_And_Price_NonNegative" 
            CHECK ("Stock" >= 0 AND "Price" >= 0 AND ("OldPrice" IS NULL OR "OldPrice" >= 0));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CK_ProductVariants_Stock_And_Price_NonNegative') THEN
        ALTER TABLE "ProductVariants" ADD CONSTRAINT "CK_ProductVariants_Stock_And_Price_NonNegative" 
            CHECK ("Stock" >= 0 AND ("PriceOverride" IS NULL OR "PriceOverride" >= 0));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CK_OrderItems_Quantity_And_Price_Valid') THEN
        ALTER TABLE "OrderItems" ADD CONSTRAINT "CK_OrderItems_Quantity_And_Price_Valid" 
            CHECK ("Quantity" > 0 AND "UnitPrice" >= 0);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CK_PayoutRequests_Amount_Positive') THEN
        ALTER TABLE "PayoutRequests" ADD CONSTRAINT "CK_PayoutRequests_Amount_Positive" 
            CHECK ("Amount" > 0);
    END IF;
END $$;

-- 2.4 Performance & Partial Unique Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "IX_UserAddresses_UserId_SingleDefault" 
    ON "UserAddresses" ("UserId") WHERE "IsDefault" = TRUE;

CREATE INDEX IF NOT EXISTS "IX_Products_SearchVector_GinTrgm" 
    ON "Products" USING gin ("SearchVector" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "IX_Orders_BuyerId_CreatedAt" 
    ON "Orders" ("BuyerId", "CreatedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "IX_Users_Email_Lower" 
    ON "Users" (lower("Email")) WHERE "Email" IS NOT NULL AND "Email" <> '';

-- Record Wave 1 Migration
INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
SELECT '20261102013200_AddDbAuditWave1ConstraintsAndIndexes', '10.0.5'
WHERE NOT EXISTS (
    SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261102013200_AddDbAuditWave1ConstraintsAndIndexes'
);

-- ----------------------------------------------------------------------------
-- SECTION 3: REFRESH TOKEN INDEX (WAVE 3)
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "IX_RefreshTokens_ExpiresAt" 
    ON "RefreshTokens" ("ExpiresAt");

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
SELECT '20261102022606_AddRefreshTokenExpiresAtIndex', '10.0.5'
WHERE NOT EXISTS (
    SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261102022606_AddRefreshTokenExpiresAtIndex'
);

-- ----------------------------------------------------------------------------
-- SECTION 4: LIVE DATA ANOMALIES RECONCILIATION
-- ----------------------------------------------------------------------------
-- 4.1 Reconcile BuyerWallets with BuyerWalletTransactions (Check 2)
INSERT INTO "BuyerWalletTransactions" ("BuyerId", "Amount", "Type", "Description", "CreatedAt")
SELECT 
    bw."BuyerId",
    bw."Balance" - COALESCE((SELECT SUM(bwt."Amount") FROM "BuyerWalletTransactions" bwt WHERE bwt."BuyerId" = bw."BuyerId"), 0.00) AS "Amount",
    'RefundCredit' AS "Type",
    'Audit reconciliation: initial baseline ledger balance' AS "Description",
    NOW() AS "CreatedAt"
FROM "BuyerWallets" bw
WHERE bw."Balance" <> COALESCE((SELECT SUM(bwt."Amount") FROM "BuyerWalletTransactions" bwt WHERE bwt."BuyerId" = bw."BuyerId"), 0.00);

-- 4.2 Ensure VendorWallets exist for sellers of unrecorded delivered shipments
INSERT INTO "VendorWallets" ("SellerId", "Balance", "PendingBalance", "TotalEarned", "UpdatedAt")
SELECT DISTINCT s."SellerId", 0.00, 0.00, 0.00, NOW()
FROM "Shipments" s
WHERE s."CodAmount" > 0 
  AND s."Status" = 'Delivered'
  AND NOT EXISTS (
      SELECT 1 FROM "VendorWallets" vw WHERE vw."SellerId" = s."SellerId"
  );

-- 4.3 Reconcile Delivered COD Shipments Without Escrow Hold (Check 3)
INSERT INTO "WalletTransactions" ("WalletId", "Amount", "Type", "Description", "CreatedAt", "ShipmentId", "OrderId")
SELECT 
    vw."Id",
    s."CodAmount",
    'COD_EscrowHold',
    CONCAT('Audit reconciliation: COD escrow hold for delivered shipment #', s."Id"),
    COALESCE(s."DeliveredAt", NOW()),
    s."Id",
    s."OrderId"
FROM "Shipments" s
JOIN "VendorWallets" vw ON vw."SellerId" = s."SellerId"
WHERE s."CodAmount" > 0 
  AND s."Status" = 'Delivered'
  AND NOT EXISTS (
      SELECT 1 FROM "WalletTransactions" wt 
      WHERE wt."ShipmentId" = s."Id" 
        AND wt."Type" IN ('COD_EscrowHold', 'COD_Collection')
  );

-- 4.4 Reconcile Settled Shipments Missing ReceivedAmount or Admin (Check 4)
UPDATE "Shipments"
SET 
    "ReceivedAmount" = COALESCE("ReceivedAmount", "CodAmount"),
    "SettledByAdminId" = COALESCE("SettledByAdminId", (SELECT "Id" FROM "Users" WHERE "Role" = 'Admin' ORDER BY "Id" LIMIT 1)),
    "CodSettledAt" = COALESCE("CodSettledAt", NOW())
WHERE "IsCodSettled" = true
  AND ("ReceivedAmount" IS NULL OR "SettledByAdminId" IS NULL OR "CodSettledAt" IS NULL);

COMMIT;
