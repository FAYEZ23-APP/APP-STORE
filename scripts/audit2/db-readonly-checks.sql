-- ============================================================================
-- scripts/audit2/db-readonly-checks.sql
-- Independent Database Audit Integrity Checks (READ-ONLY)
-- Designed to be run safely against MarketplaceMVP or MarketplaceMVP_test
-- ============================================================================

BEGIN TRANSACTION READ ONLY;

\echo '========================================================================'
\echo 'CHECK 1: Negative Balances in VendorWallets or BuyerWallets'
\echo 'Expected: 0 rows'
\echo '========================================================================'
SELECT 'VendorWallets' AS table_name, "Id", "SellerId" AS user_id, "Balance", "PendingBalance", "TotalEarned"
FROM "VendorWallets"
WHERE "Balance" < 0 OR "PendingBalance" < 0 OR "TotalEarned" < 0
UNION ALL
SELECT 'BuyerWallets' AS table_name, "Id", "BuyerId" AS user_id, "Balance", 0.00 AS "PendingBalance", 0.00 AS "TotalEarned"
FROM "BuyerWallets"
WHERE "Balance" < 0;

\echo '========================================================================'
\echo 'CHECK 2: Ledger Sums Discrepancy with BuyerWallets.Balance'
\echo 'Expected: 0 rows (ledger sum should equal balance)'
\echo '========================================================================'
SELECT 
    bw."Id" AS wallet_id,
    bw."BuyerId",
    bw."Balance" AS recorded_balance,
    COALESCE(SUM(bwt."Amount"), 0.00) AS calculated_balance,
    bw."Balance" - COALESCE(SUM(bwt."Amount"), 0.00) AS discrepancy
FROM "BuyerWallets" bw
LEFT JOIN "BuyerWalletTransactions" bwt ON bw."BuyerId" = bwt."BuyerId"
GROUP BY bw."Id", bw."BuyerId", bw."Balance"
HAVING bw."Balance" <> COALESCE(SUM(bwt."Amount"), 0.00);

\echo '========================================================================'
\echo 'CHECK 3: COD Delivered Shipments Without Escrow Hold Rows'
\echo 'Expected: 0 rows'
\echo '========================================================================'
SELECT 
    s."Id" AS shipment_id,
    s."OrderId",
    s."SellerId",
    s."CodAmount",
    s."Status",
    s."DeliveredAt",
    s."IsCodSettled"
FROM "Shipments" s
WHERE s."CodAmount" > 0 
  AND s."Status" = 'Delivered'
  AND NOT EXISTS (
      SELECT 1 FROM "WalletTransactions" wt 
      WHERE wt."ShipmentId" = s."Id" 
        AND wt."Type" IN ('COD_EscrowHold', 'COD_Collection')
  );

\echo '========================================================================'
\echo 'CHECK 4: Shipments Settled Without Hold or With Discrepant Amounts'
\echo 'Expected: 0 rows'
\echo '========================================================================'
SELECT 
    s."Id" AS shipment_id,
    s."OrderId",
    s."SellerId",
    s."CodAmount",
    s."ReceivedAmount",
    s."IsCodSettled",
    s."CodSettledAt",
    s."SettledByAdminId"
FROM "Shipments" s
WHERE s."IsCodSettled" = true
  AND (
      s."CodSettledAt" IS NULL 
      OR s."ReceivedAmount" IS NULL 
      OR s."ReceivedAmount" < 0
      OR s."Status" <> 'Delivered'
  );

\echo '========================================================================'
\echo 'CHECK 5: Payout Requests Greater Than Historical Total Earnings'
\echo 'Expected: 0 rows'
\echo '========================================================================'
SELECT 
    p."Id" AS payout_id,
    p."SellerId",
    p."Amount" AS requested_payout,
    p."Status",
    vw."Balance" AS current_balance,
    vw."TotalEarned" AS historical_total_earned
