-- ============================================================================
-- scripts/audit2/seed-volume.sql
-- Synthetic Seed Script for THROWAWAY Performance Testing Database ONLY
-- DO NOT RUN AGAINST PRODUCTION, STAGING, OR TEST_DB!
-- ============================================================================

DO $$
BEGIN
    IF current_database() NOT LIKE '%_throwaway%' AND current_database() NOT LIKE '%_perf%' THEN
        RAISE EXCEPTION 'SAFETY GUARD: Current database (%) is not a throwaway/perf database!', current_database();
    END IF;
END $$;

\echo 'Starting Synthetic High-Volume Seeding for Performance Benchmarking...'

-- 1. Seed Categories (if not existing)
INSERT INTO "Categories" ("Id", "Key", "IconName", "NameAr", "NameEn", "IsActive", "DisplayOrder")
VALUES 
    (1, 'electronics', 'devices', 'إلكترونيات', 'Electronics', true, 1),
    (2, 'clothing', 'shirt', 'ملابس وأزياء', 'Clothing & Fashion', true, 2),
    (3, 'shoes', 'shoe-sneaker', 'أحذية', 'Shoes', true, 3),
    (4, 'home', 'home', 'المنزل والمطبخ', 'Home & Kitchen', true, 4),
    (5, 'beauty', 'sparkles', 'الصحة والجمال', 'Health & Beauty', true, 5)
ON CONFLICT ("Key") DO NOTHING;

-- 2. Seed 10,000 Users (8,000 Buyers, 1,950 Sellers, 50 Admins)
INSERT INTO "Users" ("Name", "Email", "Phone", "Role", "IsActive", "TokenVersion", "CreatedAt")
SELECT 
    'User ' || i,
    'user_' || i || '@test-perf-bench.local',
    '+2010' || LPAD(i::text, 8, '0'),
    CASE 
        WHEN i <= 50 THEN 'Admin'
        WHEN i <= 2000 THEN 'Seller'
        ELSE 'Buyer'
    END,
    true,
    0,
    NOW() - (i || ' minutes')::interval
FROM generate_series(1, 10000) AS i;

-- 3. Seed Seller Profiles for Sellers (Users 51 to 2000)
INSERT INTO "SellerProfiles" ("UserId", "DispatchCity", "DispatchAddress", "ContactPhone")
SELECT 
    i,
    CASE (i % 4)
        WHEN 0 THEN 'القاهرة'
        WHEN 1 THEN 'الجيزة'
        WHEN 2 THEN 'الإسكندرية'
        ELSE 'المنصورة'
    END,
    'Warehouse Street #' || i,
    '+2010' || LPAD(i::text, 8, '0')
FROM generate_series(51, 2000) AS i;

-- 4. Seed Wallets for Sellers and Buyers
INSERT INTO "VendorWallets" ("SellerId", "Balance", "PendingBalance", "TotalEarned", "UpdatedAt")
SELECT 
    i,
    ROUND((RANDOM() * 5000)::numeric, 2),
    ROUND((RANDOM() * 1000)::numeric, 2),
    ROUND((RANDOM() * 20000)::numeric, 2),
    NOW()
FROM generate_series(51, 2000) AS i;

INSERT INTO "BuyerWallets" ("BuyerId", "Balance", "UpdatedAt")
SELECT 
    i,
    ROUND((RANDOM() * 500)::numeric, 2),
    NOW()
FROM generate_series(2001, 10000) AS i;

-- 5. Seed 50,000 Products
INSERT INTO "Products" (
    "SellerId", "CategoryId", "Name", "NameAr", "NameEn", "Description", 
    "SearchVector", "Price", "OldPrice", "Stock", "WeightGrams", "AverageRating", 
    "ReviewsCount", "IsDeleted", "ImageUrls", "CreatedAt"
)
SELECT 
    51 + (i % 1950), -- SellerId between 51 and 2000
    1 + (i % 5),     -- CategoryId between 1 and 5
    'Product Title ' || i,
    'منتج رقم ' || i,
    'Product item #' || i,
    'Detailed product description for performance benchmark testing of item ' || i,
    'منتج رقم ' || i || ' product item ' || i || ' ماركة إلكترونيات وأجهزة',
    ROUND((50 + (RANDOM() * 2000))::numeric, 2),
    ROUND((100 + (RANDOM() * 2500))::numeric, 2),
    (i % 100),
    500,
    ROUND((3.0 + (RANDOM() * 2.0))::numeric, 2),
    (i % 50),
    (i % 20 = 0), -- 5% soft deleted
    '["https://cdn.example.com/products/img_' || i || '.jpg"]',
    NOW() - (i || ' minutes')::interval
