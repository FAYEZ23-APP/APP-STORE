const fs = require('fs');

const fullMigrations = fs.readFileSync('scripts/audit2/full-idempotent-migrations.sql', 'utf8');

const reconciliationSql = `
-- ============================================================================
-- SECTION: LIVE DATA ANOMALIES RECONCILIATION
-- ============================================================================
START TRANSACTION;

-- Reconcile BuyerWallets with BuyerWalletTransactions (Check 2)
INSERT INTO "BuyerWalletTransactions" ("BuyerId", "Amount", "Type", "Description", "CreatedAt")
SELECT 
    bw."BuyerId",
    bw."Balance" - COALESCE((SELECT SUM(bwt."Amount") FROM "BuyerWalletTransactions" bwt WHERE bwt."BuyerId" = bw."BuyerId"), 0.00) AS "Amount",
    'RefundCredit' AS "Type",
    'Audit reconciliation: initial baseline ledger balance' AS "Description",
    NOW() AS "CreatedAt"
FROM "BuyerWallets" bw
WHERE bw."Balance" <> COALESCE((SELECT SUM(bwt."Amount") FROM "BuyerWalletTransactions" bwt WHERE bwt."BuyerId" = bw."BuyerId"), 0.00);

-- Ensure VendorWallets exist for sellers of unrecorded delivered shipments
INSERT INTO "VendorWallets" ("SellerId", "Balance", "PendingBalance", "TotalEarned", "UpdatedAt")
SELECT DISTINCT s."SellerId", 0.00, 0.00, 0.00, NOW()
FROM "Shipments" s
WHERE s."CodAmount" > 0 
  AND s."Status" = 'Delivered'
  AND NOT EXISTS (
      SELECT 1 FROM "VendorWallets" vw WHERE vw."SellerId" = s."SellerId"
  );

-- Reconcile Delivered COD Shipments Without Escrow Hold (Check 3)
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

-- Reconcile Settled Shipments Missing ReceivedAmount or Admin (Check 4)
UPDATE "Shipments"
SET 
    "ReceivedAmount" = COALESCE("ReceivedAmount", "CodAmount"),
    "SettledByAdminId" = COALESCE("SettledByAdminId", (SELECT "Id" FROM "Users" WHERE "Role" = 'Admin' ORDER BY "Id" LIMIT 1)),
    "CodSettledAt" = COALESCE("CodSettledAt", NOW())
WHERE "IsCodSettled" = true
  AND ("ReceivedAmount" IS NULL OR "SettledByAdminId" IS NULL OR "CodSettledAt" IS NULL);

COMMIT;
`;

const combined = fullMigrations + '\n' + reconciliationSql;
fs.writeFileSync('scripts/audit2/MarketplaceMVP-Complete-Upgrade.sql', combined, 'utf8');
console.log('Successfully created MarketplaceMVP-Complete-Upgrade.sql (Bytes: ' + combined.length + ')');
