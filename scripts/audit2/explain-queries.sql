-- ============================================================================
-- scripts/audit2/explain-queries.sql
-- Top 20 Application Query Patterns Inferred from Code
-- For Performance Analysis & EXPLAIN Review (Do NOT run on live production DB)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. User Authentication / Lookup by Email
-- Origin: AuthService.cs:LoginAsync / GetByEmailAsync
-- Index needed: Unique index on lower("Email")
-- Current: IX_Users_Email (btree ("Email") WHERE "Email" IS NOT NULL) - Case sensitive!
-- ----------------------------------------------------------------------------
EXPLAIN 
SELECT "Id", "Email", "PasswordHash", "Role", "IsActive", "TokenVersion"
FROM "Users"
WHERE "Email" = 'buyer@example.com'
LIMIT 1;

-- ----------------------------------------------------------------------------
-- 2. User Authentication / Lookup by Egyptian Phone
-- Origin: AuthService.cs:LoginWithPhoneAsync
-- Index needed: Unique index on "Phone" WHERE "Phone" IS NOT NULL
-- Current: IX_Users_Phone (btree ("Phone") WHERE "Phone" IS NOT NULL)
-- ----------------------------------------------------------------------------
EXPLAIN 
SELECT "Id", "Phone", "PasswordHash", "Role", "IsActive", "TokenVersion"
FROM "Users"
WHERE "Phone" = '+201012345678'
LIMIT 1;

-- ----------------------------------------------------------------------------
-- 3. Refresh Token Validation by TokenHash
-- Origin: AuthService.cs:RefreshTokenAsync
-- Index needed: IX_RefreshTokens_TokenHash
-- Current: IX_RefreshTokens_TokenHash (btree ("TokenHash") UNIQUE)
-- ----------------------------------------------------------------------------
EXPLAIN 
SELECT "Id", "UserId", "TokenHash", "ExpiresAt", "RevokedAt", "ReplacedByTokenId"
FROM "RefreshTokens"
WHERE "TokenHash" = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789'
LIMIT 1;

-- ----------------------------------------------------------------------------
-- 4. External OAuth Login Lookup (Google)
-- Origin: AuthService.cs:GoogleLoginAsync
-- Index needed: IX_ExternalLogins_Provider_Subject
-- Current: IX_ExternalLogins_Provider_Subject (btree ("Provider", "Subject") UNIQUE)
-- ----------------------------------------------------------------------------
EXPLAIN 
SELECT "Id", "UserId", "Provider", "Subject", "CreatedAt"
FROM "ExternalLogins"
WHERE "Provider" = 'Google' AND "Subject" = '109876543210987654321'
LIMIT 1;

-- ----------------------------------------------------------------------------
-- 5. Active Products Feed by Category with Pagination
-- Origin: ProductService.cs:GetProductsAsync
-- Index needed: Composite index on ("CategoryId", "IsDeleted", "CreatedAt" DESC)
-- Current: IX_Products_CategoryId only -> Causes Sort or Filter step
-- ----------------------------------------------------------------------------
EXPLAIN 
SELECT "Id", "Name", "Price", "Stock", "AverageRating", "CreatedAt"
FROM "Products"
WHERE "IsDeleted" = false AND "CategoryId" = 1
ORDER BY "CreatedAt" DESC
LIMIT 20 OFFSET 0;

-- ----------------------------------------------------------------------------
-- 6. Product Substring Search via SearchVector (FULL TABLE SCAN BUG)
-- Origin: SearchService.cs:SearchAsync
-- Index needed: GIN trigram index ("SearchVector" gin_trgm_ops) via pg_trgm
-- Current: B-tree IX_Products_SearchVector (Cannot support LIKE '%term%') -> Seq Scan!
-- ----------------------------------------------------------------------------
EXPLAIN 
SELECT "Id", "Name", "SearchVector", "Price", "Stock"
FROM "Products"
WHERE "IsDeleted" = false AND "SearchVector" LIKE '%سماعات%'
LIMIT 20;

-- ----------------------------------------------------------------------------
-- 7. Product Details with Category and Active Variants
-- Origin: ProductService.cs:GetProductByIdAsync
-- Index needed: PK_Products ("Id") and IX_ProductVariants_ProductId
-- Current: PK_Products and IX_ProductVariants_ProductId exist
-- ----------------------------------------------------------------------------
EXPLAIN 
SELECT p."Id", p."Name", p."Price", p."Stock", pv."Id" AS variant_id, pv."Sku", pv."PriceOverride"
FROM "Products" p
LEFT JOIN "ProductVariants" pv ON p."Id" = pv."ProductId"
WHERE p."Id" = 10 AND p."IsDeleted" = false;

