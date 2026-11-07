-- Wave 3 Idempotent Migration: KYB & Remittance Batch
-- Applied to MarketplaceMVP_test

START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261107020520_AddWave3KybAndRemittanceBatch') THEN
    ALTER TABLE "Shipments" ADD "RemittanceBatchReference" character varying(100);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261107020520_AddWave3KybAndRemittanceBatch') THEN
    ALTER TABLE "SellerProfiles" ADD "CommercialRegisterNumber" character varying(50);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261107020520_AddWave3KybAndRemittanceBatch') THEN
    ALTER TABLE "SellerProfiles" ADD "KybDocumentUrl" character varying(500);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261107020520_AddWave3KybAndRemittanceBatch') THEN
    ALTER TABLE "SellerProfiles" ADD "KybRejectionReason" character varying(500);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261107020520_AddWave3KybAndRemittanceBatch') THEN
    ALTER TABLE "SellerProfiles" ADD "KybStatus" character varying(30) NOT NULL DEFAULT 'Unverified';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261107020520_AddWave3KybAndRemittanceBatch') THEN
    ALTER TABLE "SellerProfiles" ADD "KybVerifiedAt" timestamp with time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261107020520_AddWave3KybAndRemittanceBatch') THEN
    ALTER TABLE "SellerProfiles" ADD "NationalIdNumber" character varying(30);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261107020520_AddWave3KybAndRemittanceBatch') THEN
    ALTER TABLE "SellerProfiles" ADD "TaxCardNumber" character varying(50);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261107020520_AddWave3KybAndRemittanceBatch') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20261107020520_AddWave3KybAndRemittanceBatch', '10.0.5');
    END IF;
END $EF$;

COMMIT;
