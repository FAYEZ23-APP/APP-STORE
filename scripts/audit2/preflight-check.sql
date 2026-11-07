-- ============================================================================
-- PREFLIGHT SCHEMA & SAFETY VERIFICATION SCRIPT FOR PRODUCTION MIGRATION
-- Migration Target: 20261102000426_AddGapsRemediationWave123
-- Target Database: MarketplaceMVP
-- Mode: READ-ONLY (No modifications, zero writes)
-- ============================================================================

\echo '=== STARTING DATABASE MIGRATION PREFLIGHT AUDIT ==='

-- 1. Verify PostgreSQL Version and Session Settings
SELECT 
    version() AS pg_version,
    current_database() AS database_name,
    current_user AS connected_user,
    current_setting('server_version_num')::integer >= 110000 AS is_pg11_or_higher;

-- 2. Check Migration History Consistency
SELECT 
    "MigrationId",
    "ProductVersion"
FROM "__EFMigrationsHistory"
ORDER BY "MigrationId" DESC
LIMIT 10;

-- 3. Check Prerequisite Migrations
SELECT 
    EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261031010308_AddCodSettlementAdminFieldsAndClawback') AS has_prereq_cod_settlement,
    EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261101231814_AddWalletAndPayoutConcurrencyTokens') AS has_prereq_wallet_concurrency,
    EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261102000426_AddGapsRemediationWave123') AS already_applied_wave123;

-- 4. Check Target Tables Existence
SELECT 
    table_name,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t.table_name) AS table_exists
FROM (VALUES 
    ('Users'),
    ('Shipments'),
    ('Orders'),
    ('Products'),
    ('ReturnRequests')
) AS t(table_name);

-- 5. Inspect Existing Column State on Target Tables
SELECT 
    table_name,
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
      (table_name = 'Users' AND column_name IN ('CodRefusalCount')) OR
      (table_name = 'Shipments' AND column_name IN ('AllowInspection', 'Apartment', 'BuildingNumber', 'Floor', 'Landmark', 'DeliveryLatitude', 'DeliveryLongitude', 'EscrowReleaseAt')) OR
      (table_name = 'Orders' AND column_name IN ('IsBuyerConfirmed', 'ConfirmedAt', 'Apartment', 'BuildingNumber', 'Floor', 'Landmark', 'DeliveryLatitude', 'DeliveryLongitude')) OR
      (table_name = 'Products' AND column_name IN ('AllowInspection')) OR
      (table_name = 'ReturnRequests' AND column_name IN ('Status', 'Category', 'ReceivedAt'))
  )
ORDER BY table_name, column_name;

-- 6. Inspect ReturnRequests.Status Type & Length
SELECT 
    table_name,
    column_name,
    data_type,
    character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'ReturnRequests' 
  AND column_name = 'Status';

-- 7. Check for Long-Running Transactions or Locks on Target Tables
SELECT 
    pid,
    now() - pg_stat_activity.query_start AS duration,
    query,
    state
FROM pg_stat_activity
WHERE state != 'idle'
  AND pid != pg_backend_pid()
  AND (now() - pg_stat_activity.query_start) > interval '5 seconds';

\echo '=== PREFLIGHT AUDIT COMPLETE ==='