-- ----------------------------------------------------------------------------
-- 8. Buyer Orders History with Pagination (CRITICAL MISSING INDEX BUG)
-- Origin: OrderService.cs:GetBuyerOrdersAsync
-- Index needed: Composite index on ("BuyerId", "CreatedAt" DESC)
-- Current: IX_Orders_BuyerId was DROPPED! Partial index on IdempotencyKey cannot be used!
-- Current behavior: FULL TABLE SCAN (Seq Scan on Orders) and in-memory Sort!
-- ----------------------------------------------------------------------------
EXPLAIN 
SELECT "Id", "TotalAmount", "Status", "DeliveryMethod", "CreatedAt"
FROM "Orders"
WHERE "BuyerId" = 100
ORDER BY "CreatedAt" DESC
LIMIT 20 OFFSET 0;

-- ----------------------------------------------------------------------------
-- 9. Order Idempotency Check
-- Origin: OrderService.cs:CreateOrderAsync
-- Index needed: Partial unique index ("BuyerId", "IdempotencyKey") WHERE "IdempotencyKey" IS NOT NULL
-- Current: IX_Orders_BuyerId_IdempotencyKey exists
-- ----------------------------------------------------------------------------
EXPLAIN 
SELECT "Id", "Status", "TotalAmount"
FROM "Orders"
WHERE "BuyerId" = 100 AND "IdempotencyKey" = 'req-uuid-12345-67890'
LIMIT 1;

-- ----------------------------------------------------------------------------
-- 10. Seller Shipments List Filtered by Status
-- Origin: ShipmentService.cs:GetSellerShipmentsAsync
-- Index needed: Composite index on ("SellerId", "Status", "CreatedAt" DESC)
-- Current: IX_Shipments_SellerId (non-composite) -> requires separate filter & sort
-- ----------------------------------------------------------------------------
EXPLAIN 
SELECT "Id", "OrderId", "Status", "DeliveryCost", "CodAmount", "CreatedAt"
FROM "Shipments"
WHERE "SellerId" = 50 AND "Status" = 'Delivered'
ORDER BY "CreatedAt" DESC
LIMIT 20;

-- ----------------------------------------------------------------------------
-- 11. Order Items by ShipmentId
-- Origin: OrderService.cs / ShipmentService.cs
-- Index needed: IX_OrderItems_ShipmentId
-- Current: IX_OrderItems_ShipmentId exists
-- ----------------------------------------------------------------------------
EXPLAIN 
SELECT "Id", "OrderId", "ProductId", "VariantId", "Quantity", "UnitPrice"
FROM "OrderItems"
WHERE "ShipmentId" = 200;

-- ----------------------------------------------------------------------------
-- 12. Approved Product Reviews Feed with Pagination
-- Origin: ReviewService.cs:GetProductReviewsAsync
-- Index needed: Composite index on ("ProductId", "IsHidden", "CreatedAt" DESC)
-- Current: Unique ("ProductId", "BuyerId") only -> Cannot satisfy ("IsHidden", "CreatedAt" DESC)
-- ----------------------------------------------------------------------------
EXPLAIN 
SELECT "Id", "BuyerId", "Rating", "Comment", "ImageUrls", "SellerReply", "CreatedAt"
FROM "Reviews"
WHERE "ProductId" = 10 AND "IsHidden" = false
ORDER BY "CreatedAt" DESC
LIMIT 20 OFFSET 0;

-- ----------------------------------------------------------------------------
-- 13. Buyer Review Existence Check for Specific Product
-- Origin: ReviewService.cs:CreateReviewAsync
-- Index needed: Unique index on ("ProductId", "BuyerId")
-- Current: IX_Reviews_ProductId_BuyerId exists
-- ----------------------------------------------------------------------------
EXPLAIN 
SELECT "Id", "Rating", "CreatedAt"
FROM "Reviews"
WHERE "ProductId" = 10 AND "BuyerId" = 100
LIMIT 1;

