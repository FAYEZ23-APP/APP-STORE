-- 1. Check constraints verification
SELECT conrelid::regclass as "table", conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conname LIKE 'CK_%'
ORDER BY conname;

-- 2. Indexes verification
SELECT tablename, indexname, indexdef 
FROM pg_indexes 
WHERE indexname IN (
    'IX_Orders_BuyerId_CreatedAt',
    'IX_Products_SearchVector_GinTrgm',
    'IX_Users_Email_Lower',
    'IX_UserAddresses_UserId_SingleDefault'
)
ORDER BY indexname;

-- 3. FK on AdminAuditLogs
SELECT conname, confdeltype 
FROM pg_constraint 
WHERE conname = 'FK_AdminAuditLogs_Users_AdminId';

-- 4. Migration record
SELECT "MigrationId" 
FROM "__EFMigrationsHistory" 
WHERE "MigrationId" LIKE '%Wave1%' OR "MigrationId" LIKE '%AdminAuditLogs%';