FROM generate_series(1, 50000) AS i;

-- 6. Seed 20,000 ProductVariants
INSERT INTO "ProductVariants" ("ProductId", "Sku", "Size", "Color", "Stock", "PriceOverride")
SELECT 
    1 + (i % 50000),
    'SKU-PV-' || i,
    CASE (i % 3) WHEN 0 THEN 'S' WHEN 1 THEN 'M' ELSE 'L' END,
    CASE (i % 3) WHEN 0 THEN 'Black' WHEN 1 THEN 'White' ELSE 'Blue' END,
    (i % 30),
    NULL
FROM generate_series(1, 20000) AS i;

-- 7. Seed 100,000 Orders
INSERT INTO "Orders" (
    "BuyerId", "TotalAmount", "DiscountAmount", "WalletAmountUsed", "Status", 
    "DeliveryMethod", "PaymentMethod", "RecipientName", "RecipientPhone", 
    "Governorate", "City", "Area", "StreetBuilding", "CreatedAt", "IdempotencyKey"
)
SELECT 
    2001 + (i % 8000), -- BuyerId
    ROUND((100 + (RANDOM() * 3000))::numeric, 2),
    0.00,
    0.00,
    CASE (i % 4)
        WHEN 0 THEN 'Pending'
        WHEN 1 THEN 'Shipped'
        WHEN 2 THEN 'Delivered'
        ELSE 'Cancelled'
    END,
    'CourierHome',
    'OnReceipt',
    'Buyer Name ' || (2001 + (i % 8000)),
    '+2010' || LPAD(i::text, 8, '0'),
    'القاهرة',
    'مدينة نصر',
    'الحي السابع',
    'Building 12, Street 4',
    NOW() - (i || ' minutes')::interval,
    'seed-idem-' || i
FROM generate_series(1, 100000) AS i;

-- 8. Seed 100,000 Shipments
INSERT INTO "Shipments" (
    "OrderId", "SellerId", "Status", "TrackingNumber", "DeliveryCost", 
    "CodAmount", "EtaMinDays", "EtaMaxDays", "CreatedAt", "DeliveredAt", "IsCodSettled"
)
SELECT 
    i,
    51 + (i % 1950),
    CASE (i % 4)
        WHEN 0 THEN 'Created'
        WHEN 1 THEN 'InTransit'
        WHEN 2 THEN 'Delivered'
        ELSE 'Cancelled'
    END,
    'TRK-EGY-' || LPAD(i::text, 10, '0'),
    45.00,
    ROUND((100 + (RANDOM() * 3000))::numeric, 2),
    2,
    5,
    NOW() - (i || ' minutes')::interval,
    CASE WHEN (i % 4 = 2) THEN NOW() - (i || ' minutes')::interval ELSE NULL END,
    (i % 8 = 0)
FROM generate_series(1, 100000) AS i;

-- 9. Seed 200,000 OrderItems
INSERT INTO "OrderItems" ("OrderId", "ShipmentId", "ProductId", "Quantity", "UnitPrice")
SELECT 
    1 + (i % 100000),
    1 + (i % 100000),
    1 + (i % 50000),
    1 + (i % 3),
    ROUND((50 + (RANDOM() * 1000))::numeric, 2)
FROM generate_series(1, 200000) AS i;

-- 10. Seed 50,000 Reviews
INSERT INTO "Reviews" ("ProductId", "BuyerId", "Rating", "Comment", "ImageUrls", "IsHidden", "CreatedAt")
SELECT 
    1 + (i % 50000),
    2001 + (i % 8000),
    1 + (i % 5),
    'Review feedback comment #' || i || ' ممتاز وسريع التوصيل',
    '[]',
    false,
    NOW() - (i || ' minutes')::interval
FROM generate_series(1, 50000) AS i
ON CONFLICT ("ProductId", "BuyerId") DO NOTHING;

-- 11. Seed 150,000 WalletTransactions
INSERT INTO "WalletTransactions" ("WalletId", "OrderId", "ShipmentId", "Amount", "Type", "Description", "CreatedAt")
SELECT 
    1 + (i % 1950),
    1 + (i % 100000),
    1 + (i % 100000),
    ROUND((50 + (RANDOM() * 500))::numeric, 2),
    CASE (i % 4)
        WHEN 0 THEN 'COD_EscrowHold'
        WHEN 1 THEN 'OrderSettlement'
        WHEN 2 THEN 'Commission'
        ELSE 'Payout'
    END,
    'Performance simulation transaction #' || i,
    NOW() - (i || ' minutes')::interval
FROM generate_series(1, 150000) AS i;

\echo 'Synthetic Seeding Completed Successfully.'