-- ----------------------------------------------------------------------------
-- 14. User Wishlist with Product Join
-- Origin: WishlistService.cs:GetWishlistAsync
-- Index needed: IX_WishlistItems_UserId_ProductId
-- Current: IX_WishlistItems_UserId_ProductId exists
-- ----------------------------------------------------------------------------
EXPLAIN 
SELECT w."Id", w."ProductId", p."Name", p."Price", p."Stock"
FROM "WishlistItems" w
JOIN "Products" p ON w."ProductId" = p."Id"
WHERE w."UserId" = 100 AND p."IsDeleted" = false
ORDER BY w."CreatedAt" DESC;

-- ----------------------------------------------------------------------------
-- 15. User Notifications (Unread First)
-- Origin: NotificationService.cs:GetUserNotificationsAsync
-- Index needed: ("UserId", "IsRead", "CreatedAt" DESC)
-- Current: IX_UserNotifications_UserId_IsRead_CreatedAt exists
-- ----------------------------------------------------------------------------
EXPLAIN 
SELECT "Id", "TitleAr", "BodyAr", "Type", "IsRead", "CreatedAt"
FROM "UserNotifications"
WHERE "UserId" = 100 AND "IsRead" = false
ORDER BY "CreatedAt" DESC
LIMIT 20 OFFSET 0;

-- ----------------------------------------------------------------------------
-- 16. Admin Audit Logs Filtered by EntityType and Date
-- Origin: AdminService.cs:GetAuditLogsAsync
-- Index needed: IX_AdminAuditLogs_EntityType_CreatedAt
-- Current: IX_AdminAuditLogs_EntityType_CreatedAt exists
-- ----------------------------------------------------------------------------
EXPLAIN 
SELECT "Id", "AdminId", "Action", "EntityType", "EntityId", "Details", "CreatedAt"
FROM "AdminAuditLogs"
WHERE "EntityType" = 'Order'
ORDER BY "CreatedAt" DESC
LIMIT 50 OFFSET 0;

-- ----------------------------------------------------------------------------
-- 17. Active Verification Code Lookup
-- Origin: VerificationService.cs:VerifyCodeAsync
-- Index needed: Composite index on ("Target", "Purpose", "ExpiresAt" DESC)
-- Current: IX_VerificationCodes_Target and IX_VerificationCodes_ExpiresAt separate
-- ----------------------------------------------------------------------------
EXPLAIN 
SELECT "Id", "CodeHash", "AttemptCount", "ExpiresAt", "ConsumedAt"
FROM "VerificationCodes"
WHERE "Target" = '+201012345678' AND "Purpose" = 'Login' AND "ExpiresAt" > NOW() AND "ConsumedAt" IS NULL
ORDER BY "ExpiresAt" DESC
LIMIT 1;

-- ----------------------------------------------------------------------------
-- 18. Seller Vendor Wallet Balance Check
-- Origin: WalletService.cs:GetSellerWalletAsync
-- Index needed: IX_VendorWallets_SellerId (Unique)
-- Current: IX_VendorWallets_SellerId exists
-- ----------------------------------------------------------------------------
EXPLAIN 
SELECT "Id", "SellerId", "Balance", "PendingBalance", "TotalEarned", "UpdatedAt"
FROM "VendorWallets"
WHERE "SellerId" = 50
LIMIT 1;

-- ----------------------------------------------------------------------------
-- 19. Vendor Wallet Transactions History
-- Origin: WalletService.cs:GetWalletTransactionsAsync
-- Index needed: Composite index on ("WalletId", "CreatedAt" DESC)
-- Current: IX_WalletTransactions_WalletId exists (lacks CreatedAt in key)
-- ----------------------------------------------------------------------------
EXPLAIN 
SELECT "Id", "Amount", "Type", "Description", "CreatedAt"
FROM "WalletTransactions"
WHERE "WalletId" = 10
ORDER BY "CreatedAt" DESC
LIMIT 50;

-- ----------------------------------------------------------------------------
-- 20. Active Coupon Validation by Code
-- Origin: CouponService.cs:ValidateCouponAsync
-- Index needed: IX_Coupons_Code (Unique)
-- Current: IX_Coupons_Code exists
-- ----------------------------------------------------------------------------
EXPLAIN 
SELECT "Id", "Code", "DiscountType", "DiscountValue", "MinOrderSubtotal", "ExpiresAt", "IsActive", "UsedCount", "MaxUsage"
FROM "Coupons"
WHERE "Code" = 'SUMMER2026' AND "IsActive" = true AND "ExpiresAt" > NOW()
LIMIT 1;