FROM "PayoutRequests" p
JOIN "VendorWallets" vw ON p."SellerId" = vw."SellerId"
WHERE p."Amount" > vw."TotalEarned";

\echo '========================================================================'
\echo 'CHECK 6: Order TotalAmount Mismatch (TotalAmount != Items Subtotal + Delivery - Discount)'
\echo 'Expected: 0 rows'
\echo '========================================================================'
WITH OrderCalculations AS (
    SELECT 
        o."Id" AS order_id,
        o."TotalAmount" AS order_total,
        o."DiscountAmount" AS discount,
        COALESCE(SUM(oi."UnitPrice" * oi."Quantity"), 0.00) AS items_subtotal,
        COALESCE((SELECT SUM(s."DeliveryCost") FROM "Shipments" s WHERE s."OrderId" = o."Id"), 0.00) AS delivery_cost
    FROM "Orders" o
    LEFT JOIN "OrderItems" oi ON o."Id" = oi."OrderId"
    GROUP BY o."Id", o."TotalAmount", o."DiscountAmount"
)
SELECT 
    order_id,
    order_total,
    items_subtotal,
    delivery_cost,
    discount,
    (items_subtotal + delivery_cost - discount) AS expected_total,
    order_total - (items_subtotal + delivery_cost - discount) AS discrepancy
FROM OrderCalculations
WHERE order_total <> (items_subtotal + delivery_cost - discount);

\echo '========================================================================'
\echo 'CHECK 7: Negative Product or ProductVariant Stock'
\echo 'Expected: 0 rows'
\echo '========================================================================'
SELECT 'Product' AS entity_type, "Id", "Name", "Stock"
FROM "Products"
WHERE "Stock" < 0
UNION ALL
SELECT 'ProductVariant' AS entity_type, pv."Id", p."Name" || ' / ' || COALESCE(pv."Sku", 'no-sku') AS "Name", pv."Stock"
FROM "ProductVariants" pv
JOIN "Products" p ON pv."ProductId" = p."Id"
WHERE pv."Stock" < 0;

\echo '========================================================================'
\echo 'CHECK 8: Duplicate Default User Addresses (Users with > 1 Default Address)'
\echo 'Expected: 0 rows'
\echo '========================================================================'
SELECT "UserId", COUNT(*) AS default_address_count
FROM "UserAddresses"
WHERE "IsDefault" = true
GROUP BY "UserId"
HAVING COUNT(*) > 1;

\echo '========================================================================'
\echo 'CHECK 9: Duplicate Reviews for the Same Buyer and Product'
\echo 'Expected: 0 rows'
\echo '========================================================================'
SELECT "ProductId", "BuyerId", COUNT(*) AS review_count
FROM "Reviews"
GROUP BY "ProductId", "BuyerId"
HAVING COUNT(*) > 1;

\echo '========================================================================'
\echo 'CHECK 10: Orphaned OrderItems, Addresses, or Shipments'
\echo 'Expected: 0 rows'
\echo '========================================================================'
SELECT 'OrderItem_Without_Order' AS issue, oi."Id", oi."OrderId"
FROM "OrderItems" oi
LEFT JOIN "Orders" o ON oi."OrderId" = o."Id"
WHERE o."Id" IS NULL
UNION ALL
SELECT 'OrderItem_Without_Product' AS issue, oi."Id", oi."ProductId"
FROM "OrderItems" oi
LEFT JOIN "Products" p ON oi."ProductId" = p."Id"
WHERE p."Id" IS NULL
UNION ALL
SELECT 'Shipment_Without_Order' AS issue, s."Id", s."OrderId"
FROM "Shipments" s
LEFT JOIN "Orders" o ON s."OrderId" = o."Id"
WHERE o."Id" IS NULL
UNION ALL
SELECT 'Address_Without_User' AS issue, ua."Id", ua."UserId"
FROM "UserAddresses" ua
LEFT JOIN "Users" u ON ua."UserId" = u."Id"
WHERE u."Id" IS NULL;

ROLLBACK;
