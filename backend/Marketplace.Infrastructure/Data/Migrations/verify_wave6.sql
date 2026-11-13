-- Verification Queries for MarketplaceMVP
-- Run this in pgAdmin, DBeaver, or via psql

-- 1. Verify current database and schema
SELECT current_database(), current_schema();

-- 2. Inspect OrderItems table structure and columns (e.g., AcceptedQuantity, RefusedQuantity)
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'OrderItems'
ORDER BY ordinal_position;

-- 3. Check if Wave 6 migration is recorded in EF Migrations history
SELECT "MigrationId", "ProductVersion"
FROM "__EFMigrationsHistory"
WHERE "MigrationId" = '20261107051448_AddWave6BulkUploadCarrierRemittancePartialDelivery';

