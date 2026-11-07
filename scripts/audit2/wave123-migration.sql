-- ============================================================================
-- PRODUCTION-GRADE TRANSACTIONAL IDEMPOTENT MIGRATION SCRIPT
-- Migration: 20261102000426_AddGapsRemediationWave123
-- Features: Wave 1, Wave 2, and Wave 3 Production Gaps Remediation
-- Governance: Fully Transactional, Idempotent, Safe Against Partial Application
-- ============================================================================

-- Ensure prerequisite migration history is recorded
START TRANSACTION;

SET lock_timeout = '5s';

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261101231814_AddWalletAndPayoutConcurrencyTokens') THEN
        INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
        VALUES ('20261101231814_AddWalletAndPayoutConcurrencyTokens', '10.0.5');
    END IF;
END $EF$;

COMMIT;

-- Apply Wave 1, 2, 3 Remediation Migration
START TRANSACTION;

SET lock_timeout = '5s';

-- 1. Users table updates (COD Refusal Tracking)
DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261102000426_AddGapsRemediationWave123') THEN
        ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "CodRefusalCount" integer NOT NULL DEFAULT 0;
    END IF;
END $EF$;

-- 2. Shipments table updates (Egyptian Detailed Address, Inspection Badge, Escrow Release Date)
DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261102000426_AddGapsRemediationWave123') THEN
        ALTER TABLE "Shipments" ADD COLUMN IF NOT EXISTS "AllowInspection" boolean NOT NULL DEFAULT TRUE;
        ALTER TABLE "Shipments" ADD COLUMN IF NOT EXISTS "Apartment" character varying(50);
        ALTER TABLE "Shipments" ADD COLUMN IF NOT EXISTS "BuildingNumber" character varying(50);
        ALTER TABLE "Shipments" ADD COLUMN IF NOT EXISTS "DeliveryLatitude" double precision;
        ALTER TABLE "Shipments" ADD COLUMN IF NOT EXISTS "DeliveryLongitude" double precision;
        ALTER TABLE "Shipments" ADD COLUMN IF NOT EXISTS "EscrowReleaseAt" timestamp with time zone;
        ALTER TABLE "Shipments" ADD COLUMN IF NOT EXISTS "Floor" character varying(50);
        ALTER TABLE "Shipments" ADD COLUMN IF NOT EXISTS "Landmark" character varying(250);
    END IF;
END $EF$;

-- 3. ReturnRequests table updates (Status expansion, Consumer Protection Law 181/2018 Category, Physical Receipt)
DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261102000426_AddGapsRemediationWave123') THEN
        ALTER TABLE "ReturnRequests" ALTER COLUMN "Status" TYPE character varying(30);
        ALTER TABLE "ReturnRequests" ADD COLUMN IF NOT EXISTS "Category" character varying(50) NOT NULL DEFAULT 'Standard14Day';
        ALTER TABLE "ReturnRequests" ADD COLUMN IF NOT EXISTS "ReceivedAt" timestamp with time zone;
    END IF;
END $EF$;

-- 4. Products table updates (Open-Box Doorstep Inspection Flag)
DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261102000426_AddGapsRemediationWave123') THEN
        ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS "AllowInspection" boolean NOT NULL DEFAULT TRUE;
    END IF;
END $EF$;

-- 5. Orders table updates (Egyptian Detailed Address, Buyer Order Confirmation)
DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261102000426_AddGapsRemediationWave123') THEN
        ALTER TABLE "Orders" ADD COLUMN IF NOT EXISTS "Apartment" character varying(50);
        ALTER TABLE "Orders" ADD COLUMN IF NOT EXISTS "BuildingNumber" character varying(50);
        ALTER TABLE "Orders" ADD COLUMN IF NOT EXISTS "ConfirmedAt" timestamp with time zone;
        ALTER TABLE "Orders" ADD COLUMN IF NOT EXISTS "DeliveryLatitude" double precision;
        ALTER TABLE "Orders" ADD COLUMN IF NOT EXISTS "DeliveryLongitude" double precision;
        ALTER TABLE "Orders" ADD COLUMN IF NOT EXISTS "Floor" character varying(50);
        ALTER TABLE "Orders" ADD COLUMN IF NOT EXISTS "IsBuyerConfirmed" boolean NOT NULL DEFAULT FALSE;
        ALTER TABLE "Orders" ADD COLUMN IF NOT EXISTS "Landmark" character varying(250);
    END IF;
END $EF$;

-- 6. Record successful migration in EF Core history
DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261102000426_AddGapsRemediationWave123') THEN
        INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
        VALUES ('20261102000426_AddGapsRemediationWave123', '10.0.5');
    END IF;
END $EF$;

COMMIT;
