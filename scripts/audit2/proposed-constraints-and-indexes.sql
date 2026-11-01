-- ============================================================================
-- scripts/audit2/proposed-constraints-and-indexes.sql
-- Proposed Database Constraints, Indexes, and Integrity Rules
-- DO NOT EXECUTE DIRECTLY - Review and apply manually via migrations
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. BUSINESS INVARIANT CHECK CONSTRAINTS (NOT NULL, >= 0, Ranges)
-- ----------------------------------------------------------------------------

-- Prevent negative stock in Products
ALTER TABLE "Products" 
    ADD CONSTRAINT "CK_Products_Stock_NonNegative" CHECK ("Stock" >= 0);

-- Prevent negative stock in ProductVariants
ALTER TABLE "ProductVariants" 
    ADD CONSTRAINT "CK_ProductVariants_Stock_NonNegative" CHECK ("Stock" >= 0);

-- Prevent negative balances in VendorWallets
ALTER TABLE "VendorWallets" 
    ADD CONSTRAINT "CK_VendorWallets_Balance_NonNegative" CHECK ("Balance" >= 0),
    ADD CONSTRAINT "CK_VendorWallets_PendingBalance_NonNegative" CHECK ("PendingBalance" >= 0),
    ADD CONSTRAINT "CK_VendorWallets_TotalEarned_NonNegative" CHECK ("TotalEarned" >= 0);

-- Prevent negative balance in BuyerWallets
ALTER TABLE "BuyerWallets" 
    ADD CONSTRAINT "CK_BuyerWallets_Balance_NonNegative" CHECK ("Balance" >= 0);

-- Ensure ratings stay strictly within 0.00 to 5.00
ALTER TABLE "Products" 
    ADD CONSTRAINT "CK_Products_AverageRating_Range" CHECK ("AverageRating" >= 0.00 AND "AverageRating" <= 5.00);

ALTER TABLE "Reviews" 
    ADD CONSTRAINT "CK_Reviews_Rating_Range" CHECK ("Rating" >= 1 AND "Rating" <= 5);

-- Ensure Money columns are not negative
ALTER TABLE "Products" 
    ADD CONSTRAINT "CK_Products_Price_Positive" CHECK ("Price" >= 0);

ALTER TABLE "OrderItems" 
    ADD CONSTRAINT "CK_OrderItems_Quantity_Positive" CHECK ("Quantity" > 0),
    ADD CONSTRAINT "CK_OrderItems_UnitPrice_NonNegative" CHECK ("UnitPrice" >= 0);

ALTER TABLE "Shipments" 
    ADD CONSTRAINT "CK_Shipments_DeliveryCost_NonNegative" CHECK ("DeliveryCost" >= 0),
    ADD CONSTRAINT "CK_Shipments_CodAmount_NonNegative" CHECK ("CodAmount" >= 0);

-- ----------------------------------------------------------------------------
-- 2. PARTIAL UNIQUE INDEXES & DATA INTEGRITY
-- ----------------------------------------------------------------------------

-- Enforce exactly at most ONE default address per user
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "IX_UserAddresses_UserId_SingleDefault"
    ON "UserAddresses" ("UserId") 
    WHERE "IsDefault" = true;

-- Enforce Case-Insensitive Uniqueness for User Email
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "IX_Users_Email_CaseInsensitive"
    ON "Users" (lower("Email")) 
    WHERE "Email" IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 3. CRITICAL QUERY PERFORMANCE INDEXES
-- ----------------------------------------------------------------------------

-- Restore dropped Orders BuyerId index with CreatedAt for fast buyer order feeds
CREATE INDEX CONCURRENTLY IF NOT EXISTS "IX_Orders_BuyerId_CreatedAt"
    ON "Orders" ("BuyerId", "CreatedAt" DESC);

-- Enable pg_trgm for fast text search on SearchVector (fixes Seq Scan on LIKE '%x%')
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "IX_Products_SearchVector_trgm"
    ON "Products" USING gin ("SearchVector" gin_trgm_ops);

-- Category product feed with pagination
CREATE INDEX CONCURRENTLY IF NOT EXISTS "IX_Products_CategoryId_IsDeleted_CreatedAt"
    ON "Products" ("CategoryId", "IsDeleted", "CreatedAt" DESC);

-- Seller shipments filtering by status
CREATE INDEX CONCURRENTLY IF NOT EXISTS "IX_Shipments_SellerId_Status_CreatedAt"
    ON "Shipments" ("SellerId", "Status", "CreatedAt" DESC);

-- Product reviews visible feed
CREATE INDEX CONCURRENTLY IF NOT EXISTS "IX_Reviews_ProductId_IsHidden_CreatedAt"
    ON "Reviews" ("ProductId", "IsHidden", "CreatedAt" DESC);

-- Wallet transactions history for seller
CREATE INDEX CONCURRENTLY IF NOT EXISTS "IX_WalletTransactions_WalletId_CreatedAt"
    ON "WalletTransactions" ("WalletId", "CreatedAt" DESC);

-- Verification codes active lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS "IX_VerificationCodes_Target_Purpose_ExpiresAt"
    ON "VerificationCodes" ("Target", "Purpose", "ExpiresAt" DESC)
    WHERE "ConsumedAt" IS NULL;
